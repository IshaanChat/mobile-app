import Foundation
import Observation

/// Where the user is, as far as the app is concerned.
///
/// This drives every top-level routing decision, and it is derived rather than
/// set — there is no `mode = .active` anywhere. Deriving it from the two facts
/// that matter (is there a profile, is there a business) is what stops the app
/// disagreeing with itself about who is signed in.
enum AppMode: Equatable {
    /// Still asking. Distinct from `error` so a slow first load is not mistaken
    /// for a failure.
    case loading
    /// The first load failed and there is nothing to show. Recoverable: the
    /// user can retry.
    case error(String)
    /// **No iCloud account, and that is fine.** The content database reads
    /// without one, so Discover, Grow and the journey all work — nothing can be
    /// *kept*, which is a limitation to explain where it bites rather than a
    /// wall to put in front of the app.
    ///
    /// The carried string is why, for the cases that are not simply "signed
    /// out": restricted by device management, or CloudKit unreachable.
    case browsing(String?)
    /// Has an account, no profile yet.
    case onboarding
    /// Has a profile, has no business. Someone exploring before committing to
    /// an idea. Discover is their home.
    case explorer
    /// Has at least one business. The full app.
    case active

    /// Whether anything can be written. Every save, commit and logged
    /// interaction asks this before offering itself.
    var canPersist: Bool {
        switch self {
        case .browsing, .loading, .error: return false
        case .onboarding, .explorer, .active: return true
        }
    }
}

@Observable
@MainActor
final class AppState {
    private(set) var mode: AppMode = .loading

    private(set) var profile: UserProfile?
    private(set) var businesses: [Business] = []

    /// Nil for explorers, and every business-scoped screen must handle that
    /// rather than force-unwrapping — the explorer path is the common one, not
    /// the edge case.
    var activeBusiness: Business? {
        businesses.first { $0.id == activeBusinessId } ?? businesses.first
    }

    private var activeBusinessId: String?
    private var hasLoaded = false

    /// The curated content database, read from CloudKit's public database.
    /// Needs no account, which is what lets Discover be the front door rather
    /// than something behind a sign-up wall.
    let content: CloudKitContent

    /// The user's own records, in CloudKit's private database.
    let store: CloudKitPrivate

    init(content: CloudKitContent = CloudKitContent(), store: CloudKitPrivate = CloudKitPrivate()) {
        self.content = content
        self.store = store
        self.activeBusinessId = Preferences.activeBusinessId
    }

    // MARK: - Loading

    /// Fetches the two facts the mode depends on, in parallel.
    ///
    /// Both must land before a mode can be derived: a profile with the business
    /// list still outstanding looks exactly like an explorer, and routing on
    /// that would bounce a returning user through an empty state on every cold
    /// launch.
    func load() async {
        if !hasLoaded { mode = .loading }

        // Asked first, and cheap. Without an account there is nothing to fetch
        // and no failure to report — just a smaller app.
        switch await store.availability() {
        case .noAccount:
            mode = .browsing(nil)
            return
        case .unavailable(let reason):
            mode = .browsing(reason)
            return
        case .available:
            break
        }

        async let profileTask = store.getProfile()
        async let businessesTask = store.getBusinesses()

        do {
            let (profile, businesses) = try await (profileTask, businessesTask)
            self.profile = profile
            self.businesses = businesses
            self.hasLoaded = true
            recomputeMode()
        } catch {
            // Keep whatever is already on screen if this was a refresh — a
            // failed reload should not blank an app that is working.
            if hasLoaded { return }
            mode = .error(error.localizedDescription)
        }
    }

    private func recomputeMode() {
        guard profile != nil else {
            mode = .onboarding
            return
        }
        mode = businesses.isEmpty ? .explorer : .active
    }

    // MARK: - Milestones
    //
    // Nineteen of the thirty-four milestones are `automatic` — the server used
    // to watch for them and award them, and the Journey sheet deliberately
    // gives them no tick box because asking the user to confirm something the
    // app can see would be noise.
    //
    // Removing the server removed the thing that watched. Every automatic
    // milestone became unreachable: untickable by design and unawarded in
    // fact, which froze the whole Journey at 0/34 and meant level two never
    // unlocked. This is the replacement, and it lives on the client now
    // because there is nowhere else for it to live.

