import Foundation

/// Works out which channel a contact came from, from a pasted URL.
///
/// Ported from `server/src/channelDetect.ts`. Known platforms become
/// first-class channel types; anything else becomes an `OTHER` channel labelled
/// with a cleaned-up domain, so "shop.tiktok.com" reads as "Tiktok" and a craft
/// fair's own site reads as its own name rather than as "Other".
enum ChannelDetect {
    struct Detected: Equatable {
        /// ETSY | INSTAGRAM | REDDIT | OTHER
        let type: String
        let label: String
    }

    private static let known: [(match: String, type: String, label: String)] = [
        ("etsy.com", "ETSY", "Etsy"),
        ("instagram.com", "INSTAGRAM", "Instagram"),
        ("reddit.com", "REDDIT", "Reddit"),
    ]

    /// Accepts what someone actually pastes — a bare domain gets a scheme, and
    /// anything without a dot in the host is not a URL at all.
    static func normalize(_ raw: String) -> URL? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let withScheme = trimmed.range(of: "^https?://", options: [.regularExpression, .caseInsensitive]) != nil
            ? trimmed
            : "https://\(trimmed)"

        guard let url = URL(string: withScheme),
              let host = url.host,
              host.contains(".")
        else { return nil }

        return url
    }

    static func detect(_ rawUrl: String) -> Detected? {
        guard let url = normalize(rawUrl), let rawHost = url.host else { return nil }
        let host = rawHost
            .replacingOccurrences(of: "^www\\.", with: "", options: [.regularExpression, .caseInsensitive])
            .lowercased()

        for entry in known where host == entry.match || host.hasSuffix(".\(entry.match)") {
            return Detected(type: entry.type, label: entry.label)
        }

        // "craftfair.co.uk" -> "Craftfair". Second-from-last, not first, so a
        // subdomain does not become the name.
        let parts = host.split(separator: ".")
        let core = parts.count >= 2 ? String(parts[parts.count - 2]) : String(parts.first ?? "")
        guard !core.isEmpty else { return nil }
        return Detected(type: "OTHER", label: core.prefix(1).uppercased() + core.dropFirst())
    }

    /// The fallbacks for a contact with no link at all. Someone met at a market
    /// still belongs to a channel — the channel is just "in person".
    static func forNoLink(_ kind: String) -> Detected {
        switch kind {
        case "REFERRAL": return Detected(type: "REFERRAL", label: "Referral")
        case "IN_PERSON": return Detected(type: "OTHER", label: "In person")
        default: return Detected(type: "OTHER", label: "Other")
        }
    }
}
