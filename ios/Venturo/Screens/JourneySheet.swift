import SwiftUI

/// Journey: idea to first sale, one step at a time.
///
/// Opens on what to do next rather than on the full list, because the whole
/// point is that there is exactly one next thing. The rest is there to scroll
/// to, not to greet you with.
struct JourneySheet: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss

    @State private var data: MissionsPayload?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let data {
                        summary(data)
                        levelBar(data.summary)
                        nextUp(data)
                        groups(data)
                    } else if app.activeBusiness == nil {
                        ExplorerEmpty(
                            title: "Your journey starts with an idea",
                            body_: "Find something worth selling in Discover. The steps unlock from there."
                        )
                    } else {
                        ProgressView().tint(theme.scheme.accent)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 80)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .background(theme.scheme.background)
            .navigationTitle("Your journey")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: {
                        Icon(name: .x, size: 16, color: theme.scheme.text)
                    }
                }
            }
        }
        // Fetched every time it opens, and only then.
        //
        // /api/missions is a GET with write side-effects — it awards newly
        // completed missions as part of answering. That makes it safe to call
        // when somebody deliberately opens this, and wrong to call on a timer
        // or to prefetch.
        .task { await load() }
    }

    private func summary(_ data: MissionsPayload) -> some View {
        let done = data.missions.filter(\.completed).count
        return VStack(alignment: .leading, spacing: 2) {
            Text("\(done) of \(data.missions.count) done · \(data.summary.xp) XP")
                .font(.custom(Typeface.sansMedium, size: 13))
                .foregroundStyle(theme.scheme.textSecondary)
        }
        .padding(.top, 8)
    }

    private func levelBar(_ summary: MissionSummary) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(summary.levelName)
                    .font(.custom(Typeface.display, size: 17))
                    .foregroundStyle(theme.scheme.text)
                Spacer()
                Text("Level \(summary.level)")
                    .font(.custom(Typeface.sansSemiBold, size: 12))
                    .monospacedDigit()
                    .foregroundStyle(theme.scheme.textSecondary)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(theme.scheme.backgroundSelected)
                    Capsule().fill(theme.scheme.accent)
                        .frame(width: geo.size.width * progress(summary))
                }
            }
            .frame(height: 6)
        }
    }

    /// A full bar at the maximum level, where `nextLevelXp` is null. Showing an
    /// empty bar there would read as no progress rather than as finished.
    private func progress(_ summary: MissionSummary) -> CGFloat {
        guard let next = summary.nextLevelXp else { return 1 }
        let span = next - summary.currentLevelXp
        guard span > 0 else { return 1 }
        return min(1, CGFloat(summary.xp - summary.currentLevelXp) / CGFloat(span))
    }

    @ViewBuilder private func nextUp(_ data: MissionsPayload) -> some View {
        if let next = data.missions.first(where: { !$0.completed }) {
            VStack(alignment: .leading, spacing: 4) {
                Text("NEXT UP")
                    .font(.custom(Typeface.sansBold, size: 11))
                    .tracking(0.9)
                    .foregroundStyle(theme.scheme.accent)
                Text(next.title)
                    .font(.custom(Typeface.sansSemiBold, size: 16))
                    .foregroundStyle(theme.scheme.text)
                Text(next.description)
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 8) {
                    Text("+\(next.xp) XP")
                        .font(.custom(Typeface.sansBold, size: 12))
                        .foregroundStyle(theme.scheme.accent)
                    if next.target > 1 {
                        Text("· \(next.current)/\(next.target)")
                            .font(.custom(Typeface.sansMedium, size: 12))
                            .monospacedDigit()
                            .foregroundStyle(theme.scheme.textSecondary)
                    }
                }
                .padding(.top, 2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(theme.scheme.backgroundElement)
            .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                    .strokeBorder(theme.scheme.accent, lineWidth: 1.5)
            }
        } else {
            Text("You've walked the whole journey.")
                .font(.custom(Typeface.display, size: 20))
                .foregroundStyle(theme.scheme.text)
        }
    }

    /// Grouped by cadence, in the server's own key order.
    ///
    /// Not the prototype's five gated levels: `/api/missions` runs on a
    /// different model that has no level per mission, and inventing the gating
    /// here would put a number on screen the server disagrees with. The server
    /// changes first.
    @ViewBuilder private func groups(_ data: MissionsPayload) -> some View {
        ForEach(Array(data.cadenceInfo.keys), id: \.self) { cadence in
            let missions = data.missions.filter { $0.cadence == cadence }
            if !missions.isEmpty, let info = data.cadenceInfo[cadence] {
                VStack(alignment: .leading, spacing: 8) {
                    Text(info.title)
                        .font(.custom(Typeface.sansSemiBold, size: 15))
                        .foregroundStyle(theme.scheme.text)
                    Text(info.blurb)
                        .font(.custom(Typeface.sansMedium, size: 13))
                        .foregroundStyle(theme.scheme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    ForEach(missions) { mission in
                        missionRow(mission)
                    }
                }
                .padding(.top, 6)
            }
        }
    }

    private func missionRow(_ mission: Mission) -> some View {
        HStack(alignment: .top, spacing: 10) {
            ZStack {
                Circle()
                    .strokeBorder(mission.completed ? theme.scheme.customer : theme.scheme.border, lineWidth: 1.5)
                    .background(Circle().fill(mission.completed ? theme.scheme.customer : .clear))
                    .frame(width: 20, height: 20)
                if mission.completed {
                    Icon(name: .check, size: 12, color: theme.scheme.backgroundElement)
                }
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(mission.title)
                    .font(.custom(Typeface.sansMedium, size: 14))
                    .foregroundStyle(mission.completed ? theme.scheme.textSecondary : theme.scheme.text)
                    .strikethrough(mission.completed, color: theme.scheme.textSecondary)
                if !mission.completed, mission.target > 1 {
                    Text("\(mission.current)/\(mission.target)")
                        .font(.custom(Typeface.sansMedium, size: 12))
                        .monospacedDigit()
                        .foregroundStyle(theme.scheme.textSecondary)
                }
            }
            Spacer(minLength: 0)
            Text("+\(mission.xp)")
                .font(.custom(Typeface.sansBold, size: 12))
                .monospacedDigit()
                .foregroundStyle(mission.completed ? theme.scheme.textSecondary : theme.scheme.accent)
        }
        .padding(.vertical, 6)
    }

    private func load() async {
        guard let business = app.activeBusiness else { return }
        data = try? await app.api.getMissions(businessId: business.id)
    }
}
