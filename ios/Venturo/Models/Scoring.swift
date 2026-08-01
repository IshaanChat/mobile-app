import Foundation

/// Relationship scoring, ported from `server/src/scoring.ts`.
///
/// A faithful port rather than a reinterpretation: the numbers it produces are
/// shown to users as node size and edge thickness in the client graph, and a
/// contact whose warmth changed because the platform changed would be a bug
/// nobody could explain.
///
/// `relationshipStrength` blends how often, how recently and how valuable the
/// contact has been. `engagementScore` drops value and re-normalises, so it
/// reflects cadence of contact independent of deal size. Both are 0–100.
///
/// Weights are tuned per business type, because different businesses sell
/// differently — a service business with two big clients a year is not failing
/// the way the same numbers would mean for a product seller.
enum Scoring {
    struct Input: Equatable {
        let occurredAt: Date
        /// 1–5. Anything richer than "we spoke" scores higher.
        let weight: Double
    }

    struct Scores: Equatable {
        let relationshipStrength: Int
        let engagementScore: Int
    }

    struct Profile {
        let freqWeight: Double
        let recencyWeight: Double
        let valueWeight: Double
        let recencyHalfLifeDays: Double
        let freqSaturationCount: Double
        let valueSaturationTotal: Double
    }

    /// PRODUCT_SALES — many small transactions; value and frequency carry more.
    /// SERVICE — fewer, bigger deals on long cycles, so staying recently in
    /// touch matters most and relationships fade slower.
    /// KNOWLEDGE — trust built over repeated touches, so frequency dominates.
    /// OTHER — balanced default, and the fallback for anything unrecognised.
    static let profiles: [String: Profile] = [
        "PRODUCT_SALES": Profile(
            freqWeight: 0.35, recencyWeight: 0.30, valueWeight: 0.35,
            recencyHalfLifeDays: 120, freqSaturationCount: 6, valueSaturationTotal: 15
        ),
        "SERVICE": Profile(
            freqWeight: 0.25, recencyWeight: 0.45, valueWeight: 0.30,
            recencyHalfLifeDays: 180, freqSaturationCount: 4, valueSaturationTotal: 12
        ),
        "KNOWLEDGE": Profile(
            freqWeight: 0.45, recencyWeight: 0.35, valueWeight: 0.20,
            recencyHalfLifeDays: 120, freqSaturationCount: 8, valueSaturationTotal: 12
        ),
        "OTHER": Profile(
            freqWeight: 0.35, recencyWeight: 0.35, valueWeight: 0.30,
            recencyHalfLifeDays: 120, freqSaturationCount: 6, valueSaturationTotal: 15
        ),
    ]

    static func profile(for businessType: String?) -> Profile {
        profiles[businessType ?? "OTHER"] ?? profiles["OTHER"]!
    }

    static func scores(
        for interactions: [Input],
        businessType: String? = nil,
        now: Date = Date()
    ) -> Scores {
        guard !interactions.isEmpty else {
            return Scores(relationshipStrength: 0, engagementScore: 0)
        }
        let profile = profile(for: businessType)

        let freqNorm = min(Double(interactions.count) / profile.freqSaturationCount, 1)

        let mostRecent = interactions.map(\.occurredAt).max() ?? interactions[0].occurredAt
        let daysSince = max(0, now.timeIntervalSince(mostRecent) / 86_400)
        let recencyNorm = max(0, 1 - daysSince / profile.recencyHalfLifeDays)

        let totalWeight = interactions.reduce(0) { $0 + $1.weight }
        let valueNorm = min(totalWeight / profile.valueSaturationTotal, 1)

        let strength = 100 * (
            profile.freqWeight * freqNorm
                + profile.recencyWeight * recencyNorm
                + profile.valueWeight * valueNorm
        )

        // Engagement re-normalises freq+recency to a full scale, so dropping
        // value does not simply make every score smaller.
        let denominator = profile.freqWeight + profile.recencyWeight
        let engagement = 100 * (
            profile.freqWeight * freqNorm + profile.recencyWeight * recencyNorm
        ) / denominator

        return Scores(
            relationshipStrength: Int(strength.rounded()),
            engagementScore: Int(engagement.rounded())
        )
    }
}
