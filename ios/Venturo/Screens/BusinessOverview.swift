import SwiftUI

/// Overview: the business at a glance.
///
/// Five endpoints, fetched in parallel and each allowed to fail on its own.
/// One dead request must not blank the dashboard — a missing "recent moves"
/// card is a gap, a blank screen is a broken app, and the difference is worth
/// five separate `try?`s.
struct BusinessOverview: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app

    @State private var contacts: [Contact] = []
    @State private var payments: PaymentsPayload?
    @State private var shelf: ProductsPayload?
    @State private var feed: [FeedInteraction] = []
    @State private var journey: JourneyPayload?
    @State private var hasLoaded = false

    var body: some View {
        Group {
            if app.activeBusiness == nil {
                ExplorerEmpty(
                    title: "Nothing to measure yet",
                    body_: "Once you commit to a product and start your business, this is where the numbers land."
                )
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    stats
                    needsYou
                    recentMoves
                    strongest
                }
                .padding(.top, 12)
            }
        }
        .task { if !hasLoaded { await load() } }
    }

    // MARK: - Stats

    private var stats: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            StatCard(value: "\(contacts.count)", label: "people in your book")
            StatCard(
                value: Money.short(payments?.summary.total ?? 0),
                label: "all-time revenue",
                tint: theme.scheme.customer
            )
            StatCard(value: "\(shelf?.summary.count ?? 0)", label: "listings on the shelf")
            StatCard(
                value: "\(journey?.summary.level ?? 1)",
                label: journey?.summary.levelName ?? "Explorer"
            )
        }
    }

    // MARK: - Who needs you

    /// Contacts who have gone quiet for longer than the cooling-off setting, or
    /// who were never contacted at all. Never-contacted comes first: somebody
    /// you added and never spoke to is a stronger prompt than somebody you
    /// spoke to a fortnight ago.
    private var quiet: [Contact] {
        let threshold = Preferences.coolingOffDays
        return contacts
            .filter { contact in
                guard let days = Elapsed.days(since: contact.lastInteractionAt) else { return true }
                return days >= threshold
            }
            .sorted { $0.relationshipStrength > $1.relationshipStrength }
            .prefix(4)
            .map { $0 }
    }

    @ViewBuilder private var needsYou: some View {
        PanelCard(title: "Who needs you", icon: .flame) {
            if quiet.isEmpty {
                Text("Nobody is waiting on you. Rare and worth enjoying.")
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.textSecondary)
            } else {
                VStack(spacing: 0) {
                    ForEach(quiet) { contact in
                        HStack(spacing: 9) {
                            StatusDot(status: contact.status)
                            Text(contact.name)
                                .font(.custom(Typeface.sansMedium, size: 13))
                                .foregroundStyle(theme.scheme.text)
                            Spacer(minLength: 0)
                            Text(Elapsed.quietLabel(contact.lastInteractionAt))
                                .font(.custom(Typeface.sansMedium, size: 12))
                                .foregroundStyle(theme.scheme.textSecondary)
                        }
                        .padding(.vertical, 8)
                        if contact.id != quiet.last?.id {
                            Rectangle().fill(theme.scheme.border).frame(height: 1)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Recent moves

    @ViewBuilder private var recentMoves: some View {
        PanelCard(title: "Recent moves", icon: .spark) {
            if feed.isEmpty {
                Text("No activity yet — log your first interaction and the story starts here.")
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(feed) { item in
                        HStack(spacing: 9) {
                            StatusDot(status: item.contact.status)
                            Text(item.contact.name)
                                .font(.custom(Typeface.sansSemiBold, size: 13))
                                .foregroundStyle(theme.scheme.text)
                            Text(InteractionLabel.of(item.type))
                                .font(.custom(Typeface.sansMedium, size: 13))
                                .foregroundStyle(theme.scheme.textSecondary)
                            Spacer(minLength: 0)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Strongest

    private var strongest: some View {
        let top = contacts.filter { $0.relationshipStrength > 0 }
            .sorted { $0.relationshipStrength > $1.relationshipStrength }
            .prefix(3)

        return Group {
            if !top.isEmpty {
                PanelCard(title: "Strongest relationships", icon: .trophy) {
                    VStack(spacing: 8) {
                        ForEach(Array(top)) { contact in
                            HStack(spacing: 9) {
                                StatusDot(status: contact.status)
                                Text(contact.name)
                                    .font(.custom(Typeface.sansMedium, size: 13))
                                    .foregroundStyle(theme.scheme.text)
                                Spacer(minLength: 0)
                                Text("\(Int(contact.relationshipStrength.rounded()))")
                                    .font(.custom(Typeface.sansBold, size: 13))
                                    .monospacedDigit()
                                    .foregroundStyle(theme.scheme.accent)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Loading

    private func load() async {
        guard let business = app.activeBusiness else { return }
        hasLoaded = true
        let id = business.id

        // Each result is optional on its own. `async let` starts all five at
        // once; `try?` means one failure costs one card rather than the page.
        async let graph = try? app.store.getGraph(businessId: id)
        async let paymentsResult = try? app.store.getPayments(businessId: id)
        async let shelfResult = try? app.store.getShelf(businessId: id)
        async let feedResult = try? app.store.getActivityFeed(businessId: id, limit: 3)
        // The journey is per-user rather than per-business, so this is the one
        // call here that does not take an id — and the one that works for an
        // explorer who has no business at all.
        async let journeyResult = try? app.content.getJourney(
            completed: (try? await app.store.completedMilestones()) ?? []
        )

        contacts = (await graph)?.contacts ?? []
        payments = await paymentsResult
        shelf = await shelfResult
        feed = (await feedResult) ?? []
        journey = await journeyResult
    }
}

enum InteractionLabel {
    static func of(_ type: String) -> String {
        switch type {
        case "MESSAGE": return "messaged"
        case "MEETING": return "met"
        case "PURCHASE": return "bought something"
        case "REVIEW": return "left a review"
        default: return "got in touch"
        }
    }
}
