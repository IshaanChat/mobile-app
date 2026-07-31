import Foundation

// The API's data model, mirrored from mobile/src/types/index.ts and verified
// against what server/src/routes actually serialises.
//
// Two rules run through all of this:
//
// 1. **Optionality is copied from the server, not guessed.** A field typed
//    non-optional here that arrives null crashes the decode and takes the whole
//    screen with it. Where the server can return null, so can this.
//
// 2. **Server enums are decoded as String, not as Swift enums.** `gender`,
//    `status`, `sourcingType`, `platform` and friends are plain text columns in
//    Postgres with no database-level constraint. A Swift enum would throw on
//    any value the server started sending that this build had not heard of —
//    turning a new content category into a crash. The typed helpers below give
//    exhaustiveness where it is useful without that failure mode.

// MARK: - Profile

struct UserProfile: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let email: String
    let age: Int
    /// WOMAN | MAN | NON_BINARY | OTHER | PREFER_NOT_TO_SAY
    let gender: String
    let location: String?
    let phone: String?
    let bio: String?
    /// FIRST_TIME | SOME_EXPERIENCE | EXPERIENCED
    let experienceLevel: String?
    let goals: String?
    let createdAt: Date
    let updatedAt: Date
}

// MARK: - Business

struct Business: Codable, Identifiable, Equatable, Hashable {
    let id: String
    let name: String
    let niche: String
    let description: String
    let idealCustomer: String?
    let audienceKeywords: String?
    let salesAvenues: String?
    /// PRODUCT_SALES | SERVICE | KNOWLEDGE | OTHER
    let businessType: String?
    let pageUrl: String?
    let createdAt: Date
    let updatedAt: Date
}

struct SocialLink: Codable, Identifiable, Equatable {
    let id: String
    /// TWITTER | INSTAGRAM | TIKTOK | YOUTUBE | REDDIT | FACEBOOK | PINTEREST
    let platform: String
    let url: String
    let businessId: String
}

// MARK: - Discover

struct TrendsPayload: Codable, Equatable {
    let generatedAt: Date
    /// "niche" | "trending"
    let sort: String
    /// Empty when sorting by trend. `productIds` index into `products` — the
    /// server sends each product once and references it, so do not duplicate.
    let sections: [TrendSection]
    /// `var` so an optimistic save can flip one row in place. Everything else
    /// here stays `let`: this is the only field the client is allowed to change
    /// without the server having said so.
    var products: [DiscoverProduct]
}

struct TrendSection: Codable, Equatable {
    let key: String
    let title: String
    let productIds: [String]
}

struct DiscoverProduct: Codable, Identifiable, Equatable {
    let id: String
    let slug: String
    let title: String
    let blurb: String
    let category: String
    /// Null when the product's niche was archived out from under it.
    let niche: ProductNiche?
    /// DROPSHIP | WHOLESALE | PRINT_ON_DEMAND | MATERIALS | MAKE_YOUR_OWN
    let sourcingType: String?
    let sourceName: String?
    let sourcingUrl: String?
    /// Free text, and deliberately so — the honest answer is usually a range
    /// with a unit, like "$3–5/unit". Never parse this into a number.
    let sourceCost: String?
    let typicalResale: String?
    let priceRange: String?
    let imageUrl: String?
    let imageCredit: String?
    /// Never null. Two different scales share this field: curated products
    /// carry machine-measured heat (roughly 8–55) while sourced products carry
    /// a criteria-fit score (roughly 78–97). That is why "Hot" is a percentile
    /// of the loaded feed rather than a fixed threshold — see DiscoverFeed.
    let hotness: Int
    /// Null unless something was actually measured. Empty is honest here.
    let evidence: DiscoverEvidence?
    /// `var` for the optimistic heart — the only field the client flips before
    /// the server confirms it.
    var saved: Bool
    /// Only present on the saved shelf.
    let savedAt: Date?
}

struct ProductNiche: Codable, Equatable {
    let slug: String
    let name: String
    let domain: String
    /// maker | reseller | both
    let audience: String
}

