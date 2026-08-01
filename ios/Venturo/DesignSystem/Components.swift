import SwiftUI

// The shared pieces every screen is built from, ported from the prototype's
// CSS. Values here are copied, not approximated — the padding, radii and type
// sizes are the design, and rounding them to "nice" numbers is how a port
// stops looking like the thing it was ported from.

// MARK: - Card

/// The feed's basic surface: panel fill, hairline border, 16pt radius, one
/// shadow. Clips its contents so a hero image takes the card's corners.
struct Card<Content: View>: View {
    @Environment(\.theme) private var theme
    /// A card matched to the user's interests gets an accent border. In CSS
    /// this is `box-shadow: 0 0 0 1px accent` *plus* the normal shadow — a
    /// second ring rather than a thicker border, so the card does not shift.
    var matched: Bool = false
    @ViewBuilder var content: Content

    var body: some View {
        content
            .background(theme.scheme.backgroundElement)
            .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                    .strokeBorder(
                        matched ? theme.scheme.accent : theme.scheme.border,
                        lineWidth: matched ? 1.5 : 1
                    )
            }
            .cardElevation(theme)
    }
}

// MARK: - Chips

/// A chip laid over a hero image. Always white text — these sit on photographs,
/// so they carry their own background rather than relying on the theme.
struct HeroChip: View {
    let label: String
    /// Nil gives the dark translucent treatment used for secondary chips.
    var background: Color? = nil

    var body: some View {
        Text(label)
            .font(.custom(background == nil ? Typeface.sansMedium : Typeface.sansSemiBold, size: 12))
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(background ?? Color.black.opacity(0.55), in: Capsule())
    }
}

/// A filter chip. Tapping the active one clears it, so there is always a way
/// back to the whole feed without hunting for an "All" that does not exist.
struct FilterChip: View {
    @Environment(\.theme) private var theme
    let label: String
    let isOn: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.custom(isOn ? Typeface.sansBold : Typeface.sansMedium, size: 13))
                .foregroundStyle(isOn ? theme.scheme.text : theme.scheme.textSecondary)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(isOn ? theme.scheme.accentSoft : .clear, in: Capsule())
                .overlay {
                    Capsule().strokeBorder(isOn ? theme.scheme.accent : theme.scheme.border, lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isOn ? [.isSelected] : [])
    }
}

// MARK: - Badges

