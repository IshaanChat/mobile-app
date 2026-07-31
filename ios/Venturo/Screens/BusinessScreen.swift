import SwiftUI

/// Business: how the business is actually doing.
///
/// A shell over four panes. Sub-tabs rather than separate tabs because these
/// are four views of one thing — the bottom bar is for changing what you are
/// doing, not for changing which column you are reading.
struct BusinessScreen: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app

    /// Sends somebody back to Discover from the empty shelf. Owned by the root,
    /// which is the only thing that knows what a tab is.
    var onOpenDiscover: (() -> Void)? = nil

    @State private var pane: Pane = .overview
    /// Nil until the Saved pane has loaded once. The subtab shows a bare
    /// "Saved" until then rather than claiming a count it has not counted.
    @State private var savedCount: Int?

    enum Pane: String, CaseIterable {
        case overview, clients, money, saved

        var label: String {
            switch self {
            case .overview: return "Overview"
            case .clients: return "Clients"
            case .money: return "Money"
            case .saved: return "Saved"
            }
        }

        var icon: IconName {
            switch self {
            case .overview: return .chart
            case .clients: return .book
            case .money: return .note
            case .saved: return .heart
            }
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                header
                subtabs
                switch pane {
                case .overview: BusinessOverview()
                case .clients: BusinessClients()
                case .money: BusinessMoney()
                case .saved: BusinessSaved(count: $savedCount, onOpenDiscover: onOpenDiscover)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 64)
        }
        .background(theme.scheme.background)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(greeting)
                .font(.custom(Typeface.display, size: 30))
                .tracking(-0.45)
                .foregroundStyle(theme.scheme.text)
                .padding(.top, 6)
            Text(subtitle)
                .font(.custom(Typeface.sansMedium, size: 13))
                .foregroundStyle(theme.scheme.textSecondary)
        }
    }

    private var greeting: String {
        if let name = app.profile?.name.split(separator: " ").first { return "Hi, \(name)" }
        return "Business"
    }

    private var subtitle: String {
        if let business = app.activeBusiness { return "Where \(business.name) actually stands today." }
        return "What you have built so far, counted honestly."
    }

    private var subtabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Pane.allCases, id: \.self) { option in
                    let isOn = pane == option
                    Button { pane = option } label: {
                        HStack(spacing: 6) {
                            Icon(
                                name: option.icon, size: 16,
                                color: isOn ? theme.scheme.text : theme.scheme.textSecondary
                            )
                            Text(label(for: option))
                                .font(.custom(isOn ? Typeface.sansBold : Typeface.sansMedium, size: 13))
                                .foregroundStyle(isOn ? theme.scheme.text : theme.scheme.textSecondary)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(isOn ? theme.scheme.accentSoft : .clear, in: Capsule())
                        .overlay {
                            Capsule().strokeBorder(isOn ? theme.scheme.accent : theme.scheme.border, lineWidth: 1)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.top, 12)
        .padding(.bottom, 4)
    }

    /// The count rides on the subtab, matching the Saved chip in Discover, so
    /// the size of the shelf is readable without opening it. Only once it has
    /// actually been counted — see `savedCount`.
    private func label(for option: Pane) -> String {
        guard option == .saved, let savedCount, savedCount > 0 else { return option.label }
        return "Saved · \(savedCount)"
    }
}

// MARK: - Shared pieces

/// One number and what it counts. The number is the point, so it gets the
/// serif and tabular figures; the label stays quiet underneath.
struct StatCard: View {
    @Environment(\.theme) private var theme
    let value: String
    let label: String
    var tint: Color? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.custom(Typeface.display, size: 24))
                .tracking(-0.5)
                .monospacedDigit()
                .foregroundStyle(tint ?? theme.scheme.text)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.custom(Typeface.sansMedium, size: 12))
                .foregroundStyle(theme.scheme.textSecondary)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 13)
        .padding(.vertical, 12)
        .background(theme.scheme.backgroundElement)
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                .strokeBorder(theme.scheme.border, lineWidth: 1)
        }
        .cardElevation(theme)
    }
}

/// A titled block on the dashboard.
struct PanelCard<Content: View>: View {
    @Environment(\.theme) private var theme
    let title: String
    var icon: IconName? = nil
    var action: (label: String, run: () -> Void)? = nil
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                if let icon { Icon(name: icon, size: 16, color: theme.scheme.text) }
                Text(title)
                    .font(.custom(Typeface.sansSemiBold, size: 15))
                    .foregroundStyle(theme.scheme.text)
                Spacer(minLength: 0)
                if let action {
                    Button(action.label, action: action.run)
                        .font(.custom(Typeface.sansSemiBold, size: 13))
                        .foregroundStyle(theme.scheme.accent)
                }
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(theme.scheme.backgroundElement)
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                .strokeBorder(theme.scheme.border, lineWidth: 1)
        }
        .cardElevation(theme)
    }
}

/// Shown wherever a pane has nothing to say because no business exists yet.
struct ExplorerEmpty: View {
    @Environment(\.theme) private var theme
    let title: String
    let body_: String

    var body: some View {
        VStack(spacing: Space.two) {
            Text(title)
                .font(.custom(Typeface.display, size: 20))
                .foregroundStyle(theme.scheme.text)
            Text(body_)
                .font(.custom(Typeface.sansMedium, size: 14))
                .foregroundStyle(theme.scheme.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
        .padding(.horizontal, 20)
    }
}

/// The status dot beside a contact.
struct StatusDot: View {
    @Environment(\.theme) private var theme
    let status: String

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 8, height: 8)
    }

    private var color: Color {
        switch ContactStatus(status) {
        case .customer: return theme.scheme.customer
        case .engaged: return theme.scheme.engaged
        default: return theme.scheme.prospect
        }
    }
}

// MARK: - Formatting

enum Money {
    /// Whole pounds unless the pennies matter — a shelf of round prices should
    /// not be a column of ".00".
    static func short(_ amount: Double) -> String {
        let rounded = amount.rounded()
        if abs(amount - rounded) < 0.005 {
            return "$\(Int(rounded).formatted(.number.grouping(.automatic)))"
        }
        return amount.formatted(.currency(code: "USD"))
    }
}

enum Elapsed {
    /// Days since a date, or nil when there is no date at all — which is a
    /// different thing from "a long time ago" and reads differently.
    static func days(since date: Date?) -> Int? {
        guard let date else { return nil }
        return Calendar.current.dateComponents([.day], from: date, to: Date()).day
    }

    static func quietLabel(_ date: Date?) -> String {
        guard let days = days(since: date) else { return "never contacted" }
        if days <= 0 { return "today" }
        if days == 1 { return "1 day quiet" }
        return "\(days) days quiet"
    }
}
