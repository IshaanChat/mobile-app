import SwiftUI

/// The one piece of chrome on every screen: the wordmark, the streak, the way
/// into Journey, and the tip bubble beneath them.
///
/// Journey lives here rather than in the tab bar deliberately. It is a thing
/// you check in on, not a place you browse — making it a fifth tab would put a
/// progress screen at the same weight as the feed, and there are only four
/// things worth standing at the bottom of the screen.
struct TopBar: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app

    /// Which tab is showing, so the bubble can offer tips that belong to it.
    let tab: String
    let onOpenJourney: () -> Void

    @State private var streak: Int = 0
    @State private var tips: [Tip] = []
    @State private var current: Tip?
    @State private var seen: Set<String> = []

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                brand
                Spacer(minLength: 0)
                if streak > 0 { streakBadge }
                journeyButton
            }
            if let current {
                TipBubble(tip: current) { advance() }
                    .transition(.opacity)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 11)
        .padding(.bottom, 10)
        .background(theme.scheme.background)
        .overlay(alignment: .bottom) {
            Rectangle().fill(theme.scheme.border).frame(height: 1)
        }
        .task {
            streak = Preferences.touchStreak()
            await loadTips()
        }
        .onChange(of: tab) { _, _ in
            // Only swap when the line on screen does not belong to the new tab.
            // Switching tabs to check one thing should not cost you the tip you
            // were halfway through reading.
            if let current, current.tab == "any" || current.tab == tab { return }
            advance()
        }
    }

    // MARK: - Pieces

    private var brand: some View {
        HStack(spacing: 9) {
            BrandMark(size: 27)
            Text("Venturo")
                .font(.custom(Typeface.wordmark, size: 25))
                .foregroundStyle(theme.scheme.accent)
                // Pinned: Baloo ships tall ascender metrics and the line box
                // otherwise reserves ~8pt for glyphs the word does not contain,
                // which inflates the whole bar.
                .frame(height: 28)
        }
    }

    private var streakBadge: some View {
        HStack(spacing: 5) {
            Icon(name: .flame, size: 16, color: theme.scheme.engaged)
            Text("\(streak)")
                .font(.custom(Typeface.sansBold, size: 14))
                .monospacedDigit()
                .foregroundStyle(theme.scheme.engaged)
        }
        .accessibilityLabel("\(streak) day streak")
    }

    private var journeyButton: some View {
        Button(action: onOpenJourney) {
            Text("Journey")
                .font(.custom(Typeface.sansSemiBold, size: 13.5))
                .foregroundStyle(theme.scheme.text)
                .padding(.horizontal, 15)
                .padding(.vertical, 9)
                .background(theme.scheme.backgroundElement, in: Capsule())
                .overlay { Capsule().strokeBorder(theme.scheme.border, lineWidth: 1) }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Tip rotation
    //
    // Rules the bubble follows, carried over from the prototype:
    //   - it never interrupts. It changes on tap, on moving to a tab where the
    //     current line does not belong, or when a level unlocks new ones
    //   - it never repeats until it has run out of unseen lines
    //   - it never goes quiet. Out of fresh lines it starts the rotation over,
    //     because an empty bubble reads as a bug and a repeat does not

    private func loadTips() async {
        let level = 1 // raised once the journey model lands
        guard let loaded = try? await app.content.getTips(tab: tab, level: level) else { return }
        tips = loaded
        if current == nil { advance() }
    }

    private func advance() {
        let eligible = tips.filter { $0.tab == "any" || $0.tab == tab }
        guard !eligible.isEmpty else { return }

        var fresh = eligible.filter { !seen.contains($0.id) }
        if fresh.isEmpty {
            // Forget only this tab's tips, so moving to Grow does not wipe the
            // record of everything already read on Discover.
            seen.subtract(Set(eligible.map(\.id)))
            fresh = eligible
        }
        // Anything but the line already showing — a tap that changes nothing
        // reads as a broken button.
        if fresh.count > 1, let current {
            fresh.removeAll { $0.id == current.id }
        }

        guard let next = fresh.randomElement() else { return }
        seen.insert(next.id)
        withAnimation(.easeInOut(duration: 0.16)) { current = next }
    }
}

/// One tip, in a tappable bubble.
///
/// No dismiss and no timer: tapping moves to the next one, so it never has to
/// be got rid of and never changes while somebody is reading it.
struct TipBubble: View {
    @Environment(\.theme) private var theme
    let tip: Tip
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                // The icon is the only signal of which kind this is — there is
                // no label. Sage for warmth, the accent for advice.
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(tip.isLift ? theme.scheme.customer.opacity(0.12) : theme.scheme.accentSoft)
                    .frame(width: 26, height: 26)
                    .overlay {
                        Icon(
                            name: tip.isLift ? .spark : .chart,
                            size: 15,
                            color: tip.isLift ? theme.scheme.customer : theme.scheme.accent
                        )
                    }

                Text(tip.text)
                    .font(.custom(Typeface.sansMedium, size: 12.5))
                    .foregroundStyle(theme.scheme.text)
                    .multilineTextAlignment(.leading)
                    // Two lines, clipped. Tips are written to fit; one long one
                    // should shorten itself rather than push the feed down.
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Icon(name: .chev, size: 16, color: theme.scheme.textSecondary, rotate: -90)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(theme.scheme.backgroundElement, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(theme.scheme.border, lineWidth: 1)
            }
            .cardElevation(theme)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tip.text)
        .accessibilityHint("Tap for another tip")
    }
}
