import SwiftUI

/// Journey: idea to first sale, five levels, one step at a time.
///
/// Opens on what to do next rather than the full list, because the whole point
/// is that there is exactly one next thing. The rest is there to scroll to.
///
/// Levels gate sequentially. A locked level shows its name and how many steps
/// it holds but not what they are — knowing there is more without seeing all of
/// it is the difference between a path and a wall of homework.
struct JourneySheet: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app
    @Environment(Celebrations.self) private var celebrations
    @Environment(\.dismiss) private var dismiss

    /// Moves the user to where a milestone is actually done, and closes the
    /// sheet behind them. Nil in previews.
    var onGoTo: ((RootView.Tab) -> Void)? = nil

    @State private var data: JourneyPayload?
    @State private var expanded: Set<Int> = []
    @State private var busySlug: String?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let data {
                        summary(data.summary)
                        progressBar(data.summary)
                        nextUp(data)
                        ForEach(data.levels) { level in
                            levelBlock(level)
                        }
                        if !data.playbooks.isEmpty {
                            playbooks(data)
                        }
                    } else if let errorMessage {
                        Text(errorMessage)
                            .font(.custom(Typeface.sansMedium, size: 14))
                            .foregroundStyle(theme.scheme.textSecondary)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 60)
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
        .task { await load() }
        .milestone(Trigger.openJourney)
    }

    // MARK: - Header

    private func summary(_ s: JourneySummary) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(s.levelComplete ? "Owner" : s.levelName)
                .font(.custom(Typeface.display, size: 22))
                .tracking(-0.4)
                .foregroundStyle(theme.scheme.text)
            Text("\(s.completed) of \(s.total) steps done · \(s.xp) XP")
                .font(.custom(Typeface.sansMedium, size: 13))
                .monospacedDigit()
                .foregroundStyle(theme.scheme.textSecondary)
        }
        .padding(.top, 8)
    }

    /// One segment per level, filled as each completes.
    ///
    /// Segments rather than a single bar because the levels are the unit of
    /// progress — a continuous bar would suggest the thirty-four steps are
    /// interchangeable, and they are not.
    private func progressBar(_ s: JourneySummary) -> some View {
        HStack(spacing: 4) {
            ForEach(data?.levels ?? []) { level in
                Capsule()
                    .fill(
                        level.complete ? theme.scheme.accent
                            : level.level == s.level ? theme.scheme.accent.opacity(0.35)
                            : theme.scheme.backgroundSelected
                    )
                    .frame(height: 6)
            }
        }
    }

    @ViewBuilder private func nextUp(_ data: JourneyPayload) -> some View {
        if let level = data.levels.first(where: { $0.unlocked && !$0.complete }),
           let next = level.milestones.first(where: { !$0.completed }) {
            VStack(alignment: .leading, spacing: 4) {
                Text("NEXT UP")
                    .font(.custom(Typeface.sansBold, size: 11))
                    .tracking(0.9)
                    .foregroundStyle(theme.scheme.accent)
                Text(next.title)
                    .font(.custom(Typeface.sansSemiBold, size: 16))
                    .foregroundStyle(theme.scheme.text)
                Text(next.detail)
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 8) {
                    Text("+\(next.xp) XP")
                        .font(.custom(Typeface.sansBold, size: 12))
                        .foregroundStyle(theme.scheme.accent)
                    if next.isOutside {
                        Text("· away from the app")
                            .font(.custom(Typeface.sansMedium, size: 12))
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
        } else if data.summary.levelComplete {
            Text("You've walked the whole journey.")
                .font(.custom(Typeface.display, size: 20))
                .foregroundStyle(theme.scheme.text)
                .padding(.vertical, 6)
        }
    }

    // MARK: - Levels

    private func levelBlock(_ level: JourneyLevel) -> some View {
        let isOpen = expanded.contains(level.level) || (level.unlocked && !level.complete)

        return VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.18)) {
                    if expanded.contains(level.level) { expanded.remove(level.level) }
                    else { expanded.insert(level.level) }
                }
            } label: {
                HStack(spacing: 10) {
                    levelBadge(level)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(level.name)
                            .font(.custom(Typeface.sansSemiBold, size: 15))
                            .foregroundStyle(level.unlocked ? theme.scheme.text : theme.scheme.textSecondary)
                        Text(level.title)
                            .font(.custom(Typeface.sansMedium, size: 13))
                            .foregroundStyle(theme.scheme.textSecondary)
                    }
                    Spacer(minLength: 0)
                    Text(level.complete ? "✓" : "\(level.completedCount)/\(level.total)")
                        .font(.custom(Typeface.sansBold, size: 12))
                        .monospacedDigit()
                        .foregroundStyle(level.complete ? theme.scheme.customer : theme.scheme.textSecondary)
                }
                .padding(14)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            // A locked level shows what it is and how much it holds, never its
            // contents. Seeing every remaining step at once turns a path into a
            // list of everything you have not done.
            if isOpen && level.unlocked {
                VStack(spacing: 0) {
                    ForEach(level.milestones) { milestone in
                        milestoneRow(milestone)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 12)
            }
        }
        .background(theme.scheme.backgroundElement)
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                .strokeBorder(theme.scheme.border, lineWidth: 1)
        }
        .opacity(level.unlocked ? 1 : 0.6)
    }

    private func levelBadge(_ level: JourneyLevel) -> some View {
        ZStack {
            Circle()
                .fill(level.complete ? theme.scheme.accent : theme.scheme.backgroundSelected)
                .frame(width: 28, height: 28)
            if level.complete {
                Icon(name: .check, size: 15, color: theme.scheme.accentText)
            } else if !level.unlocked {
                Icon(name: .lock, size: 14, color: theme.scheme.textSecondary)
            } else {
                Text("\(level.level)")
                    .font(.custom(Typeface.sansBold, size: 13))
                    .monospacedDigit()
                    .foregroundStyle(theme.scheme.text)
            }
        }
    }

    private func milestoneRow(_ milestone: Milestone2) -> some View {
        // Somewhere to send them: in-app, not already done, and naming a tab
        // this app has. Fifteen of the thirty-four happen away from the app —
        // pricing competitors, ordering a sample — and those have no door.
        let destination: RootView.Tab? =
            milestone.completed || milestone.isOutside ? nil : tabFor(milestone.tab)

        return HStack(alignment: .top, spacing: 10) {
            checkbox(milestone)
            VStack(alignment: .leading, spacing: 2) {
                Text(milestone.title)
                    .font(.custom(Typeface.sansMedium, size: 14))
                    .foregroundStyle(milestone.completed ? theme.scheme.textSecondary : theme.scheme.text)
                    .strikethrough(milestone.completed, color: theme.scheme.textSecondary)
                if !milestone.completed {
                    Text(milestone.detail)
                        .font(.custom(Typeface.sansMedium, size: 12))
                        .foregroundStyle(theme.scheme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 4) {
                Text("+\(milestone.xp)")
                    .font(.custom(Typeface.sansBold, size: 12))
                    .monospacedDigit()
                    .foregroundStyle(milestone.completed ? theme.scheme.textSecondary : theme.scheme.accent)
                if destination != nil {
                    Icon(name: .chev, size: 14, color: theme.scheme.textSecondary, rotate: -90)
                }
            }
        }
        .padding(.vertical, 8)
        .overlay(alignment: .top) {
            Rectangle().fill(theme.scheme.border).frame(height: 1)
        }
        // The whole row, not just the chevron. A target the width of the sheet
        // is the difference between a list you read and a list you use.
        .contentShape(Rectangle())
        .onTapGesture {
            guard let destination else { return }
            onGoTo?(destination)
        }
        .accessibilityHint(destination != nil ? "Opens where this is done" : "")
    }

    /// Tappable only where the user is the one who knows.
    ///
    /// Milestones the server can prove — a business existing, a sale recorded —
    /// tick themselves and are not tappable. Offering a control that does
    /// nothing, or worse re-asserts something already true, is noise.
    @ViewBuilder private func checkbox(_ milestone: Milestone2) -> some View {
        let isBusy = busySlug == milestone.slug
        let canTick = !milestone.completed && !milestone.automatic

        Button {
            guard canTick else { return }
            Task { await complete(milestone) }
        } label: {
            ZStack {
                Circle()
                    .strokeBorder(
                        milestone.completed ? theme.scheme.customer : theme.scheme.border,
                        lineWidth: 1.5
                    )
                    .background(Circle().fill(milestone.completed ? theme.scheme.customer : .clear))
                    .frame(width: 20, height: 20)
                if milestone.completed {
                    Icon(name: .check, size: 12, color: theme.scheme.backgroundElement)
                } else if isBusy {
                    ProgressView().scaleEffect(0.5).tint(theme.scheme.accent)
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(!canTick || isBusy)
        .accessibilityLabel(
            milestone.completed ? "\(milestone.title), done"
                : milestone.automatic ? "\(milestone.title), completes on its own"
                : "Mark \(milestone.title) done"
        )
    }

    // MARK: - Playbooks

    private func playbooks(_ data: JourneyPayload) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Playbooks")
                .font(.custom(Typeface.display, size: 20))
                .foregroundStyle(theme.scheme.text)
            // Levels answer "what is next". Playbooks answer "why these, in
            // this order" — the reasoning a beginner would otherwise have to
            // learn by getting it wrong.
            Text("The same steps, grouped by what actually decides whether this works.")
                .font(.custom(Typeface.sansMedium, size: 13))
                .foregroundStyle(theme.scheme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            ForEach(data.playbooks) { playbook in
                VStack(alignment: .leading, spacing: 4) {
                    Text(playbook.name)
                        .font(.custom(Typeface.sansSemiBold, size: 15))
                        .foregroundStyle(theme.scheme.text)
                    Text(playbook.blurb)
                        .font(.custom(Typeface.sansMedium, size: 13))
                        .foregroundStyle(theme.scheme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("\(doneCount(playbook, in: data)) of \(playbook.steps.count) done")
                        .font(.custom(Typeface.sansBold, size: 12))
                        .monospacedDigit()
                        .foregroundStyle(theme.scheme.accent)
                        .padding(.top, 2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(theme.scheme.backgroundElement)
                .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                        .strokeBorder(theme.scheme.border, lineWidth: 1)
                }
            }
        }
        .padding(.top, 12)
    }

    private func doneCount(_ playbook: Playbook, in data: JourneyPayload) -> Int {
        let completed = Set(
            data.levels.flatMap(\.milestones).filter(\.completed).map(\.slug)
        )
        return playbook.steps.filter(completed.contains).count
    }

    // MARK: - Actions

    private func load() async {
        errorMessage = nil
        do {
            // Completions are private; the path itself is public. Someone with
            // no account sees the whole journey with nothing walked, which is
            // accurate rather than broken.
            let done = (try? await app.store.completedMilestones()) ?? []
            data = try await app.content.getJourney(completed: done)
        } catch {
            if data == nil { errorMessage = error.localizedDescription }
        }
    }

    private func complete(_ milestone: Milestone2) async {
        busySlug = milestone.slug
        defer { busySlug = nil }

        // Which levels were finished *before* this, so the reload can be
        // compared against it. Asking "is this level complete now" is not
        // enough — it would re-fire the level-up every time the sheet reloads.
        let completeBefore = Set((data?.levels ?? []).filter(\.complete).map(\.level))

        do {
            try await app.store.completeMilestone(slug: milestone.slug, xp: milestone.xp)
            // Reloaded rather than patched locally: completing the last step of
            // a level unlocks the next one, and the server decides that.
            await load()

            guard let fresh = data else { return }
            let newlyComplete = fresh.levels.first { $0.complete && !completeBefore.contains($0.level) }

            if let level = newlyComplete {
                // A level-up outranks the win. Finishing the last step of a
                // level would otherwise fire both, and the smaller moment is
                // not worth sitting through.
                celebrations.levelCompleted(name: level.name, title: level.title)
            } else {
                celebrations.completed(
                    title: milestone.title,
                    xp: milestone.xp,
                    totalXp: fresh.summary.xp,
                    next: nextNudge(fresh)
                )
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// The step after this one, if there is one worth pointing at.
    ///
    /// Only for in-app milestones — sending somebody to a tab to do something
    /// that happens on Etsy would be worse than saying nothing.
    private func nextNudge(_ data: JourneyPayload) -> Celebrations.Nudge? {
        guard let level = data.levels.first(where: { $0.unlocked && !$0.complete }),
              let next = level.milestones.first(where: { !$0.completed })
        else { return nil }

        return Celebrations.Nudge(
            title: next.title,
            tab: next.isOutside ? nil : tabFor(next.tab)
        )
    }

    private func tabFor(_ name: String?) -> RootView.Tab? {
        switch name {
        case "discover": return .discover
        case "grow": return .grow
        // The content files call the Business tab "shop".
        case "shop", "business": return .business
        case "you": return .you
        default: return nil
        }
    }
}