    private(set) var completedMilestones: Set<String> = []

    /// trigger → the milestone it awards. Built once from the journey content.
    private var byTrigger: [String: Milestone2] = [:]

    func loadMilestones() async {
        async let doneTask = try? await store.completedMilestones()
        async let journeyTask = try? await content.getJourney()

        let (done, journey) = await (doneTask, journeyTask)
        completedMilestones = done ?? []

        guard let journey else { return }
        byTrigger = Dictionary(
            journey.levels
                .flatMap(\.milestones)
                .compactMap { milestone in milestone.trigger.map { ($0, milestone) } },
            // A trigger naming two milestones is a content mistake; take the
            // first rather than crashing on it.
            uniquingKeysWith: { first, _ in first }
        )
    }

    /// Records that the user did the thing, and says whether that was news.
    ///
    /// Returns the milestone only when this call is what completed it, so the
    /// caller can celebrate exactly once. Opening Discover for the fiftieth
    /// time returns nil.
    @discardableResult
    func fire(_ trigger: String) async -> Milestone2? {
        guard mode.canPersist else { return nil }

        // Loads the index if it is not there yet rather than giving up. The
        // first screen's `.task` and the root's run concurrently, and Discover
        // reliably wins — so relying on the root to have finished meant the
        // very first milestone anybody could earn was the one that never
        // fired.
        if byTrigger.isEmpty { await loadMilestones() }

        guard let milestone = byTrigger[trigger] else { return nil }
        guard !completedMilestones.contains(milestone.slug) else { return nil }

        // Inserted before the write, not after. Two views can fire the same
        // trigger in the same frame — Discover appearing and its task running —
        // and the second must not get as far as a duplicate celebration.
        completedMilestones.insert(milestone.slug)

        do {
            try await store.completeMilestone(slug: milestone.slug, xp: milestone.xp)
            return milestone
        } catch {
            completedMilestones.remove(milestone.slug)
            return nil
        }
    }

    /// For the Journey sheet's own tick boxes, which award manually.
    func milestoneCompleted(_ slug: String) {
        completedMilestones.insert(slug)
    }

    /// XP for everything awarded so far, from the milestones this app knows
    /// about. Only counts triggered ones — the Journey sheet has the full
    /// picture and uses its own.
    var awardedXP: Int {
        byTrigger.values
            .filter { completedMilestones.contains($0.slug) }
            .reduce(0) { $0 + $1.xp }
    }

    // MARK: - Mutation
    //
    // These patch local state rather than refetching. Two reasons: the server
    // has already told us the new value in its response, so a refetch asks a
    // question we know the answer to; and a refetch would put the app back
    // through `.loading`, which flickers.

    func profileCreated(_ profile: UserProfile) {
        self.profile = profile
        recomputeMode()
    }

    func profileUpdated(_ profile: UserProfile) {
        self.profile = profile
    }

    /// Also switches to the new business.
    ///
    /// Ordering matters during onboarding: the "already have a business" path
    /// creates a profile and a business back to back, and if the mode were
    /// recomputed between them the app would pass through `.explorer` and
    /// redirect out of the flow mid-way.
    func businessCreated(_ business: Business) {
        businesses.append(business)
        switchBusiness(to: business.id)
        recomputeMode()
    }

    func businessUpdated(_ business: Business) {
        guard let index = businesses.firstIndex(where: { $0.id == business.id }) else { return }
        businesses[index] = business
    }

    func switchBusiness(to id: String) {
        activeBusinessId = id
        Preferences.activeBusinessId = id
    }

    /// Clears local state after the account's records have been deleted.
    ///
    /// There is no sign-out any more — identity is the device's iCloud account,
    /// and leaving is done in Settings rather than here. This runs once, after
    /// the private zone has actually been removed.
    func accountDeleted() {
        profile = nil
        businesses = []
        activeBusinessId = nil
        hasLoaded = false
        Preferences.reset()
        mode = .loading
    }
}
