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

    /// Loaded once, for the reveal. Onboarding is the only place the app shows
    /// a product before the user has ever seen the feed.
    @State private var catalogue: [DiscoverProduct] = []
    /// The sourcing type the first reveal used, so the second avoids it.
    @State private var firstModel: String?

    /// Created, written, and deliberately not announced until the closing
    /// sequence has played. See `submit`.
    @State private var pendingProfile: UserProfile?
    @State private var pendingBusiness: Business?

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
                case .finish:
                    ReadySequence(name: firstName, closer: script.finish.copy(forPath: path).cta) {
                        // Handing over is what moves the app on: the mode
                        // recomputes, RootView swaps onboarding for the shell,
                        // and the fade lands on Discover.
                        if let pendingProfile { app.profileCreated(pendingProfile) }
                        if let pendingBusiness { app.businessCreated(pendingBusiness) }
                    }
                }
            } else {
                ProgressView().tint(theme.scheme.accent)
            }
        }
        .task {
            script = try? await app.content.getOnboardingScript()
            // Fetched here rather than on the reveal step so the product is
            // already in hand when they finish typing — a spinner between a
            // question and its answer would undo the moment.
            catalogue = (try? await app.content.getTrends(businessId: nil))?.products ?? []
        }
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
        var out: [Question] = []

        // Taken from the script rather than written here: the reason the copy
        // lives in content/onboarding.json is that these screens can be
        // reworded without an App Store release, and a literal undoes that
        // quietly — the JSON changes and the app does not.
        out.append(.text(step: script.shared.first { $0.id == "name" } ?? .nameFallback))

        out.append(.age)

        if let fork = script.shared.first(where: { $0.type == "fork" }) {
            out.append(.fork(step: fork))
        }

        guard let path else { return out }

        if path == "new" {
            // Prompt, then the answer to it, then the next prompt. The reveal
            // is the point of asking — a question with no answer is a form.
            out.append(.prompt(index: 0))
            if promptAnswers.count >= 1 {
                if script.reveal != nil { out.append(.reveal(index: 0)) }
                out.append(.prompt(index: 1))
            }
            if promptAnswers.count >= 2, script.reveal != nil {
                out.append(.reveal(index: 1))
            }
        } else if let forkSteps = script.forks[path] {
            for step in forkSteps {
                out.append(.text(step: step))
            }
        }
        return out
    }

    private enum Question: Equatable {
        /// Carries the whole step, not its fields: `optional` decides whether
        /// the button unlocks, and unpacking only the copy loses it.
        case text(step: OnboardingScript.Step)
        case age
        case fork(step: OnboardingScript.Step)
        case prompt(index: Int)
        case reveal(index: Int)
    }

    private func questions(_ script: OnboardingScript) -> some View {
        let all = steps(script)
        let current = all[min(stepIndex, all.count - 1)]

        return VStack(alignment: .leading, spacing: 0) {
            header(total: all.count)

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    switch current {
                    case let .text(step):
                        textQuestion(step)
                    case .age:
                        ageQuestion
                    case let .fork(step):
                        forkQuestion(step)
                    case let .prompt(index):
                        promptQuestion(script, index: index)
                    case let .reveal(index):
                        revealStep(script, index: index)
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

    private func textQuestion(_ step: OnboardingScript.Step) -> some View {
        // "What do you sell?" asks for a sentence and the script types it as a
        // textarea. Growing the field is the difference between an answer that
        // fits and one you write blind.
        let isLong = step.type == "textarea"
        return VStack(alignment: .leading, spacing: 0) {
            Text(step.title)
                .font(.custom(Typeface.display, size: 30))
                .tracking(-0.6)
                .lineSpacing(4)
                .foregroundStyle(theme.scheme.text)
                .fixedSize(horizontal: false, vertical: true)
            if let subtitle = step.subtitle {
                Text(subtitle)
                    .font(.custom(Typeface.sansMedium, size: 15))
                    .lineSpacing(6)
                    .foregroundStyle(theme.scheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
            }
            TextField(
                step.placeholder ?? "",
                text: binding(for: step.id),
                axis: isLong ? .vertical : .horizontal
            )
                .lineLimit(isLong ? 3...6 : 1...1)
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

    // MARK: - Reveal

    /// The app's turn. They answered a question in their own words; this comes
    /// back with a real product, what it costs, what it sells for, and what
    /// that business actually asks of them.
    ///
    /// Everything here is content: the chapter heading and closer come from the
    /// prompt's mode, the model sentence from the product's sourcing type, the
    /// arithmetic from a template. Nothing is invented — where the catalogue
    /// had no match, the copy says so rather than implying this was chosen.
    @ViewBuilder private func revealStep(_ script: OnboardingScript, index: Int) -> some View {
        if let reveal = script.reveal,
           index < promptAnswers.count,
           let answer = promptAnswers.indices.contains(index) ? promptAnswers[index] : nil,
           let option = script.prompts.options.first(where: { $0.id == answer.promptId }),
           let match = RevealMatch.pick(
               for: answer.text,
               mode: option.mode ?? "product",
               from: catalogue,
               excluding: index == 1 ? firstModel : nil
           ) {
            let mode = reveal.modes[option.mode ?? "product"] ?? reveal.modes["product"]
            let product = match.product

            VStack(alignment: .leading, spacing: 0) {
                if let chapter = mode?.chapter {
                    Text(chapter.uppercased())
                        .font(.custom(Typeface.sansBold, size: 11))
                        .tracking(1)
                        .foregroundStyle(theme.scheme.accent)
                        .padding(.bottom, 12)
                }

                if let raw = product.imageUrl, let url = URL(string: raw) {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image {
                            image.resizable().scaledToFill()
                        } else {
                            theme.scheme.accentSoft
                        }
                    }
                    .frame(height: 160)
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    .padding(.bottom, 14)
                }

                if let lead = option.lead {
                    Text(lead)
                        .font(.custom(Typeface.sansMedium, size: 14))
                        .foregroundStyle(theme.scheme.accent)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.bottom, 8)
                }

                Text(product.title)
                    .font(.custom(Typeface.display, size: 26))
                    .tracking(-0.5)
                    .foregroundStyle(theme.scheme.text)
                    .fixedSize(horizontal: false, vertical: true)

                Text(match.matched
                     ? product.blurb
                     : [reveal.fallbackNote, product.blurb].compactMap { $0 }.joined(separator: " "))
                    .font(.custom(Typeface.sansMedium, size: 14))
                    .lineSpacing(4)
                    .foregroundStyle(theme.scheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 6)

                // The two numbers, side by side. This is the whole argument:
                // somebody buys it for one price and sells it for another.
                HStack(spacing: 0) {
                    figure(reveal.costLabel ?? "costs about", product.sourceCost ?? "—", tint: nil)
                    figure(reveal.sellLabel ?? "sells for", product.typicalResale ?? "—",
                           tint: theme.scheme.customer)
                }
                .padding(.top, 18)

                if option.mode == "math",
                   let template = reveal.mathTemplate,
                   let margin = RevealMatch.margin(cost: product.sourceCost, resale: product.typicalResale) {
                    Text(template
                            .replacingOccurrences(of: "{margin}", with: "\(margin)")
                            .replacingOccurrences(of: "{count}", with: "\(Int(ceil(500.0 / Double(margin))))"))
                        .font(.custom(Typeface.sansSemiBold, size: 15))
                        .foregroundStyle(theme.scheme.text)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 16)
                }

                if let type = product.sourcingType, let sentence = reveal.models[type] {
                    Text(sentence)
                        .font(.custom(Typeface.sansMedium, size: 14))
                        .lineSpacing(4)
                        .foregroundStyle(theme.scheme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 16)
                }

                if let closer = index == 0 ? mode?.closer : reveal.closerSecond {
                    Text(closer)
                        .font(.custom(Typeface.sansSemiBold, size: 15))
                        .lineSpacing(4)
                        .foregroundStyle(theme.scheme.text)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 18)
                }
            }
            // Remembered so the second reveal offers a different kind of
            // business — two suggestions that source the same way is one
            // suggestion shown twice.
            .onAppear { if index == 0 { firstModel = product.sourcingType } }
        } else {
            ProgressView()
                .tint(theme.scheme.accent)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 60)
        }
    }

    private func figure(_ label: String, _ value: String, tint: Color?) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.custom(Typeface.sansMedium, size: 12))
                .foregroundStyle(theme.scheme.textSecondary)
            Text(value)
                .font(.custom(Typeface.display, size: 20))
                .tracking(-0.3)
                .foregroundStyle(tint ?? theme.scheme.text)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
        case .text(let step):
            // A step the script calls optional advances empty. Without this the
            // button stays greyed under a subtitle inviting you to skip.
            if step.isSkippable { return true }
            return !binding(for: step.id).wrappedValue.trimmingCharacters(in: .whitespaces).isEmpty
        case .age:
            guard let value = Int(age.trimmingCharacters(in: .whitespaces)) else { return false }
            return (13...120).contains(value)
        case .fork:
            return path != nil
        case .prompt(let index):
            guard index < promptAnswers.count else { return false }
            return !promptAnswers[index].text.trimmingCharacters(in: .whitespaces).isEmpty
        case .reveal:
            // Nothing to fill in. This one is the app's turn.
            return true
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
            let profile = try await app.store.createProfile(
                CreateProfile(
                    name: trimmedName,
                    // Empty, and deliberately. There is no sign-in to read an
                    // address from any more, and inventing one would break the
                    // rule that an empty field beats a number nobody can stand
                    // behind. It is editable in You → About you for anyone who
                    // wants to give it — which also means the app now collects
                    // less than the privacy policy allows for, not more.
                    email: "",
                    age: ageValue,
                    gender: "",
                    experienceLevel: isNew ? "FIRST_TIME" : "EXPERIENCED"
                )
            )

            // Written, but not announced yet.
            //
            // Telling AppState about the profile recomputes the mode, and
            // RootView unmounts onboarding the moment it does — which is why
            // the finish screen has never once been seen. The records are held
            // here and handed over when the sequence ends, so the last thing
            // this flow does is actually shown.
            pendingProfile = profile

            if isNew {
                // An explorer has no business to rank Discover against, so what
                // they told us stands in for one.
                Preferences.interests = promptAnswers.map(\.text)
            } else {
                pendingBusiness = try await app.store.createBusiness(
                    CreateBusiness(
                        name: forkFields["bizName"] ?? trimmedName,
                        niche: forkFields["bizNiche"] ?? "",
                        description: forkFields["idealCustomer"] ?? "",
                        businessType: nil
                    )
                )
            }

            withAnimation { stage = .finish }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
