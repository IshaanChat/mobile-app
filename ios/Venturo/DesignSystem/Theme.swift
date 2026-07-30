import SwiftUI

// Venturo's design system, ported from the prototype at server/scripts/preview-app.ts.
//
// The prototype is the source of truth for how this app looks. These values are
// read out of its CSS custom properties, not invented here, so when the two
// disagree the prototype wins and this file is what changes.

// MARK: - Colour

/// The palette. Light is "the artisan" — blush cream and violet, honey and sage.
/// Dark is "the grind" — warm charcoal and lavender, deliberately not techy navy.
///
/// ---------------------------------------------------------------------------
/// The accent is two lightnesses of one hue (~264°), and it has to be.
///
/// The app icon is a lavender V, so the accent is purple. But the icon's own
/// lavender cannot be the light-mode accent — against the blush-cream
/// background it measures 1.64:1, and white text on it is 1.78:1. Both need
/// 4.5:1. It is legible only on the dark ground it was drawn for, where it
/// reaches 10.99:1.
///
///   light  #6E4EAB   5.78:1 on cream · white on it 6.29:1
///   dark   #D0B8F0  10.99:1 on charcoal · #1A1024 on it 10.32:1
///
/// Both are sampled from Resources/logo.png rather than chosen: the V's
/// dominant colour across 130k pixels is #D0B8F0, and the violet is that same
/// hue darkened until it clears 4.5 on cream.
///
/// Worth knowing: the dusty rose this replaced only ever reached 3.56:1 as a
/// text colour, so light mode became *more* legible, not less.
/// ---------------------------------------------------------------------------
enum Palette {
    struct Scheme {
        let text: Color
        let background: Color
        /// Cards and elevated surfaces.
        let backgroundElement: Color
        /// Inputs, inset blocks, selected rows.
        let backgroundSelected: Color
        let textSecondary: Color
        let accent: Color
        /// Text drawn *on* the accent.
        let accentText: Color
        /// The accent at low opacity — chip fills, soft highlights.
        let accentSoft: Color
        let danger: Color
        let success: Color
        let border: Color
        /// The three relationship-journey stages, used everywhere the CRM appears.
        let prospect: Color
        let engaged: Color
        let customer: Color
        let shadow: Color
    }

    static let light = Scheme(
        text: Color(hex: 0x34262B),
        background: Color(hex: 0xFBF4F0),
        backgroundElement: Color(hex: 0xFFFFFF),
        backgroundSelected: Color(hex: 0xF8EDE8),
        textSecondary: Color(hex: 0x98818A),
        accent: Color(hex: 0x6E4EAB),
        accentText: Color(hex: 0xFFFFFF),
        accentSoft: Color(hex: 0x6E4EAB, alpha: 0.10),
        danger: Color(hex: 0xCC4F4F),
        success: Color(hex: 0x5F9B7A),
        border: Color(hex: 0xEEDBD4),
        prospect: Color(hex: 0xA3919A),
        engaged: Color(hex: 0xCF8F2E),
        customer: Color(hex: 0x5F9B7A),
        // Warm, not neutral grey — a cool shadow reads as dirt on this palette.
        shadow: Color(hex: 0x5A323C, alpha: 0.07)
    )

    static let dark = Scheme(
        text: Color(hex: 0xEDEEF2),
        background: Color(hex: 0x0B0C0F),
        backgroundElement: Color(hex: 0x14161B),
        backgroundSelected: Color(hex: 0x1B1E25),
        textSecondary: Color(hex: 0x8B92A0),
        accent: Color(hex: 0xD0B8F0),
        // Near-black, not white: white on this lavender is 1.78:1.
        accentText: Color(hex: 0x1A1024),
        accentSoft: Color(hex: 0xD0B8F0, alpha: 0.14),
        danger: Color(hex: 0xE5484D),
        success: Color(hex: 0x34C477),
        border: Color(hex: 0x262A33),
        prospect: Color(hex: 0x79808F),
        engaged: Color(hex: 0x5B9CF0),
        customer: Color(hex: 0x34C477),
        shadow: Color(hex: 0x000000, alpha: 0.45)
    )

