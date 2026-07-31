import ClerkKit
import SwiftUI

/// The app shell: the tab bar, the top bar, and the routing between them.
///
/// Which screen you see is derived from `AppState.mode`, never assigned. That
/// is what stops the app disagreeing with itself about whether you are signed
/// in, onboarding, or exploring.
struct RootView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(AppState.self) private var app
    @Environment(Clerk.self) private var clerk

    @State private var tab: Tab = .discover
    @State private var showJourney = false

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
            // Auth comes before everything. Until Clerk has a user there is no
            // token, so every request would 401 — routing on `mode` first would
            // just show a load failure to somebody who is simply signed out.
            if clerk.user == nil {
                SignInScreen()
            } else {
                switch app.mode {
                case .loading:
                    LaunchState()
                case .error(let message):
                    LoadFailure(message: message) { Task { await app.load() } }
                case .onboarding:
                    OnboardingScreen()
                case .explorer, .active:
                    shell
                }
            }
        }
        .venturoTheme(colorScheme)
        // Keyed on the user id rather than run once: signing out and back in as
        // somebody else has to reload, and a plain `.task` would keep the first
        // account's profile on screen.
        .task(id: clerk.user?.id) {
            guard clerk.user != nil else { return }
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
        .sheet(isPresented: $showJourney) {
            JourneySheet()
                .venturoTheme(colorScheme)
                .environment(app)
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
        case .business: BusinessScreen()
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

