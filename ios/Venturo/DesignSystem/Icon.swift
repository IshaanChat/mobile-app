import SwiftUI

/// The drawn icon set, ported one-for-one from the prototype's SVG symbols.
///
/// The point of a hand-drawn set over SF Symbols is that it reads as a *set*:
/// one stroke weight, round caps and joins, no fills. Apple's symbols are drawn
/// to Apple's rules rather than ours, and mixing them in makes the chrome look
/// assembled instead of designed. Same reason there is no emoji anywhere in it.
///
/// The path strings are byte-identical to the prototype's. They are parsed at
/// draw time rather than transcribed into `Path` calls, so a glyph cannot drift
/// from the design it came from.
enum IconName: String, CaseIterable {
    case compass, sprout, chart, user, x, chev, check, plus, out, flame
    case heart, trophy, lock, sliders, link, book, note, shop, tag, spark
}

struct Icon: View {
    let name: IconName
    var size: CGFloat = 22
    var color: Color
    /// Overrides the size-derived weight. The active tab draws at 2 to feel
    /// pressed rather than merely coloured.
    var strokeWidth: CGFloat? = nil
    /// Only `heart` fills, and only to show something is on the shelf.
    var filled: Bool = false
    /// Degrees. `chev` uses it to point down when a card is open.
    var rotate: Double = 0

    var body: some View {
        Canvas { context, canvasSize in
            let rect = CGRect(origin: .zero, size: canvasSize)
            let weight = strokeWidth ?? Self.weight(for: size)
            let shape = Icon.shape(for: name)

            if filled, let fillPath = shape.fillPath {
                context.fill(SVGPath.parse(fillPath, in: rect), with: .color(color))
            }
            for d in shape.strokes {
                context.stroke(
                    SVGPath.parse(d, in: rect),
                    with: .color(color),
                    style: StrokeStyle(lineWidth: weight, lineCap: .round, lineJoin: .round)
                )
            }
            for circle in shape.circles {
                let scale = min(rect.width, rect.height) / 24
                let box = CGRect(
                    x: (circle.cx - circle.r) * scale,
                    y: (circle.cy - circle.r) * scale,
                    width: circle.r * 2 * scale,
                    height: circle.r * 2 * scale
                )
                context.stroke(
                    Path(ellipseIn: box),
                    with: .color(color),
                    style: StrokeStyle(lineWidth: weight, lineCap: .round, lineJoin: .round)
                )
            }
            for r in shape.rects {
                let scale = min(rect.width, rect.height) / 24
                let box = CGRect(
                    x: r.x * scale, y: r.y * scale,
                    width: r.width * scale, height: r.height * scale
                )
                context.stroke(
                    Path(roundedRect: box, cornerRadius: r.radius * scale),
                    with: .color(color),
                    style: StrokeStyle(lineWidth: weight, lineCap: .round, lineJoin: .round)
                )
            }
        }
        .frame(width: size, height: size)
        .rotationEffect(.degrees(rotate))
        .accessibilityHidden(true)
    }

    /// Stroke weight steps rather than scaling smoothly.
    ///
    /// A hairline that looks right at tab size goes invisible inline with text,
    /// so the smaller the icon the heavier it draws. Three steps, matching the
    /// prototype exactly — a continuous ratio looks correct in theory and wrong
    /// on screen.
    static func weight(for size: CGFloat) -> CGFloat {
        if size <= 13 { return 2.0 }
        if size <= 16 { return 1.9 }
        return 1.7
    }

    // MARK: - Geometry

    struct Circle { let cx, cy, r: CGFloat }
    struct Rect { let x, y, width, height, radius: CGFloat }

    struct Shape {
        var strokes: [String] = []
        var circles: [Circle] = []
        var rects: [Rect] = []
        /// Only set where the glyph has a fillable body.
        var fillPath: String? = nil
    }

