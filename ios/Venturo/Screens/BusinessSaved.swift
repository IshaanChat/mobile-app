import SwiftUI

/// Saved: the shelf of everything hearted in Discover.
///
/// The one Business pane that works before a business does. Saving is
/// user-scoped, not business-scoped, so an explorer triaging the catalogue has
/// a shelf from their first tap — and this is where Discover's toast promises
/// their bookmark went.
///
/// It fetches its own list rather than filtering the feed. `GET /trends`
/// returns the top 50 ranked products, so a product saved last week can rank
/// out of the feed and take its heart with it; the Saved chip in Discover would
/// then quietly stop showing something the user definitely saved.
/// `GET /trends/saved` is the complete answer, archived cards included.
struct BusinessSaved: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app

    /// Reported upward so the subtab can carry the count. Nil until the first
    /// load lands — an unloaded shelf is not an empty one, and "Saved · 0"
    /// would say it was.
    @Binding var count: Int?
    var onOpenDiscover: (() -> Void)? = nil

    @State private var products: [DiscoverProduct]?
    @State private var errorMessage: String?

    var body: some View {
        PanelCard(
            title: "Bookmarked products",
            icon: .heart,
            action: onOpenDiscover.map { open in (label: "Find more →", run: open) }
        ) {
            content
        }
        .padding(.top, 12)
        .task { if products == nil { await load() } }
    }

    @ViewBuilder private var content: some View {
        if let products {
            if products.isEmpty {
                Text("Nothing saved yet. Tap the heart on anything in Discover and it lands here.")
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(spacing: 0) {
                    ForEach(products) { product in
                        SavedRow(product: product) { remove(product) }
                        if product.id != products.last?.id {
                            Rectangle().fill(theme.scheme.border).frame(height: 1)
                        }
                    }
                }
            }
        } else if let errorMessage {
            VStack(alignment: .leading, spacing: 8) {
                Text(errorMessage)
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Try again") { Task { await load() } }
                    .font(.custom(Typeface.sansSemiBold, size: 13))
                    .foregroundStyle(theme.scheme.accent)
            }
        } else {
            ProgressView()
                .tint(theme.scheme.accent)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
        }
    }

    // MARK: - Actions

    private func load() async {
        errorMessage = nil
        do {
            // Two databases now: which slugs are saved is private, and what
            // those products *are* is public. The join happens here because
            // CloudKit cannot reference across databases.
            async let slugTask = app.store.savedSlugs()
            async let catalogTask = app.content.getTrends(businessId: nil)
            let (slugs, catalog) = try await (slugTask, catalogTask)

            let shelf = catalog.products
                .filter { slugs.contains($0.slug) }
                .map { product -> DiscoverProduct in
                    var saved = product
                    saved.saved = true
                    return saved
                }
            products = shelf
            count = shelf.count
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Optimistic, like the heart in Discover: the row leaves immediately and
    /// comes back if the write fails.
    ///
    /// Restoring by index is safe here in a way it is not in the feed — this
    /// list is ordered by when things were saved and nothing re-sorts under it,
    /// so the row goes back exactly where it was rather than to the end.
    private func remove(_ product: DiscoverProduct) {
        guard let index = products?.firstIndex(where: { $0.id == product.id }) else { return }
        withAnimation(.easeInOut(duration: 0.18)) { products?.remove(at: index) }
        count = products?.count

        Task {
            do {
                try await app.store.unsaveTrend(slug: product.id)
            } catch {
                // Built as a whole list and assigned, rather than mutating in
                // place — `products?.insert(_:at:)` with a bound read of
                // `products` in its own argument is an overlapping access.
                var restored = products ?? []
                restored.insert(product, at: min(index, restored.count))
                withAnimation(.easeInOut(duration: 0.18)) { products = restored }
                count = restored.count
            }
        }
    }
}

// MARK: - Row

/// One shelf entry: the photo, what it is, what it costs to source and what it
/// sells for. The same three facts the Discover card leads with, because this
/// is the same product seen later.
private struct SavedRow: View {
    @Environment(\.theme) private var theme
    let product: DiscoverProduct
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            thumbnail
            VStack(alignment: .leading, spacing: 2) {
                Text(product.title)
                    .font(.custom(Typeface.sansSemiBold, size: 15))
                    .foregroundStyle(theme.scheme.text)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                Text(secondary)
                    .font(.custom(Typeface.sansMedium, size: 12))
                    .foregroundStyle(theme.scheme.textSecondary)
                economics
            }
            Spacer(minLength: 0)
            Button(action: onRemove) {
                Icon(name: .x, size: 12, color: theme.scheme.textSecondary)
                    .padding(7)
                    .background(theme.scheme.backgroundSelected, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(product.title) from saved")
        }
        .padding(.vertical, 10)
    }

    private var thumbnail: some View {
        ZStack {
            theme.scheme.accentSoft
            if let raw = product.imageUrl, let url = URL(string: raw) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        Color.clear
                    }
                }
            }
        }
        .frame(width: 54, height: 54)
        .clipShape(RoundedRectangle(cornerRadius: Radius.field, style: .continuous))
    }

    /// Niche and when it was saved, on one quiet line. The date is the one thing
    /// this shelf knows that the Discover card does not, and on a list you came
    /// back to in order to triage it is the useful half.
    private var secondary: String {
        let niche = product.niche?.name
        let saved = Self.savedLabel(product.savedAt)
        return [niche, saved].compactMap { $0 }.joined(separator: " · ")
    }

    private static func savedLabel(_ date: Date?) -> String? {
        guard let days = Elapsed.days(since: date) else { return nil }
        if days <= 0 { return "saved today" }
        if days == 1 { return "saved yesterday" }
        return "saved \(days) days ago"
    }

    @ViewBuilder private var economics: some View {
        if product.sourceCost != nil || product.typicalResale != nil {
            HStack(spacing: 5) {
                if let cost = product.sourceCost {
                    Text(cost).foregroundStyle(theme.scheme.textSecondary)
                }
                if product.sourceCost != nil && product.typicalResale != nil {
                    Text("→").foregroundStyle(theme.scheme.textSecondary)
                }
                if let resale = product.typicalResale {
                    Text(resale).foregroundStyle(theme.scheme.text)
                }
            }
            .font(.custom(Typeface.sansSemiBold, size: 13))
            .monospacedDigit()
            .padding(.top, 1)
        }
    }
}