    /// The app icon's background. Not a theme colour — it is the one value that
    /// must match the artwork exactly, and it is why the icon and dark mode sit
    /// together without adjustment: this measures 1.03 against dark `background`.
    static let brandDark = Color(hex: 0x120E1B)
}

/// Reads the palette for the current appearance.
///
/// A struct rather than `Color(UIColor { traits in ... })` dynamic colours,
/// because the semantic names are the point — `theme.textSecondary` says what it
/// is for, where a dynamic colour named `grey` does not.
struct Theme {
    let scheme: Palette.Scheme

    init(_ colorScheme: ColorScheme) {
        scheme = colorScheme == .dark ? Palette.dark : Palette.light
    }
}

private struct ThemeKey: EnvironmentKey {
    static let defaultValue = Theme(.light)
}

extension EnvironmentValues {
    var theme: Theme {
        get { self[ThemeKey.self] }
        set { self[ThemeKey.self] = newValue }
    }
}

extension View {
    /// Installs the palette for the current appearance. Apply once, at the root.
    func venturoTheme(_ colorScheme: ColorScheme) -> some View {
        environment(\.theme, Theme(colorScheme))
    }
}

// MARK: - Type

/// The three families.
///
/// Every weight is its own PostScript name — these were read out of the TTF
/// name tables rather than guessed, because iOS resolves fonts by internal name
/// and a wrong one falls back to the system font *silently*. That failure looks
/// like "the design is slightly off" rather than like an error, which is the
/// worst way for it to fail.
///
/// Never pair these with `.fontWeight()`. Asking for a weight the family does
/// not ship gets you a synthesised approximation, which is what the RN app did
/// by accident for its whole life.
enum Typeface {
    static let displayRegular = "Fraunces-Regular"
    static let display = "Fraunces-SemiBold"
    static let sans = "PlusJakartaSans-Regular"
    static let sansMedium = "PlusJakartaSans-Medium"
    static let sansSemiBold = "PlusJakartaSans-SemiBold"
    static let sansBold = "PlusJakartaSans-Bold"
    /// The logotype, and nothing else in the app, ever.
    static let wordmark = "Baloo2-Medium"
}

/// The type ramp.
///
/// The rule, carried over verbatim from the prototype: **the serif is for single
/// moments** — a screen title, one question, one big number. Repeated down a
/// feed Fraunces gets heavy, so card titles and section headings stay sans. That
/// is why `title` and `subtitle` are the only display styles here and everything
/// else is Jakarta, despite `body` and `small` being by far the most used.
struct TextStyle {
    let name: String
    let size: CGFloat
    let lineHeight: CGFloat
    let tracking: CGFloat

    var font: Font { .custom(name, size: size) }

    /// SwiftUI's `lineSpacing` is the gap *between* lines, where CSS
    /// `line-height` is the whole box. The font size has to come off first or
    /// every multi-line block is one line-height too tall.
    var lineSpacing: CGFloat { max(0, lineHeight - size) }