    static func shape(for name: IconName) -> Shape {
        switch name {
        case .compass:
            return Shape(
                strokes: ["M15.6 8.4l-2 5.2-5.2 2 2-5.2z"],
                circles: [Circle(cx: 12, cy: 12, r: 9)]
            )
        case .sprout:
            return Shape(strokes: [
                "M12 21v-7",
                "M12 14c0-3.3-2.7-6-6-6H4c0 3.3 2.7 6 6 6z",
                "M12 12c0-3.3 2.7-6 6-6h2c0 3.3-2.7 6-6 6z",
            ])
        case .chart:
            return Shape(strokes: ["M4 20V10", "M10 20V4", "M16 20v-6", "M22 20H2"])
        case .user:
            return Shape(
                strokes: ["M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"],
                circles: [Circle(cx: 12, cy: 8, r: 3.6)]
            )
        case .x:
            return Shape(strokes: ["M6 6l12 12M18 6L6 18"])
        case .chev:
            return Shape(strokes: ["M6 9l6 6 6-6"])
        case .check:
            return Shape(strokes: ["M5 13l4.5 4.5L19 7"])
        case .plus:
            return Shape(strokes: ["M12 5v14M5 12h14"])
        case .out:
            return Shape(strokes: ["M8 16L16 8", "M9 8h7v7"])
        case .flame:
            return Shape(strokes: [
                "M12 21c3.6 0 6-2.4 6-5.6 0-4.2-4.4-5.6-3.4-10.4C11.4 6 9 8.4 9 11c0-1.2-.6-2.2-1.4-2.8C6.6 9.6 6 11.6 6 13.8 6 18 8.4 21 12 21z"
            ])
        case .heart:
            let d = "M12 20s-7-4.4-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.6-7 9-7 9z"
            return Shape(strokes: [d], fillPath: d)
        case .trophy:
            return Shape(strokes: [
                "M8 4h8v5a4 4 0 01-8 0z",
                "M8 5H5v2a3 3 0 003 3",
                "M16 5h3v2a3 3 0 01-3 3",
                "M12 13v4M9 20h6",
            ])
        case .lock:
            return Shape(
                strokes: ["M8.5 11V8a3.5 3.5 0 017 0v3"],
                rects: [Rect(x: 5, y: 11, width: 14, height: 9, radius: 2)]
            )
        case .sliders:
            return Shape(
                strokes: ["M4 7h11M19 7h1M4 17h4M12 17h8"],
                circles: [Circle(cx: 17, cy: 7, r: 2), Circle(cx: 10, cy: 17, r: 2)]
            )
        case .link:
            return Shape(strokes: [
                "M10 13.5a3.5 3.5 0 005 0l3-3a3.5 3.5 0 00-5-5l-1 1",
                "M14 10.5a3.5 3.5 0 00-5 0l-3 3a3.5 3.5 0 005 5l1-1",
            ])
        case .book:
            return Shape(strokes: ["M5 4h9a3 3 0 013 3v13H8a3 3 0 01-3-3z", "M5 17h12"])
        case .note:
            return Shape(
                circles: [Circle(cx: 12, cy: 12, r: 2.4)],
                rects: [Rect(x: 3, y: 7, width: 18, height: 10, radius: 2)]
            )
        case .shop:
            return Shape(strokes: ["M4 9h16l-1 11H5z", "M8.5 9V6.5a3.5 3.5 0 017 0V9"])
        case .tag:
            return Shape(
                strokes: ["M4 11V5h6l9 9-6 6z"],
                circles: [Circle(cx: 7.8, cy: 8.2, r: 1.1)]
            )
        case .spark:
            return Shape(strokes: [
                "M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z",
                "M18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z",
            ])
        }
    }
}

#if DEBUG
/// Every glyph at the three real sizes.
///
/// Worth looking at as a sheet rather than in isolation: the set has to read as
/// one hand, and a glyph that is subtly off-weight or off-centre only shows up
/// next to its neighbours.
struct IconSheet: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = Theme(colorScheme)
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 92))], spacing: Space.four) {
                ForEach(IconName.allCases, id: \.self) { name in
                    VStack(spacing: Space.two) {
                        HStack(alignment: .bottom, spacing: Space.two) {
                            Icon(name: name, size: 22, color: theme.scheme.text)
                            Icon(name: name, size: 16, color: theme.scheme.text)
                            Icon(name: name, size: 13, color: theme.scheme.text)
                        }
                        .frame(height: 26)
                        Text(name.rawValue)
                            .textStyle(.kicker)
                            .foregroundStyle(theme.scheme.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Space.two)
                    .background(theme.scheme.backgroundElement, in: RoundedRectangle(cornerRadius: Radius.inset))
                }
            }
            .padding(Space.three)
        }
        .background(theme.scheme.background)
    }
}

#Preview("Icons — light") { IconSheet().preferredColorScheme(.light) }
#Preview("Icons — dark") { IconSheet().preferredColorScheme(.dark) }
#endif
