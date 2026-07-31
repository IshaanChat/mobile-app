import SwiftUI

/// Onboarding: one question at a time, full screen, warm.
///
/// The flow comes from the prototype, not from the React Native app — the
/// Hinge-style prompts rather than a form. One deliberate addition: an **age**
/// step, which the prototype has no reason to ask for and the real app does.
/// The server requires 13–120, and that floor is the under-13 gate that keeps
/// this app outside COPPA. It is asked plainly rather than dressed up as
/// personalisation, because it does not personalise anything.
struct OnboardingScreen: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app

    @State private var script: OnboardingScript?
    @State private var stage: Stage = .welcome
    @State private var stepIndex = 0

    // Answers
    @State private var name = ""
    @State private var age = ""
    @State private var path: String?
    @State private var promptAnswers: [PromptAnswer] = []
    @State private var forkFields: [String: String] = [:]

    @State private var isSubmitting = false
    @State private var errorMessage: String?

    private enum Stage: Equatable {
        case welcome
        case questions
        case finish
    }

    var body: some View {
        ZStack {
            theme.scheme.background.ignoresSafeArea()

            if let script {
                switch stage {
                case .welcome: welcome(script.welcome)
                case .questions: questions(script)
                case .finish: finish(script)
                }
            } else {
                ProgressView().tint(theme.scheme.accent)
            }
        }
        .task { script = try? await app.api.getOnboardingScript() }
    }

    // MARK: - Welcome

    private func welcome(_ copy: OnboardingScript.Welcome) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer()
            if let eyebrow = copy.eyebrow {
                Text(eyebrow.uppercased())
                    .font(.custom(Typeface.sansBold, size: 11))
                    .tracking(1)
                    .foregroundStyle(theme.scheme.accent)
                    .padding(.bottom, 10)
            }
            Text(copy.title)
                .font(.custom(Typeface.display, size: 30))
                .tracking(-0.6)
                .lineSpacing(6)
                .foregroundStyle(theme.scheme.text)
                .fixedSize(horizontal: false, vertical: true)
            if let body = copy.body {
                Text(body)
                    .font(.custom(Typeface.sansMedium, size: 15))
                    .lineSpacing(8)
                    .foregroundStyle(theme.scheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 14)
            }
            Spacer()
            if let meta = copy.meta {
                Text(meta)
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.textSecondary)
                    .padding(.bottom, 12)
            }
            PrimaryButton(label: copy.cta ?? "Start") {
                withAnimation { stage = .questions }
            }
        }
        .padding(.horizontal, 28)
        .padding(.bottom, 32)
    }

    // MARK: - Questions

    /// The steps for the answers given so far.
    ///
    /// Rebuilt on every access rather than stored, because choosing a path
    /// changes what comes next — a cached list would keep asking the questions
    /// belonging to a fork the user has since left.
    private func steps(_ script: OnboardingScript) -> [Question] {
        var out: [Question] = [.text(id: "name", title: "First — what's your name?",
                                     subtitle: "The one you'd want customers to know you by.",
                                     placeholder: "Your name")]

        out.append(.age)

        if let fork = script.shared.first(where: { $0.type == "fork" }) {
            out.append(.fork(step: fork))
        }

        guard let path else { return out }

        if path == "new" {
            // Two prompts, asked one at a time.
            out.append(.prompt(index: 0))
            if promptAnswers.count >= 1 { out.append(.prompt(index: 1)) }
        } else if let forkSteps = script.forks[path] {
            for step in forkSteps {
                out.append(.text(id: step.id, title: step.title,
                                 subtitle: step.subtitle, placeholder: step.placeholder))
            }
        }
        return out
    }

    private enum Question: Equatable {
        case text(id: String, title: String, subtitle: String?, placeholder: String?)
        case age
        case fork(step: OnboardingScript.Step)
        case prompt(index: Int)
    }

    private func questions(_ script: OnboardingScript) -> some View {
        let all = steps(script)
        let current = all[min(stepIndex, all.count - 1)]

        return VStack(alignment: .leading, spacing: 0) {
            header(total: all.count)

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    switch current {
                    case let .text(id, title, subtitle, placeholder):
                        textQuestion(id: id, title: title, subtitle: subtitle, placeholder: placeholder)
                    case .age:
                        ageQuestion
                    case let .fork(step):
                        forkQuestion(step)
                    case let .prompt(index):
                        promptQuestion(script, index: index)
                    }
                }
                .padding(.top, 20)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.danger)
                    .padding(.bottom, 10)
            }

            PrimaryButton(label: isSubmitting ? "Setting up…" : ctaLabel(all)) {
                advance(all, script: script)
            }
            .disabled(!canAdvance(current) || isSubmitting)
            .opacity(canAdvance(current) ? 1 : 0.5)
        }
        .padding(.horizontal, 28)
        .padding(.bottom, 32)
    }

    private func header(total: Int) -> some View {
        HStack(spacing: 10) {
            if stepIndex > 0 {
                Button {
                    withAnimation { stepIndex -= 1 }
                } label: {
                    Icon(name: .chev, size: 18, color: theme.scheme.textSecondary, rotate: 90)
                }
                .buttonStyle(.plain)
            }
            HStack(spacing: 5) {
                ForEach(0..<total, id: \.self) { i in
                    Circle()
                        .fill(i <= stepIndex ? theme.scheme.accent : theme.scheme.border)
                        .frame(width: 8, height: 8)
                }
            }
            Spacer()
        }
        .padding(.top, 12)
    }

    // MARK: - Question kinds

    private func textQuestion(id: String, title: String, subtitle: String?, placeholder: String?) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(.custom(Typeface.display, size: 30))
                .tracking(-0.6)
                .lineSpacing(4)
                .foregroundStyle(theme.scheme.text)
                .fixedSize(horizontal: false, vertical: true)
            if let subtitle {
                Text(subtitle)
                    .font(.custom(Typeface.sansMedium, size: 15))
                    .lineSpacing(6)
                    .foregroundStyle(theme.scheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
            }
            TextField(placeholder ?? "", text: binding(for: id))
                .font(.custom(Typeface.sansMedium, size: 18))
                .foregroundStyle(theme.scheme.text)
                .padding(.horizontal, 14)
                .padding(.vertical, 13)
                .background(theme.scheme.backgroundElement)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(theme.scheme.border, lineWidth: 1)
                }
                .padding(.top, 22)
        }
    }

    private var ageQuestion: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("How old are you?")
                .font(.custom(Typeface.display, size: 30))
                .tracking(-0.6)
                .foregroundStyle(theme.scheme.text)
            // Honest about why. It does not tune anything, and saying it does
            // would be a small lie in the one place the app is asking for
            // something personal.
            Text("Venturo is for 13 and over. That's the only reason we ask.")
                .font(.custom(Typeface.sansMedium, size: 15))
                .lineSpacing(6)
                .foregroundStyle(theme.scheme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
            TextField("Your age", text: $age)
                .keyboardType(.numberPad)
                .font(.custom(Typeface.sansMedium, size: 18))
                .foregroundStyle(theme.scheme.text)
                .padding(.horizontal, 14)
                .padding(.vertical, 13)
                .background(theme.scheme.backgroundElement)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(theme.scheme.border, lineWidth: 1)
                }
                .padding(.top, 22)
        }
    }

    private func forkQuestion(_ step: OnboardingScript.Step) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(step.title)
                .font(.custom(Typeface.display, size: 30))
                .tracking(-0.6)
                .foregroundStyle(theme.scheme.text)
                .fixedSize(horizontal: false, vertical: true)
            if let subtitle = step.subtitle {
                Text(subtitle)
                    .font(.custom(Typeface.sansMedium, size: 15))
                    .foregroundStyle(theme.scheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
            }
            VStack(spacing: 10) {
                ForEach(step.options ?? []) { option in
                    Button {
                        path = option.value
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(option.label)
                                .font(.custom(Typeface.sansSemiBold, size: 16))
                                .foregroundStyle(theme.scheme.text)
                            if let hint = option.hint {
                                Text(hint)
                                    .font(.custom(Typeface.sansMedium, size: 13))
                                    .foregroundStyle(theme.scheme.textSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(14)
                        .background(path == option.value ? theme.scheme.accentSoft : theme.scheme.backgroundElement)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .strokeBorder(
                                    path == option.value ? theme.scheme.accent : theme.scheme.border,
                                    lineWidth: path == option.value ? 1.5 : 1
                                )
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 22)
        }
    }

    private func promptQuestion(_ script: OnboardingScript, index: Int) -> some View {
        let isSecond = index == 1
        let title = isSecond ? (script.prompts.titleSecond ?? script.prompts.title) : script.prompts.title
        let subtitle = isSecond ? script.prompts.subtitleSecond : script.prompts.subtitle
        let picked = index < promptAnswers.count ? promptAnswers[index] : nil
        // Never offer the same prompt twice.
        let taken = Set(promptAnswers.prefix(index).map(\.promptId))

        return VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(.custom(Typeface.display, size: 30))
                .tracking(-0.6)
                .foregroundStyle(theme.scheme.text)
                .fixedSize(horizontal: false, vertical: true)
            if let subtitle {
                Text(subtitle)
                    .font(.custom(Typeface.sansMedium, size: 15))
                    .foregroundStyle(theme.scheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
            }

            if let picked, let option = script.prompts.options.first(where: { $0.id == picked.promptId }) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(option.label)
                            .font(.custom(Typeface.sansSemiBold, size: 16))
                            .foregroundStyle(theme.scheme.text)
                        Spacer()
                        Button(script.prompts.change ?? "Change") {
                            promptAnswers.removeSubrange(index..<promptAnswers.count)
                        }
                        .font(.custom(Typeface.sansSemiBold, size: 13))
                        .foregroundStyle(theme.scheme.accent)
                    }
                    if let lead = option.lead {
                        Text(lead)
                            .font(.custom(Typeface.sansMedium, size: 13))
                            .foregroundStyle(theme.scheme.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    TextField(
                        option.placeholder ?? "",
                        text: Binding(
                            get: { index < promptAnswers.count ? promptAnswers[index].text : "" },
                            set: { if index < promptAnswers.count { promptAnswers[index].text = $0 } }
                        ),
                        axis: .vertical
                    )
                    .lineLimit(3...6)
                    .font(.custom(Typeface.sansMedium, size: 16))
                    .foregroundStyle(theme.scheme.text)
                    .padding(14)
                    .background(theme.scheme.backgroundElement)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(theme.scheme.border, lineWidth: 1)
                    }
                }
                .padding(.top, 22)
            } else {
                VStack(spacing: 10) {
                    ForEach(script.prompts.options.filter { !taken.contains($0.id) }) { option in
                        Button {
                            promptAnswers.append(
                                PromptAnswer(promptId: option.id, label: option.label, text: "")
                            )
                        } label: {
                            Text(option.label)
                                .font(.custom(Typeface.sansMedium, size: 15))
                                .foregroundStyle(theme.scheme.text)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(14)
                                .background(theme.scheme.backgroundElement)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .strokeBorder(theme.scheme.border, lineWidth: 1)
                                }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.top, 22)
            }
        }
    }

    // MARK: - Finish

    private func finish(_ script: OnboardingScript) -> some View {
        let copy: OnboardingScript.Finish? = script.finish.copy(forPath: path)
        return VStack(alignment: .leading, spacing: 0) {
            Spacer()
            if let eyebrow = copy?.eyebrow {
                Text(eyebrow.uppercased())
                    .font(.custom(Typeface.sansBold, size: 11))
                    .tracking(1)
                    .foregroundStyle(theme.scheme.accent)
                    .padding(.bottom, 10)
            }
            Text((copy?.title ?? "Welcome, {name}.").replacingOccurrences(of: "{name}", with: firstName))
                .font(.custom(Typeface.display, size: 30))
                .tracking(-0.6)
                .foregroundStyle(theme.scheme.text)
                .fixedSize(horizontal: false, vertical: true)
            if let body = copy?.body {
                Text(body.replacingOccurrences(of: "{biz}", with: forkFields["bizName"] ?? "Your business"))
                    .font(.custom(Typeface.sansMedium, size: 15))
                    .lineSpacing(8)
                    .foregroundStyle(theme.scheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 14)
            }
            Spacer()
            PrimaryButton(label: copy?.cta ?? "Let's go") {
                // Nothing to do: the profile already exists, so the mode
                // machine has already moved the app on. This button only
                // dismisses the sentence.
            }
        }
        .padding(.horizontal, 28)
        .padding(.bottom, 32)
    }

    private var firstName: String {
        name.split(separator: " ").first.map(String.init) ?? name
    }

    // MARK: - Flow

    private func binding(for id: String) -> Binding<String> {
        if id == "name" { return $name }
        return Binding(
            get: { forkFields[id] ?? "" },
            set: { forkFields[id] = $0 }
        )
    }

    private func canAdvance(_ question: Question) -> Bool {
        switch question {
        case .text(let id, _, _, _):
            return !binding(for: id).wrappedValue.trimmingCharacters(in: .whitespaces).isEmpty
        case .age:
            guard let value = Int(age.trimmingCharacters(in: .whitespaces)) else { return false }
            return (13...120).contains(value)
        case .fork:
            return path != nil
        case .prompt(let index):
            guard index < promptAnswers.count else { return false }
            return !promptAnswers[index].text.trimmingCharacters(in: .whitespaces).isEmpty
        }
    }

    private func ctaLabel(_ all: [Question]) -> String {
        stepIndex >= all.count - 1 ? "Let's go" : "Continue"
    }

    private func advance(_ all: [Question], script: OnboardingScript) {
        errorMessage = nil
        if stepIndex < all.count - 1 {
            withAnimation { stepIndex += 1 }
        } else {
            Task { await submit() }
        }
    }

    private func submit() async {
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let ageValue = Int(age.trimmingCharacters(in: .whitespaces)) ?? 0
        let isNew = path == "new"

        do {
            let profile = try await app.api.createProfile(
                CreateProfile(
                    name: trimmedName,
                    // Read from Clerk rather than asked for: the user has
                    // already proved this address, and asking again invites a
                    // different one being typed. The fallback should be
                    // unreachable — there is no way to get here without a
                    // session — but the server requires something
                    // address-shaped, and a placeholder that is obviously one
                    // beats a crash.
                    email: AccountEmail.current ?? "\(UUID().uuidString)@pending.venturo.app",
                    age: ageValue,
                    gender: "",
                    experienceLevel: isNew ? "FIRST_TIME" : "EXPERIENCED"
                )
            )

            if isNew {
                // An explorer has no business to rank Discover against, so what
                // they told us stands in for one.
                Preferences.interests = promptAnswers.map(\.text)
                // Order matters: the profile lands first so the mode machine
                // moves onboarding -> explorer in one step rather than
                // flickering through an intermediate state.
                app.profileCreated(profile)
            } else {
                let business = try await app.api.createBusiness(
                    CreateBusiness(
                        name: forkFields["bizName"] ?? trimmedName,
                        niche: forkFields["bizNiche"] ?? "",
                        description: forkFields["idealCustomer"] ?? "",
                        businessType: nil
                    )
                )
                // Both before any mode recompute, so the app goes straight from
                // onboarding to active without passing through explorer — which
                // would redirect out of this flow mid-way.
                app.profileCreated(profile)
                app.businessCreated(business)
            }

            withAnimation { stage = .finish }
        } catch let error as APIError {
            errorMessage = error.message
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