    /// Fraunces 48/52, −0.7. Screen-defining numbers only.
    static let title = TextStyle(
        name: Typeface.display, size: 48, lineHeight: 52, tracking: -0.7)
    /// Fraunces 32/44, −0.5. Screen titles, onboarding questions.
    static let subtitle = TextStyle(
        name: Typeface.display, size: 32, lineHeight: 44, tracking: -0.5)
    /// Jakarta Medium 16/24. The default.
    static let body = TextStyle(
        name: Typeface.sansMedium, size: 16, lineHeight: 24, tracking: 0)
    /// Jakarta Medium 14/20.
    static let small = TextStyle(
        name: Typeface.sansMedium, size: 14, lineHeight: 20, tracking: 0)
    /// Jakarta Bold 14/20.
    static let smallBold = TextStyle(
        name: Typeface.sansBold, size: 14, lineHeight: 20, tracking: 0)
    /// Jakarta SemiBold 15. Card titles.
    static let cardTitle = TextStyle(
        name: Typeface.sansSemiBold, size: 15, lineHeight: 20, tracking: -0.33)
    /// Jakarta Bold 12, +0.8. Uppercase at the call site.
    static let sectionHeading = TextStyle(
        name: Typeface.sansBold, size: 12, lineHeight: 16, tracking: 0.8)
    /// Jakarta Bold 11, +0.8. Uppercase at the call site.
    static let kicker = TextStyle(
        name: Typeface.sansBold, size: 11, lineHeight: 14, tracking: 0.8)

    /// The logotype. `lineHeight` is pinned deliberately: Baloo ships tall
    /// ascender metrics and the line box reserves ~8pt for glyphs that are not
    /// in the word "Venturo", which inflates the top bar if left to default.
    static let wordmark = TextStyle(
        name: Typeface.wordmark, size: 25, lineHeight: 28, tracking: 0)
}

extension View {
    /// Applies a style from the ramp.
    func textStyle(_ style: TextStyle) -> some View {
        font(style.font)
            .tracking(style.tracking)
            .lineSpacing(style.lineSpacing)
    }
}

// MARK: - Space, radius, elevation

/// The 7-step scale. Named, not arbitrary — the prototype has no named scale and
/// its de-facto values collapse cleanly onto these.
enum Space {
    static let half: CGFloat = 2
    static let one: CGFloat = 4
    static let two: CGFloat = 8
    static let three: CGFloat = 16
    static let four: CGFloat = 24
    static let five: CGFloat = 32
    static let six: CGFloat = 64
}

enum Radius {
    /// Cards.
    static let card: CGFloat = 16
    /// Mini blocks, inset panels, banners.
    static let inset: CGFloat = 12
    /// Text fields.
    static let field: CGFloat = 10
    /// The brand mark square.
    static let mark: CGFloat = 9
    /// The journey sheet's top corners.
    static let sheet: CGFloat = 22
}

extension View {
    /// The one elevation token, on every raised surface.
    ///
    /// CSS `blur: 12` is roughly SwiftUI `radius: 6` — CSS blur is a diameter,
    /// SwiftUI's radius is not.
    ///
    /// Note this is a real departure from the React Native app, which shipped no
    /// shadows at all and used 1pt borders everywhere instead. The prototype
    /// uses shadows, and the prototype is what we are building.
    func cardElevation(_ theme: Theme) -> some View {
        shadow(color: theme.scheme.shadow, radius: 6, x: 0, y: 2)
    }
}

// MARK: - Helpers

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

#if DEBUG
/// Proves the fonts are actually registered.
///
/// Worth having as a first run: a missing `UIAppFonts` entry, or a PostScript
/// name that does not match the file's internal name, falls back to the system
/// font *silently*. That reads as "the design is a bit off" rather than as an
/// error, and it can survive a long time unnoticed.
struct FontRegistrationCheck: View {
    private let expected = [
        Typeface.display, Typeface.displayRegular,
        Typeface.sans, Typeface.sansMedium, Typeface.sansSemiBold, Typeface.sansBold,
        Typeface.wordmark,
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: Space.two) {
            ForEach(expected, id: \.self) { name in
                let registered = UIFont(name: name, size: 17) != nil
                HStack(spacing: Space.two) {
                    Text(registered ? "✓" : "✗").foregroundStyle(registered ? .green : .red)
                    Text(name).font(.custom(name, size: 17))
                    Spacer()
                    if !registered { Text("NOT REGISTERED").font(.caption).foregroundStyle(.red) }
                }
            }
        }
        .padding(Space.three)
    }
}

#Preview("Fonts") { FontRegistrationCheck() }
#endif
