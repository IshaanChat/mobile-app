import SwiftUI

/// The moments between screens: what happens when you finish something, when a
/// level completes, and the quiet suggestion of what to do next.
///
/// All three live in the same strip below the top bar, which is why they are
/// coordinated here rather than owned by whichever screen triggered them. Two
/// of them arriving at once would stack, and the timings below exist so they
/// queue instead.
@Observable
@MainActor
final class Celebrations {
    /// A milestone just completed.
    private(set) var win: Win?
    /// A whole level just completed. Outranks a win — finishing the last step
    /// of a level would otherwise fire both at once.
    private(set) var levelUp: LevelUp?
    /// The quiet next-step prompt.
    private(set) var nudge: Nudge?

    struct Win: Equatable {
        let title: String
        let xp: Int
        let totalXp: Int
    }

    struct LevelUp: Equatable {
        let name: String
        let title: String
    }

    struct Nudge: Equatable {
        let title: String
        let tab: RootView.Tab?
    }

    /// How long a milestone celebration stays. Short on purpose: this happens
    /// thirty-four times over a journey, a level-up five, so it confirms and
    /// gets out of the way.
    private static let winDuration: Duration = .seconds(2)
    /// The nudge waits for the win to clear plus a beat — same strip.
    private static let nudgeDelay: Duration = .milliseconds(1500)
    /// Never more often than this. A prompt that keeps reappearing is one
    /// people learn to dismiss without reading.
    private static let nudgeGap: TimeInterval = 4 * 60

    private var lastNudgeAt: Date?
    /// Dismissing mutes it for the session. A prompt that survives being
    /// dismissed is a prompt people learn to hate.
    private var nudgeMuted = false
    private var pending: Task<Void, Never>?

    // MARK: - Firing

    /// Something finished. Shows the win, then the next step behind it.
    func completed(title: String, xp: Int, totalXp: Int, next: Nudge?) {
        pending?.cancel()
        win = Win(title: title, xp: xp, totalXp: totalXp)

        pending = Task {
            try? await Task.sleep(for: Self.winDuration)
            guard !Task.isCancelled else { return }
            win = nil
            guard let next else { return }
            try? await Task.sleep(for: Self.nudgeDelay)
            guard !Task.isCancelled else { return }
            show(next, force: true)
        }
    }

    /// A level completed. Replaces any win in flight rather than queueing
    /// behind it — the smaller moment is not worth waiting through.
    func levelCompleted(name: String, title: String) {
        pending?.cancel()
        win = nil
        levelUp = LevelUp(name: name, title: title)
    }

    func dismissLevelUp() {
        levelUp = nil
    }

    /// `force` skips the rate limit. Used right after a completion, which is
    /// the one moment a prompt is welcome rather than an interruption — they
    /// have just proved they are engaged.
    func show(_ nudge: Nudge, force: Bool = false, clearingAfter: Duration? = nil) {
        guard !nudgeMuted else { return }
        if !force, let last = lastNudgeAt, Date().timeIntervalSince(last) < Self.nudgeGap { return }
        self.nudge = nudge
        lastNudgeAt = Date()

        // The launch prompt clears itself; the one after a completion does not.
        // Arriving to a banner that will not leave until it is dismissed makes
        // the app feel like it wants something, and the first three seconds are
        // the wrong moment to ask.
        guard let clearingAfter else { return }
        pending?.cancel()
        pending = Task { [weak self] in
            try? await Task.sleep(for: clearingAfter)
            guard !Task.isCancelled else { return }
            // Only if it is still the same one — a completion may have replaced
            // it, and that one is meant to stay.
            if self?.nudge == nudge { self?.nudge = nil }
        }
    }

    func dismissNudge(mute: Bool) {
        nudge = nil
        if mute { nudgeMuted = true }
    }

    /// Cleared on sign-out so a new account does not inherit a muted prompt.
    func reset() {
        pending?.cancel()
        win = nil
        levelUp = nil
        nudge = nil
        lastNudgeAt = nil
        nudgeMuted = false
    }
}

// MARK: - The win

/// Confirmation that something is done, in the strip below the top bar.
///
/// Deliberately smaller than a level-up: it happens thirty-four times.
struct WinBanner: View {
    @Environment(\.theme) private var theme
    let win: Celebrations.Win

    @State private var xpVisible = false

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(theme.scheme.accent).frame(width: 30, height: 30)
                Icon(name: .check, size: 16, color: theme.scheme.accentText)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("DONE")
                    .font(.custom(Typeface.sansBold, size: 10.5))
                    .tracking(0.95)
                    .foregroundStyle(theme.scheme.accent)
                Text(win.title)
                    .font(.custom(Typeface.sansSemiBold, size: 14))
                    .foregroundStyle(theme.scheme.text)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            VStack(alignment: .trailing, spacing: 1) {
                Text("+\(win.xp)")
                    .font(.custom(Typeface.display, size: 19))
                    .monospacedDigit()
                    .foregroundStyle(theme.scheme.accent)
                Text("\(win.totalXp) XP")
                    .font(.custom(Typeface.sansBold, size: 10.5))
                    .monospacedDigit()
                    .foregroundStyle(theme.scheme.textSecondary)
            }
            // The points arrive a beat late and settle. The one bit of
            // flourish in the whole app, and it is what makes the moment read
            // as a reward rather than a receipt.
            .opacity(xpVisible ? 1 : 0)
            .scaleEffect(xpVisible ? 1 : 0.85)
            .offset(y: xpVisible ? 0 : 7)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
        .background(theme.scheme.backgroundElement)
        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 15, style: .continuous)
                .strokeBorder(theme.scheme.accent, lineWidth: 1.5)
        }
        .shadow(color: theme.scheme.shadow, radius: 15, y: 10)
        .onAppear {
            withAnimation(.spring(response: 0.34, dampingFraction: 0.55).delay(0.16)) {
                xpVisible = true
            }
        }
    }
}

