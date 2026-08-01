import Foundation

/// Picks the product to show somebody after they answer a prompt.
///
/// Ported from `revealFor` in `preview-app.ts`, with one deliberate change: the
/// prototype matched against niches, and this matches against products. The
/// catalogue's economics — what it costs, what it sells for, how it is sourced
/// — live on the product, and the whole point of the reveal is to put real
/// numbers in front of somebody. Matching the niche and then hunting for a
/// product to illustrate it would be the same work with a worse answer.
enum RevealMatch {
    struct Result {
        let product: DiscoverProduct
        /// False when nothing scored: the copy says so rather than implying
        /// this was chosen for them.
        let matched: Bool
    }

    /// Costs nothing to start. Shown first to anyone who answered a question
    /// about what has been stopping them, because "nothing to buy up front"
    /// next to a $20 outlay reads as a lie.
    private static let zeroStart = [
        "digital-planners", "notion-templates", "design-assets",
        "apparel-pod", "stickers-decals",
    ]

    /// The fallbacks, in order, when nothing matched.
    private static let starters = [
        "stickers-decals", "apparel-pod", "digital-planners",
        "candles-fragrance", "hair-accessories",
    ]

    /// - Parameters:
    ///   - excluding: the sourcing type already shown. The second reveal avoids
    ///     repeating it, so the two together read as "here are two different
    ///     ways in" rather than as the same suggestion twice.
    static func pick(
        for text: String,
        mode: String,
        from products: [DiscoverProduct],
        excluding excludedType: String? = nil
    ) -> Result? {
        let pool = products.filter { product in
            guard let excludedType else { return true }
            return product.sourcingType != excludedType
        }
        guard !pool.isEmpty else { return nil }

        // Somebody who named what has been stopping them gets the cheapest
        // possible start, whatever their words scored against.
        if mode == "unblock" {
            for slug in zeroStart {
                if let hit = pool.first(where: { $0.niche?.slug == slug || $0.slug == slug }) {
                    return Result(product: hit, matched: true)
                }
            }
        }

        let want = Relevance.tokens(text)
        if !want.isEmpty {
            var best: DiscoverProduct?
            var bestScore = 0
            for product in pool {
                let hay = haystack(product)
                let score = want.reduce(0) { $0 + (hay.contains($1) ? 1 : 0) }
                if score > bestScore {
                    bestScore = score
                    best = product
                }
            }
            if let best { return Result(product: best, matched: true) }
        }

        for slug in starters {
            if let hit = pool.first(where: { $0.niche?.slug == slug || $0.slug == slug }) {
                return Result(product: hit, matched: false)
            }
        }
        return pool.first.map { Result(product: $0, matched: false) }
    }

    private static func haystack(_ product: DiscoverProduct) -> String {
        [
            product.title,
            product.blurb,
            product.niche?.name ?? "",
            product.niche?.domain ?? "",
            product.category,
        ]
        .joined(separator: " ")
        .lowercased()
    }

    /// The margin, for the "how many sales to $500" line.
    ///
    /// Both sides are free text — "$3–5/unit", "around $18" — so this takes the
    /// first number it finds and nothing more. Never parse these into a
    /// calculation that matters; this one is explicitly a rough shape.
    static func margin(cost: String?, resale: String?) -> Int? {
        guard let sell = firstNumber(resale) else { return nil }
        let buy = firstNumber(cost) ?? 0
        return max(1, sell - buy)
    }

    private static func firstNumber(_ text: String?) -> Int? {
        guard let text else { return nil }
        let digits = text.split(whereSeparator: { !$0.isNumber })
        guard let first = digits.first else { return nil }
        return Int(first)
    }
}
