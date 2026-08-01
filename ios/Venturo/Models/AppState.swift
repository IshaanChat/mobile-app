import Foundation
import Observation

/// Where the user is, as far as the app is concerned.
///
/// This drives every top-level routing decision, and it is derived rather than
/// set — there is no `mode = .active` anywhere. Deriving it from the two facts
/// that matter (is there a profile, is there a business) is what stops the app
/// disagreeing with itself about who is signed in.
enum AppMode: Equatable {
    /// Still asking. Distinct from `error` so a slow cold start is not
    /// mistaken for a failure — this backend routinely takes 30 seconds.
    case loading
    /// The first load failed and there is nothing to show. Recoverable: the
    /// user can retry.
    case error(String)
    /// Signed in, but no profile row exists yet.
    case onboarding
    /// Has a profile, has no business. **The primary new-user path** — someone
    /// exploring before committing to an idea. Discover is their home.
    case explorer
    /// Has at least one business. The full app.
    case active
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

    /// User data — profile, businesses, contacts, sales. Moves to CloudKit's
    /// private database in phase 4; until then it is still the Express API.
    let api: APIClient

    /// The curated content database, read straight from CloudKit's public
    /// database. Needs no account, which is what lets Discover be the front
    /// door rather than something behind a sign-up wall.
    let content: CloudKitContent

    init(api: APIClient, content: CloudKitContent = CloudKitContent()) {
        self.api = api
        self.content = content
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

        async let profileTask = api.getProfile()
        async let businessesTask = api.getBusinesses()

        do {
            let (profile, businesses) = try await (profileTask, businessesTask)
            self.profile = profile
            self.businesses = businesses
            self.hasLoaded = true
            recomputeMode()
        } catch let error as APIError {
            // Keep whatever is already on screen if this was a refresh — a
            // failed reload should not blank an app that is working.
            if hasLoaded { return }
            mode = .error(error.message)
        } catch {
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

    /// Clears everything on sign-out. Local only — nothing server-side is
    /// touched, so signing back in restores the same account.
    func signedOut() {
        profile = nil
        businesses = []
        activeBusinessId = nil
        hasLoaded = false
        Preferences.reset()
        mode = .loading
    }
}
