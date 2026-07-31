import Foundation

/// Whether a product is "your kind of thing", and how much that should move it
/// up the feed.
///
/// This is computed on the client, which is deliberate rather than lazy. The
/// server ranks the feed and orders the shelves, but what somebody typed during
/// onboarding never leaves the phone for an explorer — it is passed to
/// `GET /trends` as a hint and is not stored against the account. Recomputing
/// here costs nothing over fifty products and keeps the highlight working when
/// the feed is served from cache.
///
/// Ported from the prototype's `matchDiscover` and `feedGroup`, which are the
/// design source of truth for how Discover feels.
enum Relevance {
    /// The prototype's list, copied exactly. Short, hand-picked, and aimed at
    /// free text a person types about themselves rather than at prose in
    /// general — "handmade stoneware mugs" has to survive it, "I really just
    /// want to make some things" must not match everything.
    private static let stopWords: Set<String> = [
        "and", "the", "for", "with", "your", "from", "that", "this", "are", "you",
        "our", "its", "all", "who", "what", "how", "made", "only", "like", "want",
        "anything", "can", "make", "sell", "some", "into", "love", "really",
        "just", "stuff", "things", "maybe",
    ]

    /// Split on anything that is not a letter or digit, so both comma-separated
    /// content tags and a free-text sentence tokenize the same way. Three
    /// characters minimum: "art" is a real interest, "an" is not.
    static func tokens(_ text: String?) -> [String] {
        guard let text else { return [] }
        return text.lowercased()
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .map(String.init)
            .filter { $0.count >= 3 && !stopWords.contains($0) }
    }

    /// What the user is into, in their own words.
    ///
    /// An owner is matched against the business they described; an explorer
    /// against what they said during onboarding. Both are free text, which is
    /// why this tokenizes rather than compares.
    static func wants(business: Business?, interests: [String]) -> [String] {
        guard let business else { return interests.flatMap { tokens($0) } }
        return tokens([business.niche, business.description, business.audienceKeywords ?? ""]
            .joined(separator: " "))
    }

    /// The product's searchable text.
    ///
    /// The prototype also folds in the niche's `tags`, which `/trends` does not
    /// serialize — so this matches very slightly less than the prototype does
    /// on the same product. Adding `tags` to `toDiscoverProduct` would close it.
    private static func haystack(_ product: DiscoverProduct) -> String {
        [product.title, product.blurb, product.niche?.name ?? "", product.niche?.domain ?? ""]
            .joined(separator: " ")
            .lowercased()
    }

    /// A substring hit, not a token equality test — the prototype uses
    /// `indexOf`, so "mug" matches "mugs" and "jewel" matches "jewellery".
    /// Stemming properly would be more correct and would also change which
    /// products light up, which is a design change rather than a port.
    static func matches(_ product: DiscoverProduct, wants: [String]) -> Bool {
        guard !wants.isEmpty else { return false }
        let text = haystack(product)
        return wants.contains { text.contains($0) }
    }

    /// What floats to the top, and it differs by filter on purpose.
    ///
    /// A **maker** picked their craft before they picked a product, so
    /// relevance to what they said beats every other signal. A **seller** has
    /// no craft to be matched against and wants the strongest bet on the shelf,
    /// which is what the badges mark. Lower group sorts first; heat breaks ties.
    ///
    /// **`upside` is missing here.** The prototype's strongest shelf is a card
    /// carrying Hot *and* High upside together — 170 of the 698 sourced
    /// products are tier `upside` in the content files, but `tier` exists in
    /// neither the Prisma schema nor `toDiscoverProduct`, so the app cannot
    /// see it. Until that is carried through, `hot` alone stands in for both
    /// badges and this ordering is the prototype's with one of its two signals
    /// unavailable.
    static func group(isHot: Bool, isMatch: Bool, sellerFilter: Bool) -> Int {
        if sellerFilter { return isHot ? 0 : 1 }
        if isMatch { return isHot ? 0 : 1 }
        return isHot ? 2 : 3
    }
}
