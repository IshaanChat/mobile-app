import SwiftUI

/// Discover: the app's front door, and for an explorer their whole home screen.
///
/// A catalogue of products worth selling, what each costs to source, and what
/// it sells for. Grouped into shelves the way a shop is, because that is how
/// you browse when you do not yet know what you want.
struct DiscoverScreen: View {
    @Environment(\.theme) private var theme
    // A sheet is a new environment, so the palette has to be reinstalled on it
    // — otherwise the commit sheet renders in the default light scheme over a
    // dark app.
    @Environment(\.colorScheme) private var colorScheme
    @Environment(AppState.self) private var app
    @Environment(Celebrations.self) private var celebrations

    @State private var payload: TrendsPayload?
    @State private var filter: Filter?
    @State private var errorMessage: String?
    /// The product an explorer is turning into a business, if any.
    @State private var committing: DiscoverProduct?

    enum Filter: String, CaseIterable {
        case seller, maker, saved

        var label: String {
            switch self {
            case .seller: return "Seller"
            case .maker: return "Maker"
            case .saved: return "Saved"
            }
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                header
                content
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 64)
        }
        .background(theme.scheme.background)
        .refreshable { await load() }
        .task { if payload == nil { await load() } }
        .milestone(Trigger.openDiscover)
        .sheet(item: $committing) { product in
            CommitSheet(product: product)
                .venturoTheme(colorScheme)
                .environment(app)
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Discover")
                .font(.custom(Typeface.display, size: 30))
                .tracking(-0.45)
                .foregroundStyle(theme.scheme.text)
                .padding(.top, 6)

            Text("Somebody is already selling all of this. Here is what it costs them.")
                .font(.custom(Typeface.sansMedium, size: 13))
                .foregroundStyle(theme.scheme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)

            HStack(spacing: 8) {
                ForEach(Filter.allCases, id: \.self) { option in
                    FilterChip(
                        label: label(for: option),
                        isOn: filter == option
                    ) {
                        // Tapping the active chip clears it, so every chip is a
                        // toggle and there is always a way back to the whole
                        // feed without an "All" that does not exist.
                        filter = filter == option ? nil : option
                        // Only the two that are actually "Maker and Seller" —
                        // Saved is a shelf, not a lens on the catalogue.
                        if option != .saved { Task { await fireFilter() } }
                    }
                }
            }
            .padding(.top, 12)

            matchBanner
        }
        .padding(.bottom, 4)
    }

    /// Says how many products were highlighted, so the accent borders read as a
    /// deliberate answer to what the user typed rather than as decoration.
    ///
    /// Shown only once there is something to have matched against — somebody
    /// who skipped the question is not told that nothing matched.
    @ViewBuilder private var matchBanner: some View {
        // Suppressed on an empty catalogue: "nothing matched what you're into"
        // is a claim about the user's answers, and it is not true when there
        // was nothing to match against in the first place.
        if payload != nil, !wants.isEmpty, !catalogueIsEmpty {
            let count = matchCount
            Text(
                count > 0
                    ? "Highlighted \(count) products from what you said you're into"
                    : "Nothing matched exactly — browse everything, something will click"
            )
            .font(.custom(Typeface.sansMedium, size: 12))
            .foregroundStyle(theme.scheme.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 10)
        }
    }

    private func label(for option: Filter) -> String {
        guard option == .saved, savedCount > 0 else { return option.label }
        return "Saved · \(savedCount)"
    }

    private func fireFilter() async {
        guard let milestone = await app.fire(Trigger.tryFilter) else { return }
        celebrations.completed(title: milestone.title, xp: milestone.xp,
                               totalXp: app.awardedXP, next: nil)
    }

    private var savedCount: Int {
        payload?.products.filter(\.saved).count ?? 0
    }

    // MARK: - Content

    @ViewBuilder private var content: some View {
        if payload != nil {
            if visibleSections.isEmpty {
                emptyState
            } else {
                ForEach(visibleSections, id: \.title) { section in
                    if !section.title.isEmpty {
                        SectionHeading(title: section.title)
                    }
                    ForEach(section.products) { product in
                        ProductCard(
                            product: product,
                            hotFloor: hotFloor,
                            matched: Relevance.matches(product, wants: wants),
                            onToggleSave: { toggleSave(product) },
                            // Offered only to explorers. Somebody who already
                            // has a business is browsing, not founding.
                            onCommit: app.activeBusiness == nil
                                ? { committing = product }
                                : nil
                        )
                        .padding(.bottom, 16)
                    }
                }
            }
        } else if let errorMessage {
            failure(errorMessage)
        } else {
            loading
        }
    }

    private var loading: some View {
        VStack(spacing: Space.three) {
            ProgressView().tint(theme.scheme.accent)
            // No server to wake any more, so this is a network wait rather
            // than a cold start. Said plainly, because the old line promised a
            // 30-second nap that cannot happen.
            Text("Fetching the catalogue.")
                .font(.custom(Typeface.sansMedium, size: 13))
                .foregroundStyle(theme.scheme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 64)
    }

    private func failure(_ message: String) -> some View {
        VStack(spacing: Space.three) {
            Text("Couldn't load Discover")
                .font(.custom(Typeface.sansBold, size: 15))
                .foregroundStyle(theme.scheme.text)
            Text(message)
                .font(.custom(Typeface.sansMedium, size: 13))
                .foregroundStyle(theme.scheme.textSecondary)
                .multilineTextAlignment(.center)
            Button("Try again") { Task { await load() } }
                .font(.custom(Typeface.sansSemiBold, size: 14))
                .foregroundStyle(theme.scheme.accentText)
                .padding(.horizontal, 24)
                .padding(.vertical, 10)
                .background(theme.scheme.accent, in: Capsule())
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 56)
    }

    /// Three different nothings, and they are not interchangeable.
    ///
    /// A filter that matched nothing is the user's doing and recoverable by
    /// them. An empty catalogue is ours, and telling somebody to "browse
    /// everything" when there is nothing to browse reads as the app blaming
    /// them for its own failure — which is exactly what a tester would report,
    /// and report as confusing rather than as broken.
    @ViewBuilder private var emptyState: some View {
        if catalogueIsEmpty {
            VStack(spacing: 8) {
                Text("Nothing to show yet.")
                    .font(.custom(Typeface.sansBold, size: 15))
                    .foregroundStyle(theme.scheme.text)
                Text("That's on us, not you. Pull down to try again.")
                    .font(.custom(Typeface.sansMedium, size: 14))
                    .foregroundStyle(theme.scheme.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 56)
        } else {
            Text(
                filter == .saved
                    ? "Nothing saved yet — tap the heart on a product and it lands here."
                    : "Nothing matched exactly — browse everything, something will click."
            )
            .font(.custom(Typeface.sansMedium, size: 14))
            .foregroundStyle(theme.scheme.textSecondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 56)
        }
    }

    /// The load succeeded and returned nothing — which is a different thing
    /// from still loading, and from a filter hiding everything.
    private var catalogueIsEmpty: Bool {
        payload?.products.isEmpty == true
    }

    // MARK: - The two rules that decide how the feed feels

    /// What counts as hot: the top fifth of whatever is loaded.
    ///
    /// A percentile, not a constant, because hotness is not one scale. Curated
    /// products carry machine-measured heat in the 8–55 range while sourced
    /// products carry a criteria-fit score in the high 70s and up, and they
    /// share the field. Any fixed threshold would flame every sourced product
    /// and none of the curated ones, or the exact reverse. A percentile at
    /// least means "Hot" always describes the same *proportion* of the feed.
    ///
    /// The underlying two-scales problem is still open, and still worth fixing
    /// at the source rather than here.
    private var hotFloor: Int {
        guard let products = payload?.products, !products.isEmpty else { return .max }
        let sorted = products.map(\.hotness).sorted()
        return sorted[Int(Double(sorted.count) * 0.8)]
    }

    private struct Shelf {
        let title: String
        let products: [DiscoverProduct]
    }

    private var visibleSections: [Shelf] {
        guard let payload else { return [] }

        // Saving takes a product *out* of the browsing feed and moves it to the
        // Saved chip. The feed shrinks as you triage, so a long catalogue ends
        // rather than repeating — and Saved is a shelf you chose, not a copy of
        // one you already scrolled past.
        let visible = payload.products.filter { product in
            if filter == .saved { return product.saved }
            if product.saved { return false }
            guard let filter else { return true }
            let audience = product.niche?.audience
            // Follows the badge, not the raw value: a `both` niche is badged
            // Maker, so filtering to Maker must include it or a card reading
            // "Maker" appears in a list the user filtered to something else.
            return filter == .maker
                ? audience == "maker" || audience == "both"
                : audience == "reseller"
        }

        // Saved is a flat shelf. Domain headings over a handful of hand-picked
        // rows read as filing rather than browsing.
        if filter == .saved || payload.sections.isEmpty {
            return visible.isEmpty ? [] : [Shelf(title: "", products: ordered(visible))]
        }

        let byId = Dictionary(uniqueKeysWithValues: visible.map { ($0.id, $0) })
        return payload.sections.compactMap { section in
            let products = section.productIds.compactMap { byId[$0] }
            // A shelf whose products were all filtered out should not leave its
            // heading stranded over empty space.
            return products.isEmpty ? nil : Shelf(title: section.title, products: ordered(products))
        }
    }

    /// Sorts within a shelf, never across shelves.
    ///
    /// The server decides which domain you land on — section order comes from
    /// each domain's best product, so the shelf that matches you is already
    /// first. This only decides what leads inside one of them, which is the
    /// part that depends on the filter and on what the user typed, and neither
    /// of those is worth a round trip.
    private func ordered(_ products: [DiscoverProduct]) -> [DiscoverProduct] {
        let floor = hotFloor
        let sellerFilter = filter == .seller
        // Hoisted: `wants` tokenizes free text, and reading it inside the map
        // would redo that once per card.
        let want = wants

        // Written as statements rather than a map/sorted/map chain: the chained
        // version type-checks too slowly for the compiler to accept.
        var grouped: [(product: DiscoverProduct, group: Int)] = []
        grouped.reserveCapacity(products.count)
        for product in products {
            let group = Relevance.group(
                isHot: product.hotness >= floor,
                isUpside: product.isUpside,
                isMatch: Relevance.matches(product, wants: want),
                sellerFilter: sellerFilter
            )
            grouped.append((product: product, group: group))
        }

        // Stable within a group by falling back to heat, so a shelf does not
        // reshuffle on every redraw the way an unstable comparator would.
        grouped.sort { a, b in
            if a.group == b.group {
                return a.product.hotness > b.product.hotness
            }
            return a.group < b.group
        }

        return grouped.map(\.product)
    }

    // MARK: - Relevance

    /// What the user is into, tokenized once per redraw rather than per card.
    private var wants: [String] {
        Relevance.wants(business: app.activeBusiness, interests: Preferences.interests)
    }

    private var matchCount: Int {
        guard let products = payload?.products, !wants.isEmpty else { return 0 }
        let want = wants
        return products.filter { Relevance.matches($0, wants: want) }.count
    }

    // MARK: - Loading and saving

    private func load() async {
        errorMessage = nil
        do {
            // Explorers have no business to rank against, so the interests they
            // gave during onboarding stand in. Discover is their home screen —
            // it has to work before anything else exists.
            // Which products are hearted lives in the private database, so it
            // is fetched alongside and joined in. `try?` rather than `try`:
            // somebody with no iCloud account still gets the whole feed, just
            // with no hearts filled.
            async let savedTask = try? await app.store.savedSlugs()
            payload = try await app.content.getTrends(
                businessId: app.activeBusiness?.id,
                interests: app.activeBusiness == nil ? Preferences.interests : [],
                savedSlugs: await savedTask ?? []
            )
        } catch {
            if payload == nil { errorMessage = error.localizedDescription }
        }
    }

    /// Optimistic: the heart answers immediately and rolls back if the write
    /// fails, so it can never end up lying about what is on the shelf.
    ///
    /// Rolling back by id rather than by the captured index, because the feed
    /// re-filters the moment `saved` flips — the row moves, and the index that
    /// was correct when the tap happened points at a different product by the
    /// time the request comes back.
    private func toggleSave(_ product: DiscoverProduct) {
        let wasSaved = product.saved
        // Fired on the way in, not on the way back: the write below is
        // optimistic and the milestone should follow the user's intent, not
        // the round trip.
        if !wasSaved {
            Task {
                guard let m = await app.fire(Trigger.bookmarkProduct) else { return }
                celebrations.completed(title: m.title, xp: m.xp,
                                       totalXp: app.awardedXP, next: nil)
            }
        }
        setSaved(!wasSaved, id: product.id)

        Task {
            do {
                if wasSaved {
                    try await app.store.unsaveTrend(slug: product.id)
                } else {
                    try await app.store.saveTrend(slug: product.id)
                }
            } catch {
                setSaved(wasSaved, id: product.id)
            }
        }
    }

    private func setSaved(_ saved: Bool, id: String) {
        guard let index = payload?.products.firstIndex(where: { $0.id == id }) else { return }
        payload?.products[index].saved = saved
    }
}