// MARK: - The level-up

struct LevelUpOverlay: View {
    @Environment(\.theme) private var theme
    let levelUp: Celebrations.LevelUp
    let onDismiss: () -> Void

    @State private var shown = false

    var body: some View {
        ZStack {
            Color.black.opacity(shown ? 0.42 : 0)
                .ignoresSafeArea()
                .onTapGesture(perform: onDismiss)

            Confetti()

            VStack(spacing: 6) {
                Text("LEVEL COMPLETE")
                    .font(.custom(Typeface.sansBold, size: 11))
                    .tracking(1.1)
                    .foregroundStyle(theme.scheme.accent)
                Text(levelUp.name)
                    .font(.custom(Typeface.display, size: 26))
                    .tracking(-0.5)
                    .foregroundStyle(theme.scheme.text)
                Text(levelUp.title)
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 26)
            .padding(.vertical, 22)
            .background(theme.scheme.backgroundElement)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .strokeBorder(theme.scheme.accent, lineWidth: 1.5)
            }
            .shadow(color: theme.scheme.shadow, radius: 25, y: 18)
            .scaleEffect(shown ? 1 : 0.9)
            .opacity(shown ? 1 : 0)
            .onTapGesture(perform: onDismiss)
        }
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) { shown = true }
        }
    }
}

/// The burst behind a level-up.
///
/// Colours are literal rather than themed: a celebration that changes colour
/// with the system appearance reads as a bug. Sage and honey are the success
/// and engaged colours; the two purples are the brand at both lightnesses.
private struct Confetti: View {
    private static let colors: [Color] = [
        Color(hex: 0x6E4EAB), Color(hex: 0x5F9B7A), Color(hex: 0xCF8F2E),
        Color(hex: 0xD0B8F0), Color(hex: 0x4A7C61),
    ]

    @State private var flying = false

    var body: some View {
        GeometryReader { geo in
            let centre = CGPoint(x: geo.size.width / 2, y: geo.size.height * 0.38)
            ZStack {
                ForEach(0..<28, id: \.self) { i in
                    let angle = Double(i) / 28 * 2 * .pi
                    let distance: CGFloat = flying ? .random(in: 120...260) : 0
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Self.colors[i % Self.colors.count])
                        .frame(width: 8, height: 8)
                        .position(centre)
                        .offset(
                            x: cos(angle) * distance,
                            y: sin(angle) * distance + (flying ? 90 : 0)
                        )
                        .rotationEffect(.degrees(flying ? .random(in: -220...220) : 0))
                        .opacity(flying ? 0 : 1)
                }
            }
            .allowsHitTesting(false)
            .onAppear {
                withAnimation(.easeOut(duration: 1.1)) { flying = true }
            }
        }
    }
}

// MARK: - The nudge

/// One line, one action, one dismiss. Never blocks anything.
///
/// Sits under the top bar rather than above the tab bar: what to do next is
/// something you read, and it belongs where you are already looking rather than
/// beside navigation you were not using.
struct NudgeBanner: View {
    @Environment(\.theme) private var theme
    let nudge: Celebrations.Nudge
    let onGo: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(theme.scheme.accentSoft)
                    .frame(width: 30, height: 30)
                Icon(name: .compass, size: 16, color: theme.scheme.accent)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("NEXT UP")
                    .font(.custom(Typeface.sansBold, size: 11))
                    .tracking(0.8)
                    .foregroundStyle(theme.scheme.textSecondary)
                Text(nudge.title)
                    .font(.custom(Typeface.sansSemiBold, size: 14.5))
                    .foregroundStyle(theme.scheme.text)
                    .lineLimit(2)
            }

            Spacer(minLength: 0)

            if nudge.tab != nil {
                Button("Go", action: onGo)
                    .font(.custom(Typeface.sansSemiBold, size: 12.5))
                    .foregroundStyle(theme.scheme.accentText)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(theme.scheme.accent, in: Capsule())
                    .buttonStyle(.plain)
            }

            Button(action: onDismiss) {
                Icon(name: .x, size: 15, color: theme.scheme.textSecondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .background(theme.scheme.backgroundElement)
        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 15, style: .continuous)
                .strokeBorder(theme.scheme.border, lineWidth: 1)
        }
        .shadow(color: theme.scheme.shadow, radius: 13, y: 8)
    }
}