/// Every field is optional except `sources`. The content rule is that an empty
/// field beats an invented number, so most products carry very little of this.
struct DiscoverEvidence: Codable, Equatable {
    let heat: Int?
    let heatDelta: Int?
    let unitsSold: Int?
    let listings: Int?
    /// "low" | "medium" | "high"
    let saturation: String?
    let priceLow: Double?
    let priceHigh: Double?
    let adCount: Int?
    let adDaysLive: Int?
    let adReach: Int?
    let interest: Int?
    let interestTrend: Double?
    let liveSourcingUrl: String?
    let liveMerchant: String?
    /// "meta" | "manual"
    let adSource: String?
    let adCoverage: String?
    let adEvidenceUrl: String?
    let adAdvertiser: String?
    /// Never null, often empty.
    let sources: [String]
    let polledAt: Date?
}

// MARK: - Tips

/// The two things a mission cannot carry: a small practical detail nobody
/// thought to mention, and a line that exists purely to be on your side.
///
/// `id` here is the server's `slug` — the stable curator-chosen identity, not
/// the database row id — because which tips somebody has seen is tracked on the
/// device and has to survive the row being re-imported.
struct Tip: Codable, Identifiable, Equatable {
    let id: String
    let slug: String
    /// "know" — practical. "lift" — encouragement, or a joke.
    let kind: String
    let text: String
    /// discover | grow | shop | you | any
    let tab: String
    let level: Int

    var isLift: Bool { kind == "lift" }
}

struct TipsPayload: Codable, Equatable {
    let tips: [Tip]
}

// MARK: - Growth

struct GrowthPayload: Codable, Equatable {
    let generatedAt: Date
    let posts: [GrowthPost]
}

struct GrowthPost: Codable, Identifiable, Equatable {
    let id: String
    let title: String
    let platform: String
    /// community | hashtag | marketplace | search | event
    let kind: String
    let url: String
    let tagline: String
    let audience: String
    let imageUrl: String?
    let memberCount: Int?
    let hotness: Int
    /// Paragraphs, separated by blank lines.
    let overview: String
    /// The next four are newline-separated lists, rendered as bullets.
    let discussions: String
    let loves: String
    let dislikes: String
    let rules: String
    let approach: String
}

// MARK: - Missions

struct MissionsPayload: Codable, Equatable {
    let missions: [Mission]
    let summary: MissionSummary
    /// Keyed by cadence. The journey sheet iterates this dictionary's own key
    /// order to group, so preserve the server's ordering rather than sorting.
    let cadenceInfo: [String: CadenceInfo]
    /// Mission ids awarded by *this* request.
    let justCompleted: [String]
}

struct Mission: Codable, Identifiable, Equatable {
    let id: String
    /// setup | marketing | outreach | sales
    let category: String
    /// once | daily | weekly | monthly
    let cadence: String
    let title: String
    let description: String
    let xp: Int
    let target: Int
    let current: Int
    let completed: Bool
    let completedAt: Date?
    let justCompleted: Bool
}

struct MissionSummary: Codable, Equatable {
    let xp: Int
    let level: Int
    let levelName: String
    let currentLevelXp: Int
    /// Null at the maximum level — the progress bar reads full when it is.
    let nextLevelXp: Int?
}

struct CadenceInfo: Codable, Equatable {
    let title: String
    let blurb: String
}

// MARK: - Money

struct PaymentsPayload: Codable, Equatable {
    let payments: [Payment]
    let summary: PaymentSummary
}

struct Payment: Codable, Identifiable, Equatable {
    let id: String
    let amount: Double
    let note: String?
    let quantity: Int
    let occurredAt: Date
    let createdAt: Date
    let businessId: String
    let contactId: String?
    let contact: NamedRef?
    let productId: String?
    let product: NamedRef?
}

struct PaymentSummary: Codable, Equatable {
    let total: Double
    let thisMonth: Double
    let count: Int
    let average: Double
    let topClient: TopClient?
}

struct TopClient: Codable, Equatable {
    let name: String
    let total: Double
}

