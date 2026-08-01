import Foundation

// What a screen hands to the store when it wants to change something.
//
// These outlived the API client they were written for. They are not request
// bodies any more — nothing is serialised, and `Encodable` is gone with the
// HTTP — but they are still the right shape: a form's worth of fields, named
// for the thing being changed, so a call site cannot silently pass a business
// where a profile goes.

struct CreateProfile {
    let name: String
    /// Empty at onboarding. There is no sign-in to read an address from, and
    /// inventing one would be worse than leaving it blank — it is editable in
    /// You → About you for anyone who wants to give it.
    let email: String
    let age: Int
    let gender: String
    let experienceLevel: String
}

struct UpdateProfile {
    let name: String
    let email: String
    /// Re-sent unchanged: the write patches only what it receives.
    let age: Int
    let gender: String
    let location: String?
    let bio: String?
    let goals: String?
}

struct CreateBusiness {
    let name: String
    let niche: String
    let description: String
    let businessType: String?
}

struct UpdateBusiness {
    let name: String
    let niche: String
    let description: String
    /// An empty string clears it. `nil` leaves it untouched.
    let pageUrl: String?
}

struct CreatePayment {
    let businessId: String
    let amount: Double
    let note: String?
}

/// Requires one of `sourceUrl` or `noLinkKind` — every contact belongs to a
/// channel, and the channel has to be derivable from something.
struct CreateContact {
    let businessId: String
    let name: String
    let sourceUrl: String?
    /// REFERRAL | IN_PERSON | OTHER
    let noLinkKind: String?

    static func fromLink(businessId: String, name: String, url: String) -> CreateContact {
        CreateContact(businessId: businessId, name: name, sourceUrl: url, noLinkKind: nil)
    }

    static func inPerson(businessId: String, name: String) -> CreateContact {
        CreateContact(businessId: businessId, name: name, sourceUrl: nil, noLinkKind: "IN_PERSON")
    }
}

struct SocialLinkInput {
    let platform: String
    let url: String
}
