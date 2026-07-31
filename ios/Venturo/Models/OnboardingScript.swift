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
        /// "text" | "fork"
        let type: String
        let chapter: String?
        let title: String
        let subtitle: String?
        let placeholder: String?
        let required: Bool?
        let options: [Option]?

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
}

/// One answered prompt.
struct PromptAnswer: Equatable, Identifiable {
    let promptId: String
    let label: String
    var text: String
    var id: String { promptId }
}