/// A minimal `{ id, name }` join, used where a full record would be wasteful.
struct NamedRef: Codable, Identifiable, Equatable {
    let id: String
    let name: String
}

// MARK: - Shelf

struct ProductsPayload: Codable, Equatable {
    let products: [ShelfProduct]
    let summary: ProductSummary
}

/// Named `ShelfProduct` to keep it clearly apart from `DiscoverProduct` — one
/// is something the user sells, the other is something they might sell.
struct ShelfProduct: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let businessId: String
    let description: String?
    let price: Double?
    /// Null means "not tracked", which is not the same as zero. The UI must say
    /// "stock not tracked" rather than showing 0 and implying sold out.
    let stock: Int?
    let sku: String?
    let url: String?
    let createdAt: Date
    let updatedAt: Date
}

struct ProductSummary: Codable, Equatable {
    let count: Int
    let inventoryValue: Double
    let lowStock: Int
    let lowStockThreshold: Int
}

// MARK: - Clients

struct GraphPayload: Codable, Equatable {
    let business: Business
    let channels: [Channel]
    let contacts: [Contact]
}

struct Channel: Codable, Identifiable, Equatable {
    let id: String
    let type: String
    let label: String?
    let url: String?
    let businessId: String
    let createdAt: Date
}

struct Contact: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let notes: String?
    let sourceUrl: String?
    /// PROSPECT | ENGAGED | CUSTOMER
    let status: String
    let relationshipStrength: Double
    let engagementScore: Double
    let businessId: String
    let channelId: String
    let createdAt: Date
    let updatedAt: Date
    /// Synthesised by /api/graph only — it is absent from every other endpoint
    /// that returns a Contact, so this must stay optional or those decodes fail.
    let lastInteractionAt: Date?
}

struct ContactDetail: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let notes: String?
    let sourceUrl: String?
    let status: String
    let relationshipStrength: Double
    let engagementScore: Double
    let businessId: String
    let channelId: String
    let createdAt: Date
    let updatedAt: Date
    let interactions: [Interaction]
    let channel: Channel
}

struct Interaction: Codable, Identifiable, Equatable {
    let id: String
    /// MESSAGE | MEETING | PURCHASE | REVIEW | OTHER
    let type: String
    let note: String?
    /// 1 (light touch) to 5 (a sale).
    let weight: Int
    let occurredAt: Date
    let createdAt: Date
    let contactId: String
}

/// The activity feed's shape: an interaction with just enough contact attached
/// to render a row without a second request.
struct FeedInteraction: Codable, Identifiable, Equatable {
    let id: String
    let type: String
    let note: String?
    let weight: Int
    let occurredAt: Date
    let createdAt: Date
    let contactId: String
    let contact: FeedContact
}

struct FeedContact: Codable, Equatable {
    let id: String
    let name: String
    let status: String
    let channel: FeedChannel
}

struct FeedChannel: Codable, Equatable {
    let type: String
    let label: String?
}

// MARK: - Typed helpers over the loose strings

/// Where a value drives layout rather than just text, this gives
/// exhaustiveness without the crash-on-unknown of a `Codable` enum.
enum Audience: String {
    case maker, reseller, both

    init?(_ raw: String?) {
        guard let raw, let value = Audience(rawValue: raw) else { return nil }
        self = value
    }

    /// A `both` niche is badged Maker, so filters must follow the badge rather
    /// than the raw value — otherwise a card reading "Maker" appears in a list
    /// the user filtered to Seller, and the label contradicts the section.
    var badge: String { self == .reseller ? "Seller" : "Maker" }
}

enum ContactStatus: String {
    case prospect = "PROSPECT"
    case engaged = "ENGAGED"
    case customer = "CUSTOMER"

    init?(_ raw: String?) {
        guard let raw, let value = ContactStatus(rawValue: raw) else { return nil }
        self = value
    }

    var label: String {
        switch self {
        case .prospect: return "New lead"
        case .engaged: return "In conversation"
        case .customer: return "Customer"
        }
    }
}