/// The Hot badge.
///
/// A gradient rather than the flat accent, and deliberately: this is the one
/// element on the card that is *not* brand-coloured. It reads as temperature,
/// which is what it means, and it stays legible over any photograph. The React
/// Native app flattened it to the accent colour and lost that.
struct HotBadge: View {
    var body: some View {
        HStack(spacing: 4) {
            Icon(name: .flame, size: 12, color: .white)
            Text("Hot")
                .font(.custom(Typeface.sansBold, size: 11))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(
            LinearGradient(
                colors: [Color(hex: 0xFF8A3D), Color(hex: 0xE3452B)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            ),
            in: Capsule()
        )
        .shadow(color: Color(hex: 0xE3452B, alpha: 0.38), radius: 4, y: 2)
    }
}

/// The High upside badge: early demand with the margin still intact.
///
/// A different claim from a high score, and from Hot. Hot means the product is
/// already moving; upside means it is early and the margin has not been
/// competed away yet. `sourcing.ts` picks the two tiers separately so a
/// strong-but-late product cannot crowd out an early one, and a card can
/// legitimately carry both badges — which is the strongest thing the feed can
/// say about a product.
///
/// Purple rather than the accent, because in dark mode the accent *is* a
/// lavender and the badge would disappear into the brand instead of reading as
/// a mark on the card.
struct UpsideBadge: View {
    var body: some View {
        HStack(spacing: 4) {
            Icon(name: .spark, size: 12, color: .white)
            Text("High upside")
                .font(.custom(Typeface.sansBold, size: 11))
                .tracking(0.33)
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(
            LinearGradient(
                colors: [Color(hex: 0x6F6BD8), Color(hex: 0x8F5FD6)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            ),
            in: Capsule()
        )
        .shadow(color: Color(hex: 0x6F6BD8, alpha: 0.36), radius: 4, y: 2)
    }
}

/// An evidence chip — the card's only piece of hard measured data.
///
/// Sits bottom-right of the hero on a near-opaque white pill so it stays
/// readable over any image. Kept visually distinct from the brand chips because
/// it is the one thing on the card that is measured rather than written.
struct EvidenceChip: View {
    let text: String
    var tone: Tone = .neutral

    enum Tone {
        case neutral, rising, fresh
        var color: Color {
            switch self {
            case .neutral: return Color(hex: 0x7A4A2A)
            case .rising: return Color(hex: 0x8A3A1A)
            case .fresh: return Color(hex: 0x3D6B52)
            }
        }
    }

    var body: some View {
        Text(text)
            .font(.custom(Typeface.sansBold, size: 11))
            .foregroundStyle(tone.color)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(Color.white.opacity(0.92), in: Capsule())
    }
}

// MARK: - Attribution

/// The photographer's credit, over the bottom of an image.
///
/// Every curated photograph in the app is somebody's work, and the name was
/// captured when the image was fetched. Pexels does not legally require the
/// credit be shown — but holding a name and choosing not to print it is a
/// decision, not an oversight, and this is the cheap side of that decision.
///
/// Deliberately quiet: small, low-contrast, and at the very bottom edge, so it
/// reads as a footnote on the photograph rather than as a label competing with
/// the card's own content. It is there for the person who looks, not for
/// everyone else.
///
/// Supplier product shots carry no credit and get nothing — those arrive with
/// the affiliate arrangement rather than from a photographer.
struct ImageAttribution: View {
    let credit: String?

    var body: some View {
        if let credit, !credit.trimmingCharacters(in: .whitespaces).isEmpty {
            Text(credit)
                .font(.custom(Typeface.sansMedium, size: 9.5))
                .foregroundStyle(.white.opacity(0.72))
                .lineLimit(1)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.black.opacity(0.32), in: Capsule())
                .accessibilityLabel("Photograph by \(credit)")
        }
    }
}

// MARK: - Section heading

/// The shelf label above each group in the feed.
struct SectionHeading: View {
    @Environment(\.theme) private var theme
    let title: String

    var body: some View {
        Text(title.uppercased())
            .font(.custom(Typeface.sansBold, size: 12))
            .tracking(1.2)
            .foregroundStyle(theme.scheme.textSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 22)
            .padding(.bottom, 10)
    }
}

// MARK: - Inset block

/// The pale inset panel used for "where to source" and similar asides.
struct MiniBlock<Content: View>: View {
    @Environment(\.theme) private var theme
    @ViewBuilder var content: Content

    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(theme.scheme.backgroundSelected, in: RoundedRectangle(cornerRadius: Radius.inset, style: .continuous))
    }
}

// MARK: - Buttons

struct PrimaryButton: View {
    @Environment(\.theme) private var theme
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.custom(Typeface.sansSemiBold, size: 14))
                .foregroundStyle(theme.scheme.accentText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(theme.scheme.accent, in: RoundedRectangle(cornerRadius: Radius.inset, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct GhostButton: View {
    @Environment(\.theme) private var theme
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(label)
                    .font(.custom(Typeface.sansSemiBold, size: 14))
                Icon(name: .out, size: 14, color: theme.scheme.text)
            }
            .foregroundStyle(theme.scheme.text)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .background(theme.scheme.backgroundSelected, in: RoundedRectangle(cornerRadius: Radius.inset, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Audience colours

/// Deliberately deepened from the palette's own tones because these carry white
/// text over photographs, where the lighter versions fail to hold.
enum AudienceColor {
    static func background(for audience: String?) -> Color {
        switch audience {
        case "maker": return Color(hex: 0x4A7C61)
        case "reseller": return Color(hex: 0x8C5E15)
        case "both": return Color(hex: 0xA8536C)
        default: return Color(hex: 0x60646C)
        }
    }

    /// Follows the badge, not the raw value: `both` shows as Maker, so a filter
    /// on Maker must include it or the card contradicts the list it sits in.
    static func label(for audience: String?) -> String {
        audience == "reseller" ? "Seller" : "Maker"
    }
}

enum SourcingLabel {
    static func text(for type: String?) -> String? {
        switch type {
        case "DROPSHIP": return "Dropship"
        case "WHOLESALE": return "Wholesale"
        case "PRINT_ON_DEMAND": return "Print on demand"
        case "MATERIALS": return "Materials"
        case "MAKE_YOUR_OWN": return "Make your own"
        default: return nil
        }
    }
}

/// The Venturo mark — the same art as the app icon, so the tile in the top bar
/// and the one on the home screen are recognisably the same object.
///
/// An image rather than an `Icon`: the V is a drawn logotype with a gradient
/// along each stroke, and the icon set carries flat single-colour paths. It
/// also means the mark never picks up the theme's accent, which is correct —
/// a logo that changes colour between light and dark is two logos.
struct BrandMark: View {
    let size: CGFloat

    var body: some View {
        Image("BrandMark")
            .resizable()
            .interpolation(.high)
            .scaledToFill()
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.33, style: .continuous))
            .accessibilityHidden(true)
    }
}

extension String {
    /// Nil where an empty string would render as a blank line. The profile's
    /// email is optional and usually empty, and "" is not the same as absent
    /// when something downstream is choosing a fallback.
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
