import SwiftUI

/// Fires a milestone trigger and celebrates it if it was news.
///
/// The two halves have to happen together — awarding without celebrating makes
/// progress invisible, and celebrating without awarding makes it a lie — so
/// they live in one modifier rather than at every call site.
///
///     DiscoverScreen()
///         .milestone(.openDiscover)          // on appear
///
///     Button("Save") { ... }
///         .milestone(.bookmarkProduct, on: didSave)   // when a value changes
///
/// Silent for anyone with no iCloud account: `AppState.fire` checks
/// `canPersist` first, so browsing without signing in never pretends to record
/// progress it cannot keep.
struct MilestoneTrigger: ViewModifier {
    @Environment(AppState.self) private var app
    @Environment(Celebrations.self) private var celebrations

    let trigger: String

    func body(content: Content) -> some View {
        content.task { await fire() }
    }

    private func fire() async {
        guard let milestone = await app.fire(trigger) else { return }
        celebrations.completed(
            title: milestone.title,
            xp: milestone.xp,
            // The running total, from what has been awarded so far. The Journey
            // sheet reads its own from the freshly loaded payload; out here
            // there is no payload, and re-fetching one to decorate a banner
            // would cost a round trip for a number nobody checks.
            totalXp: app.awardedXP,
            next: nil
        )
    }
}

extension View {
    /// Fires when the view appears.
    func milestone(_ trigger: String) -> some View {
        modifier(MilestoneTrigger(trigger: trigger))
    }
}

/// The trigger names, which are content rather than code — they come from
/// `missions.json` and are matched by string. Gathered here so a typo is a
/// compile error at the call site instead of a milestone that silently never
/// fires.
enum Trigger {
    static let openDiscover = "open-discover"
    static let openNiche = "open-niche"
    static let tryFilter = "try-filter"
    static let bookmarkProduct = "bookmark-product"
    static let openJourney = "open-journey"
    static let pickNiche = "pick-niche"
    static let viewSource = "view-source"
    static let nameBusiness = "name-business"
    static let startBusiness = "start-business"
    static let addShelf = "add-shelf"
    static let openGrow = "open-grow"
    static let openCommunity = "open-community"
    static let pickCommunity = "pick-community"
    static let addSocial = "add-social"
    static let addContact = "add-contact"
    static let logInteraction = "log-interaction"
    static let logSale = "log-sale"
    static let fiveSales = "five-sales"
    static let pickSecondNiche = "pick-second-niche"
}
