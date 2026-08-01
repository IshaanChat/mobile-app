import Foundation

/// The onboarding script, fetched from `/api/onboarding`.
///
/// The wording lives in `server/content/onboarding.json` rather than in this
/// binary so the first four screens anybody ever sees can be rewritten without
/// an App Store release.
///
/// Every field the app depends on for *structure* is required; everything that
/// is only copy is optional, so a trimmed or extended script cannot crash
/// onboarding — the worst case is a missing sentence.
struct OnboardingScript: Codable, Equatable {
    let welcome: Welcome
    let shared: [Step]
    let prompts: Prompts
    /// The payoff after each prompt: a real product matched to what they typed,
    /// with what it costs and what it sells for. Optional so a script written
    /// without it still decodes — but its absence is why onboarding used to go
    /// straight from the last question to a feed, which is the app asking twice
    /// and answering never.
    let reveal: Reveal?
    let forks: [String: [Step]]
    /// Not a dictionary. `finish` holds `have` and `new` objects alongside a
    /// plain-string `note`, so decoding it as `[String: Finish]` throws on the
    /// string and takes onboarding down with it.
    let finish: FinishSet

    struct FinishSet: Codable, Equatable {
        let have: Finish
        let new: Finish
        /// Where the things you skipped went.
        let note: String?

        func copy(forPath path: String?) -> Finish {
            path == "have" ? have : new
        }
    }

    struct Welcome: Codable, Equatable {
        let eyebrow: String?
        let title: String
        let body: String?
        let meta: String?
        let cta: String?
    }

    struct Step: Codable, Equatable, Identifiable {
        let id: String
        /// "text" | "textarea" | "fork"
        let type: String
        let chapter: String?
        let title: String
        let subtitle: String?
        let placeholder: String?
        let required: Bool?
        /// The script marks a step skippable with `optional`, not by setting
        /// `required` to false. Missing it means "Who buys from you?" — whose
        /// own subtitle says "Skip it if you're still working that out" —
        /// cannot actually be skipped.
        let optional: Bool?
        let options: [Option]?

        var isSkippable: Bool { optional == true || required == false }

        /// Onboarding has to be able to ask for a name even if the script
        /// arrives without that step.
        static let nameFallback = Step(
            id: "name",
            type: "text",
            chapter: "About you",
            title: "First — what's your name?",
            subtitle: "The one you'd want customers to know you by.",
            placeholder: "Your name",
            required: true,
            optional: nil,
            options: nil
        )

        struct Option: Codable, Equatable, Identifiable {
            let value: String
            let label: String
            let hint: String?
            var id: String { value }
        }
    }

    struct Prompts: Codable, Equatable {
        let chapter: String?
        let title: String
        let subtitle: String?
        let titleSecond: String?
        let subtitleSecond: String?
        let change: String?
        let options: [PromptOption]
    }

    /// One of the Hinge-style prompts. `mode` narrows which are offered; `lead`
    /// is the line shown once it is picked.
    struct PromptOption: Codable, Equatable, Identifiable {
        let id: String
        let mode: String?
        let label: String
        let placeholder: String?
        let lead: String?
    }

    struct Finish: Codable, Equatable {
        let eyebrow: String?
        let title: String
        let body: String?
        let cta: String?
    }

    struct Reveal: Codable, Equatable {
        let costLabel: String?
        let sellLabel: String?
        /// sourcingType → the sentence explaining what that actually asks of
        /// them. "You'd never touch these. A supplier ships them straight to
        /// the buyer."
        let models: [String: String]
        /// The prompt's mode → the chapter heading and the closing line.
        let modes: [String: Mode]
        /// "Clear about ${margin} a sale. That's {count} sales to reach $500."
        let mathTemplate: String?
        /// Shown when nothing in the catalogue matched what they typed. Says so
        /// rather than pretending the fallback was chosen for them.
        let fallbackNote: String?
        let closerSecond: String?
        let cta: String?
        let ctaSecond: String?

        struct Mode: Codable, Equatable {
            let chapter: String
            let closer: String
        }
    }
}

/// One answered prompt.
struct PromptAnswer: Equatable, Identifiable {
    let promptId: String
    let label: String
    var text: String
    var id: String { promptId }
}
