import SwiftUI

/// Turns an SVG path `d` string into a SwiftUI `Path`.
///
/// This exists so the icon set can keep the *exact* path strings the prototype
/// and the React Native app use, rather than being hand-converted twenty times
/// into `Path` calls. One parser to get right instead of twenty transcriptions,
/// and the glyphs cannot drift from the design they came from.
///
/// The algorithm here was written and run in JavaScript against all twenty real
/// glyph strings before being written in Swift, so the logic is verified even
/// though the transcription is not. That run caught the one genuinely subtle
/// bug in the format — see `flag()`.
enum SVGPath {
    static func parse(_ d: String, in rect: CGRect, viewBox: CGFloat = 24) -> Path {
        var path = Path()
        var scanner = Scanner(d)

        // Everything is authored in a 24x24 box and drawn into whatever size
        // the caller asked for.
        let scale = min(rect.width, rect.height) / viewBox
        let originX = rect.minX
        let originY = rect.minY
        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: originX + x * scale, y: originY + y * scale)
        }

        var x: CGFloat = 0, y: CGFloat = 0          // current point
        var startX: CGFloat = 0, startY: CGFloat = 0 // subpath start, for Z
        var command: Character? = nil
        var lastCubicControl: CGPoint? = nil         // for S/s reflection

        while !scanner.atEnd {
            if let next = scanner.takeCommand() {
                command = next
            } else if command == "M" {
                // Extra coordinate pairs after a moveto continue as a lineto.
                command = "L"
            } else if command == "m" {
                command = "l"
            } else if command == nil {
                break
            }

            guard let cmd = command else { break }
            let relative = cmd.isLowercase
            let offsetX = relative ? x : 0
            let offsetY = relative ? y : 0

            do {
                switch Character(cmd.uppercased()) {
                case "M":
                    x = try scanner.number() + offsetX
                    y = try scanner.number() + offsetY
                    startX = x; startY = y
                    path.move(to: point(x, y))
                    lastCubicControl = nil

                case "L":
                    x = try scanner.number() + offsetX
                    y = try scanner.number() + offsetY
                    path.addLine(to: point(x, y))
                    lastCubicControl = nil

                case "H":
                    x = try scanner.number() + offsetX
                    path.addLine(to: point(x, y))
                    lastCubicControl = nil

                case "V":
                    y = try scanner.number() + offsetY
                    path.addLine(to: point(x, y))
                    lastCubicControl = nil

                case "C":
                    let c1 = CGPoint(x: try scanner.number() + offsetX, y: try scanner.number() + offsetY)
                    let c2 = CGPoint(x: try scanner.number() + offsetX, y: try scanner.number() + offsetY)
                    x = try scanner.number() + offsetX
                    y = try scanner.number() + offsetY
                    path.addCurve(to: point(x, y), control1: point(c1.x, c1.y), control2: point(c2.x, c2.y))
                    lastCubicControl = c2

                case "S":
                    // The first control point is the previous curve's second
                    // one reflected through the current point. With no previous
                    // curve it coincides with the current point, per the spec.
                    let c1 = lastCubicControl.map { CGPoint(x: 2 * x - $0.x, y: 2 * y - $0.y) }
                        ?? CGPoint(x: x, y: y)
                    let c2 = CGPoint(x: try scanner.number() + offsetX, y: try scanner.number() + offsetY)
                    x = try scanner.number() + offsetX
                    y = try scanner.number() + offsetY
                    path.addCurve(to: point(x, y), control1: point(c1.x, c1.y), control2: point(c2.x, c2.y))
                    lastCubicControl = c2

                case "A":
                    let rx = try scanner.number()
                    let ry = try scanner.number()
                    let rotation = try scanner.number() * .pi / 180
                    let largeArc = try scanner.flag()
                    let sweep = try scanner.flag()
                    let endX = try scanner.number() + offsetX
                    let endY = try scanner.number() + offsetY
                    addArc(
                        to: &path, from: CGPoint(x: x, y: y), to: CGPoint(x: endX, y: endY),
                        rx: rx, ry: ry, rotation: rotation, largeArc: largeArc, sweep: sweep,
                        transform: point
                    )
                    x = endX; y = endY
                    lastCubicControl = nil

                case "Z":
                    path.closeSubpath()
                    x = startX; y = startY
                    lastCubicControl = nil

                default:
                    return path // unknown command: stop rather than draw nonsense
                }
            } catch {
                // A malformed path should show what parsed rather than crash or
                // vanish — a partial glyph is a visible bug, an empty one is not.
                return path
            }
        }

        return path
    }

    // MARK: - Arcs

    /// SVG arcs are given by their endpoints; Béziers need a centre. This is the
    /// endpoint-to-centre conversion from the SVG specification's implementation
    /// notes, followed by a cubic approximation.
    ///
    /// Cubics rather than `Path.addArc(clockwise:)` deliberately. SwiftUI
    /// interprets that flag in a y-down space, so it sweeps the opposite way
    /// from what the name suggests — a silent wrong-direction bug that looks
    /// like a mangled glyph. Emitting control points removes the ambiguity: the
    /// direction is in the numbers, not in an argument's interpretation.
    private static func addArc(
        to path: inout Path,
        from start: CGPoint, to end: CGPoint,
        rx rxIn: CGFloat, ry ryIn: CGFloat,
        rotation: CGFloat, largeArc: Bool, sweep: Bool,
        transform: (CGFloat, CGFloat) -> CGPoint
    ) {
        var rx = abs(rxIn), ry = abs(ryIn)
        // A zero radius is a straight line, by definition.
        guard rx > 0, ry > 0 else {
            path.addLine(to: transform(end.x, end.y))
            return
        }

        let cosR = cos(rotation), sinR = sin(rotation)
        let dx = (start.x - end.x) / 2, dy = (start.y - end.y) / 2
        let x1p = cosR * dx + sinR * dy
        let y1p = -sinR * dx + cosR * dy

        // Radii too small to span the two points get scaled up until they fit.
        let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
        if lambda > 1 {
            let s = sqrt(lambda)
            rx *= s; ry *= s
        }

        let sign: CGFloat = largeArc != sweep ? 1 : -1
        let numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
        let denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p
        let coefficient = sign * sqrt(max(0, numerator / denominator))
        let cxp = coefficient * (rx * y1p) / ry
        let cyp = coefficient * -(ry * x1p) / rx

        let cx = cosR * cxp - sinR * cyp + (start.x + end.x) / 2
        let cy = sinR * cxp + cosR * cyp + (start.y + end.y) / 2

        func angle(_ ux: CGFloat, _ uy: CGFloat, _ vx: CGFloat, _ vy: CGFloat) -> CGFloat {
            let dot = ux * vx + uy * vy
            let length = sqrt(ux * ux + uy * uy) * sqrt(vx * vx + vy * vy)
            guard length > 0 else { return 0 }
            var a = acos(min(1, max(-1, dot / length)))
            if ux * vy - uy * vx < 0 { a = -a }
            return a
        }

        let ux = (x1p - cxp) / rx, uy = (y1p - cyp) / ry
        let vx = (-x1p - cxp) / rx, vy = (-y1p - cyp) / ry
        let theta = angle(1, 0, ux, uy)
        var delta = angle(ux, uy, vx, vy)
        if !sweep && delta > 0 { delta -= 2 * .pi }
        if sweep && delta < 0 { delta += 2 * .pi }

        // Split at 90° or less. Beyond that the cubic approximation of a
        // circular arc starts to visibly bulge; at or below it, the error is
        // under a thousandth of a point at these sizes.
        let segments = max(1, Int(ceil(abs(delta) / (.pi / 2))))
        let step = delta / CGFloat(segments)
        let k = (4.0 / 3.0) * tan(step / 4)

        var a = theta
        for _ in 0..<segments {
            let b = a + step
            // Points on the unrotated ellipse, then rotated into place.
            func onArc(_ t: CGFloat) -> CGPoint {
                let px = rx * cos(t), py = ry * sin(t)
                return CGPoint(x: cx + cosR * px - sinR * py, y: cy + sinR * px + cosR * py)
            }
            func tangent(_ t: CGFloat) -> CGPoint {
                let px = -rx * sin(t), py = ry * cos(t)
                return CGPoint(x: cosR * px - sinR * py, y: sinR * px + cosR * py)
            }
            let p1 = onArc(a), p2 = onArc(b)
            let t1 = tangent(a), t2 = tangent(b)
            let c1 = CGPoint(x: p1.x + k * t1.x, y: p1.y + k * t1.y)
            let c2 = CGPoint(x: p2.x - k * t2.x, y: p2.y - k * t2.y)
            path.addCurve(
                to: transform(p2.x, p2.y),
                control1: transform(c1.x, c1.y),
                control2: transform(c2.x, c2.y)
            )
            a = b
        }
    }

    // MARK: - Scanning

    private enum ParseError: Error { case expectedNumber, expectedFlag }

    /// A scanner rather than a tokenizer, because arcs cannot be tokenized
    /// without knowing you are inside one.
    ///
    /// The large-arc and sweep flags are **single digits** and are allowed to
    /// run straight into the number after them. In `a4 4 0 017-2.6` the `017`
    /// is flag `0`, flag `1`, then `x = 7` — not the number 17. Reading it as
    /// 17 consumes one argument too few, which desynchronises every command
    /// after it until coordinates start swallowing command letters. That is
    /// exactly what the first version of this did, and it produced garbage
    /// rather than an error.
    private struct Scanner {
        private let chars: [Character]
        private var index = 0

        init(_ s: String) { chars = Array(s) }

        private mutating func skipSeparators() {
            while index < chars.count, chars[index] == " " || chars[index] == "," || chars[index] == "\n" || chars[index] == "\t" {
                index += 1
            }
        }

        var atEnd: Bool {
            mutating get {
                skipSeparators()
                return index >= chars.count
            }
        }

        mutating func takeCommand() -> Character? {
            skipSeparators()
            guard index < chars.count else { return nil }
            let c = chars[index]
            guard "MmLlHhVvCcSsAaZz".contains(c) else { return nil }
            index += 1
            return c
        }

        mutating func number() throws -> CGFloat {
            skipSeparators()
            var text = ""
            if index < chars.count, chars[index] == "-" || chars[index] == "+" {
                text.append(chars[index]); index += 1
            }
            var sawDigit = false, sawDot = false
            while index < chars.count {
                let c = chars[index]
                if c.isNumber {
                    text.append(c); index += 1; sawDigit = true
                } else if c == ".", !sawDot {
                    text.append(c); index += 1; sawDot = true
                } else if (c == "e" || c == "E"), sawDigit {
                    text.append(c); index += 1
                    if index < chars.count, chars[index] == "-" || chars[index] == "+" {
                        text.append(chars[index]); index += 1
                    }
                } else {
                    break
                }
            }
            guard sawDigit, let value = Double(text) else { throw ParseError.expectedNumber }
            return CGFloat(value)
        }

        /// Exactly one character, `0` or `1`.
        mutating func flag() throws -> Bool {
            skipSeparators()
            guard index < chars.count, chars[index] == "0" || chars[index] == "1" else {
                throw ParseError.expectedFlag
            }
            let isSet = chars[index] == "1"
            index += 1
            return isSet
        }
    }
}
