import SwiftUI

/// A Discover card: photo, who it suits, what it costs, what it sells for.
///
/// Collapsed it is a hero with chips, a kicker, a title and the economics on
/// one line. Tapping expands the detail in place rather than pushing a screen —
/// browsing a feed and reading one entry are the same activity here, and a
/// navigation push would make them feel like different ones.
struct ProductCard: View {
    @Environment(\.theme) private var theme
    @Environment(\.openURL) private var openURL

    let product: DiscoverProduct
    /// Hotness at or above which the Hot badge shows. Computed by the feed as a
    /// percentile of what is loaded, so it cannot be decided card by card.
    let hotFloor: Int
    /// Highlighted because it matches what the user said they were into.
    var matched: Bool = false
    let onToggleSave: () -> Void

    @State private var isExpanded = false

    private var isHot: Bool { product.hotness >= hotFloor }

    var body: some View {
        Card(matched: matched) {
            VStack(alignment: .leading, spacing: 0) {
                hero
                body_
                if isExpanded { expanded }
            }
        }
    }

    // MARK: - Hero

    /// The hero takes the shape of the image inside it, so `fill` has nothing
    /// left to crop.
    ///
    /// One fixed height cannot serve both sources: supplier catalogues shoot
    /// square, and the curated Pexels images are 1200x627. A single band sliced
    /// the top and bottom off every sourced product *and* trimmed the
    /// landscapes. 5:4 rather than a true square because supplier photos centre
    /// the product inside empty margin — trimming takes that padding off evenly
    /// and leaves the product untouched.
    private var aspectRatio: CGFloat {
        let url = product.imageUrl ?? ""
        let isSupplierCDN = ["aliexpress-media.com", "cdn.printful.com", "alicdn.com"]
            .contains { url.range(of: $0, options: .caseInsensitive) != nil }
        return isSupplierCDN ? 5.0 / 4.0 : 1200.0 / 627.0
    }

    private var hero: some View {
        ZStack {
            // Tinted rather than grey. An empty frame reads as a failed load;
            // a tinted panel reads as a choice.
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
        .aspectRatio(aspectRatio, contentMode: .fit)
        .frame(maxWidth: .infinity)
        .clipped()
        .overlay(alignment: .topLeading) {
            if isHot { HotBadge().padding(14) }
        }
        .overlay(alignment: .topTrailing) {
            saveButton.padding(14)
        }
        .overlay(alignment: .bottomLeading) {
            HStack(spacing: 8) {
                HeroChip(
                    label: AudienceColor.label(for: product.niche?.audience),
                    background: AudienceColor.background(for: product.niche?.audience)
                )
                if let sourcing = SourcingLabel.text(for: product.sourcingType) {
                    HeroChip(label: sourcing)
                }
            }
            .padding(14)
        }
        .overlay(alignment: .bottomTrailing) {
            // Evidence first, attribution under it. Both are bottom-right
            // because the left is already carrying the audience and sourcing
            // chips, and stacking keeps the credit subordinate to the measured
            // fact rather than competing with it.
            VStack(alignment: .trailing, spacing: 4) {
                evidenceStrip
                ImageAttribution(credit: product.imageCredit)
            }
            .padding(14)
        }
        .contentShape(Rectangle())
        .onTapGesture { withAnimation(.easeInOut(duration: 0.18)) { isExpanded.toggle() } }
    }

    private var saveButton: some View {
        Button(action: onToggleSave) {
            Icon(name: .heart, size: 17, color: .white, filled: product.saved)
                .padding(8)
                .background(Color(hex: 0x141012, alpha: 0.55), in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(product.saved ? "Remove from saved" : "Save this product")
    }

    /// The card's only measured facts. Deliberately bottom-right and away from
    /// the Hot badge — an earlier layout put a decorative label directly over
    /// the one piece of hard evidence the card had.
    @ViewBuilder private var evidenceStrip: some View {
        if let evidence = product.evidence {
            HStack(spacing: 6) {
                if let sold = evidence.unitsSold {
                    EvidenceChip(text: "▲ \(sold) sold", tone: .rising)
                }
                if let days = evidence.adDaysLive {
                    EvidenceChip(text: "\(days)d live", tone: .fresh)
                }
            }
        }
    }

    // MARK: - Body

    private var body_: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 0) {
                if let niche = product.niche {
                    Text(niche.name.uppercased())
                        .font(.custom(Typeface.sansSemiBold, size: 11))
                        .tracking(0.4)
                        .foregroundStyle(theme.scheme.textSecondary)
                }
                Text(product.title)
                    .font(.custom(Typeface.sansSemiBold, size: 18))
                    .tracking(-0.4)
                    .foregroundStyle(theme.scheme.text)
                    .padding(.top, 2)
                economics.padding(.top, 5)
            }
            Spacer(minLength: 0)
            Icon(name: .chev, size: 12, color: theme.scheme.textSecondary, rotate: isExpanded ? 180 : 0)
                .padding(.top, 4)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .contentShape(Rectangle())
        .onTapGesture { withAnimation(.easeInOut(duration: 0.18)) { isExpanded.toggle() } }
    }

    /// Cost and resale on one line. Tabular figures so the arrow between them
    /// sits at the same place down a scrolling feed instead of wandering.
    @ViewBuilder private var economics: some View {
        if product.sourceCost != nil || product.typicalResale != nil {
            HStack(spacing: 6) {
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
            .font(.custom(Typeface.sansSemiBold, size: 14))
            .monospacedDigit()
        }
    }

    // MARK: - Expanded

    private var expanded: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(product.blurb)
                .font(.custom(Typeface.sans, size: 14))
                .lineSpacing(8.4) // 1.6 line-height at 14pt
                .foregroundStyle(theme.scheme.text)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)

            if let sourceName = product.sourceName {
                MiniBlock {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Where to source")
                            .font(.custom(Typeface.sansSemiBold, size: 12))
                            .foregroundStyle(theme.scheme.textSecondary)
                        Text(sourceName)
                            .font(.custom(Typeface.sansMedium, size: 15))
                            .foregroundStyle(theme.scheme.text)
                    }
                }
                .padding(.top, 12)
            }

            if let raw = product.sourcingUrl, let url = URL(string: raw) {
                GhostButton(label: "Source it") { openURL(url) }
                    .padding(.top, 12)
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
        .transition(.opacity)
    }
}
