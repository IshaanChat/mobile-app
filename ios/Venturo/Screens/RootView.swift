import SwiftUI

/// The app shell: the tab bar, the top bar, and the routing between them.
///
/// Which screen you see is derived from `AppState.mode`, never assigned. That
/// is what stops the app disagreeing with itself about whether you are signed
/// in, onboarding, or exploring.
struct RootView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(AppState.self) private var app

    @State private var tab: Tab = .discover
    @State private var showJourney = false
    /// Owns the win, the level-up and the nudge, which share one strip and
    /// therefore have to be sequenced somewhere above all three.
    @State private var celebrations = Celebrations()

    enum Tab: String, CaseIterable {
        case discover, grow, business, you

        var label: String {
            switch self {
            case .discover: return "Discover"
            case .grow: return "Grow"
            case .business: return "Business"
            case .you: return "You"
            }
        }

        var icon: IconName {
            switch self {
            case .discover: return .compass
            case .grow: return .sprout
            case .business: return .chart
            case .you: return .user
            }
        }
    }

    var body: some View {
        Group {
            // No sign-in gate. The content database reads without an iCloud
            // account, so somebody who has never signed in to anything still
            // gets the whole of Discover — which is the point of the front
            // door being a front door.
            switch app.mode {
            case .loading:
                LaunchState()
            case .error(let message):
                LoadFailure(message: message) { Task { await app.load() } }
            case .onboarding:
                OnboardingScreen()
            case .browsing, .explorer, .active:
                shell
            }
        }
        .venturoTheme(colorScheme)
        .environment(celebrations)
        .task {
            celebrations.reset()
            await app.load()
        }
    }

    private var shell: some View {
        VStack(spacing: 0) {
            TopBar(tab: tabKey, onOpenJourney: { showJourney = true })
            content
            TabBar(selected: $tab)
        }
        .background(Theme(colorScheme).scheme.background)
        .ignoresSafeArea(.keyboard, edges: .bottom)
        // The win and the nudge share one strip below the top bar, which is why
        // only one can be on screen: `Celebrations` queues them rather than
        // letting them stack.
        .overlay(alignment: .top) { momentStrip }
        .overlay {
            if let levelUp = celebrations.levelUp {
                LevelUpOverlay(levelUp: levelUp) { celebrations.dismissLevelUp() }
                    .transition(.opacity)
            }
        }
        .animation(.spring(response: 0.32, dampingFraction: 0.8), value: celebrations.win)
        .animation(.spring(response: 0.32, dampingFraction: 0.8), value: celebrations.nudge)
        .animation(.easeInOut(duration: 0.22), value: celebrations.levelUp)
        .sheet(isPresented: $showJourney) {
            JourneySheet()
                .venturoTheme(colorScheme)
                .environment(app)
                .environment(celebrations)
        }
    }

    @ViewBuilder private var momentStrip: some View {
        if let win = celebrations.win {
            WinBanner(win: win)
                .padding(.horizontal, 12)
                .padding(.top, 6)
                .transition(.move(edge: .top).combined(with: .opacity))
        } else if let nudge = celebrations.nudge {
            NudgeBanner(
                nudge: nudge,
                onGo: {
                    if let target = nudge.tab { tab = target }
                    celebrations.dismissNudge(mute: false)
                },
                // Dismissing mutes for the session. A prompt that survives being
                // dismissed is a prompt people learn to hate.
                onDismiss: { celebrations.dismissNudge(mute: true) }
            )
            .padding(.horizontal, 12)
            .padding(.top, 6)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }

    /// The server's tab vocabulary, which differs from the UI's: Business is
    /// `shop` in tip targeting because that is what the content files call it.
    private var tabKey: String {
        switch tab {
        case .discover: return "discover"
        case .grow: return "grow"
        case .business: return "shop"
        case .you: return "you"
        }
    }

    @ViewBuilder private var content: some View {
        switch tab {
        case .discover: DiscoverScreen()
        case .grow: GrowScreen()
        case .business: BusinessScreen(onOpenDiscover: { tab = .discover })
        case .you: YouScreen()
        }
    }
}

/// Four tabs, drawn rather than using `TabView` so the icon set, weights and
/// colours are ours. `TabView`'s bar brings its own materials and type, and
/// mixing that with a hand-drawn icon set is where an app starts looking
/// assembled instead of designed.
struct TabBar: View {
    @Environment(\.theme) private var theme
    @Binding var selected: RootView.Tab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(RootView.Tab.allCases, id: \.self) { tab in
                let isOn = selected == tab
                Button { selected = tab } label: {
                    VStack(spacing: 3) {
                        Icon(
                            name: tab.icon,
                            size: 22,
                            color: isOn ? theme.scheme.accent : theme.scheme.textSecondary,
                            // The active tab draws heavier so it reads as
                            // pressed rather than merely tinted.
                            strokeWidth: isOn ? 2 : 1.7
                        )
                        Text(tab.label)
                            .font(.custom(isOn ? Typeface.sansBold : Typeface.sansMedium, size: 11))
                            .foregroundStyle(isOn ? theme.scheme.accent : theme.scheme.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isOn ? [.isSelected] : [])
            }
        }
        .padding(.bottom, 2)
        .background(theme.scheme.background)
        .overlay(alignment: .top) {
            Rectangle().fill(theme.scheme.border).frame(height: 1)
        }
    }
}

/// Shown while the first two requests are in flight.
///
/// Names the cold start rather than spinning silently. On the free tier this
/// can take half a minute, and a bare spinner for thirty seconds reads as a
/// hang — saying why costs one line and changes it from broken to slow.
struct LaunchState: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = Theme(colorScheme)
        VStack(spacing: Space.three) {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(theme.scheme.accent)
                .frame(width: 56, height: 56)
                .overlay { Icon(name: .spark, size: 28, color: theme.scheme.accentText) }
            ProgressView().tint(theme.scheme.accent)
            Text("Warming up — the server naps when nobody is using it.")
                .font(.custom(Typeface.sansMedium, size: 13))
                .foregroundStyle(theme.scheme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(theme.scheme.background)
    }
}

struct LoadFailure: View {
    @Environment(\.colorScheme) private var colorScheme
    let message: String
    let retry: () -> Void

    var body: some View {
        let theme = Theme(colorScheme)
        VStack(spacing: Space.three) {
            Text("Couldn't load your account")
                .font(.custom(Typeface.display, size: 22))
                .foregroundStyle(theme.scheme.text)
            Text(message)
                .font(.custom(Typeface.sansMedium, size: 14))
                .foregroundStyle(theme.scheme.textSecondary)
                .multilineTextAlignment(.center)
            Button("Try again", action: retry)
                .font(.custom(Typeface.sansSemiBold, size: 14))
                .foregroundStyle(theme.scheme.accentText)
                .padding(.horizontal, 24).padding(.vertical, 11)
                .background(theme.scheme.accent, in: Capsule())
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(theme.scheme.background)
    }
}

