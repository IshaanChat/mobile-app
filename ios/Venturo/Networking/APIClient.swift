import Foundation

/// Errors surfaced by `APIClient`.
///
/// `status == 0` means the request never reached the server. That is a distinct
/// case worth keeping, because on this backend it usually is not a real failure
/// — Render's free tier sleeps after ~15 minutes idle and takes around 30
/// seconds to wake, so the honest message is "it is waking up", not "it broke".
struct APIError: Error, LocalizedError {
    let status: Int
    let message: String

    var errorDescription: String? { message }

    /// Worth a retry rather than an apology.
    var isProbablyColdStart: Bool { status == 0 }

    /// The session is gone. The caller should send the user back to sign-in.
    var isUnauthorized: Bool { status == 401 }

    /// The server returns 404 — not 403 — for a business belonging to somebody
    /// else. Do not read this as "deleted".
    var isNotFoundOrNotYours: Bool { status == 404 }
}

/// Supplies a bearer token for each request.
///
/// Deliberately `async` and called per request rather than holding a string.
/// Clerk session tokens are short-lived — about 60 seconds — and `getToken()`
/// refreshes silently. Caching the value is the difference between an app that
/// works and one that 401s the moment it has been idle for a minute.
protocol TokenProvider: Sendable {
    func token() async -> String?
}

/// No auth at all. Only useful against a local server running in dev mode.
struct NoTokenProvider: TokenProvider {
    func token() async -> String? { nil }
}

actor APIClient {
    static let productionBaseURL = URL(string: "https://sales-mechanic-api.onrender.com/api")!

    private let baseURL: URL
    private let tokenProvider: TokenProvider
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(
        baseURL: URL = APIClient.productionBaseURL,
        tokenProvider: TokenProvider = NoTokenProvider()
    ) {
        self.baseURL = baseURL
        self.tokenProvider = tokenProvider

        let config = URLSessionConfiguration.default
        // Far above the default 60. The backend's free tier cold-starts in
        // roughly 30 seconds and the default would sometimes give up first —
        // producing a failure for a request that was about to succeed.
        config.timeoutIntervalForRequest = 90
        config.timeoutIntervalForResource = 120
        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .custom(Self.decodeISO8601)
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
    }

    /// Prisma serialises `DateTime` through `JSON.stringify`, which emits
    /// fractional seconds: `2026-07-30T12:34:56.789Z`.
    ///
    /// `JSONDecoder.DateDecodingStrategy.iso8601` **rejects fractional
    /// seconds and throws**. Using it here would fail every single decode that
    /// contains a timestamp — which is nearly all of them — so this is not a
    /// nicety. Both formats are accepted because a value without milliseconds
    /// is still valid ISO 8601 and costs nothing to allow.
    private static let fractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static func decodeISO8601(_ decoder: Decoder) throws -> Date {
        let raw = try decoder.singleValueContainer().decode(String.self)
        if let date = fractional.date(from: raw) { return date }
        if let date = plain.date(from: raw) { return date }
        throw DecodingError.dataCorrupted(
            .init(
                codingPath: decoder.codingPath,
                debugDescription: "Not an ISO 8601 date: \(raw)"
            )
        )
    }

    // MARK: - Core

    private func request(
        _ method: String,
        _ path: String,
        query: [String: String] = [:],
        body: Encodable? = nil
    ) async throws -> Data {
        var components = URLComponents(
            url: baseURL.appendingPathComponent(path.hasPrefix("/") ? String(path.dropFirst()) : path),
            resolvingAgainstBaseURL: false
        )!
        if !query.isEmpty {
            components.queryItems = query
                .sorted { $0.key < $1.key }
                .map { URLQueryItem(name: $0.key, value: $0.value) }
        }

        var req = URLRequest(url: components.url!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // The server does `header.slice(7)` after a case-SENSITIVE
        // `startsWith('Bearer ')`. Exactly one space, exactly that casing.
        if let token = await tokenProvider.token() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            req.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError(
                status: 0,
                message: "Can't reach the server. It may be waking up — try again in a moment."
            )
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError(status: 0, message: "Unexpected response from the server.")
        }

        guard (200..<300).contains(http.statusCode) else {
            // The error envelope is always `{ "error": String }`.
            let message =
                (try? JSONDecoder().decode(ServerError.self, from: data))?.error
                ?? "Request failed (\(http.statusCode))"
            throw APIError(status: http.statusCode, message: message)
        }

        return data
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            // Decoding failures are the most common bug in a client like this
            // and the least legible by default. Surfacing the coding path turns
            // "The data couldn't be read" into the field that is wrong.
            throw APIError(status: -1, message: Self.describe(error))
        }
    }

    private static func describe(_ error: Error) -> String {
        guard let decoding = error as? DecodingError else { return error.localizedDescription }
        switch decoding {
        case let .keyNotFound(key, context):
            return "Missing field '\(key.stringValue)' at \(path(context))"
        case let .typeMismatch(type, context):
            return "Expected \(type) at \(path(context))"
        case let .valueNotFound(type, context):
            return "Null where \(type) was required at \(path(context)) — the model needs this optional"
        case let .dataCorrupted(context):
            return "Malformed value at \(path(context)): \(context.debugDescription)"
        @unknown default:
            return decoding.localizedDescription
        }
    }

    private static func path(_ context: DecodingError.Context) -> String {
        let path = context.codingPath.map(\.stringValue).joined(separator: ".")
        return path.isEmpty ? "the root" : path
    }

    private struct ServerError: Decodable { let error: String }

    /// Lets a heterogeneous `Encodable` body be encoded without generics
    /// leaking into every call site.
    private struct AnyEncodable: Encodable {
        private let encodeTo: (Encoder) throws -> Void
        init(_ wrapped: Encodable) { encodeTo = wrapped.encode(to:) }
        func encode(to encoder: Encoder) throws { try encodeTo(encoder) }
    }

    // MARK: - Profile

    /// Returns `nil` for an account with no profile yet.
    ///
    /// The server answers **HTTP 200 with a literal `null` body** in that case,
    /// not 404. This is what drives the app into onboarding, so it is a normal
    /// outcome rather than an error — and it is why the return type is
    /// optional rather than the call throwing.
    func getProfile() async throws -> UserProfile? {
        let data = try await request("GET", "profile")
        if data.isEmpty { return nil }
        return try decode(UserProfile?.self, from: data)
    }

    func createProfile(_ body: CreateProfile) async throws -> UserProfile {
        try decode(UserProfile.self, from: try await request("POST", "profile", body: body))
    }

    func updateProfile(id: String, _ body: UpdateProfile) async throws -> UserProfile {
        try decode(UserProfile.self, from: try await request("PATCH", "profile/\(id)", body: body))
    }

    // MARK: - Business

    func getBusinesses() async throws -> [Business] {
        try decode([Business].self, from: try await request("GET", "business"))
    }

    func createBusiness(_ body: CreateBusiness) async throws -> Business {
        try decode(Business.self, from: try await request("POST", "business", body: body))
    }

    func updateBusiness(id: String, _ body: UpdateBusiness) async throws -> Business {
        try decode(Business.self, from: try await request("PATCH", "business/\(id)", body: body))
    }

    // MARK: - Discover

    /// `businessId` and `interests` are mutually exclusive server-side, and
    /// `businessId` wins. Explorers have no business, so their onboarding
    /// interests stand in.
    func getTrends(businessId: String?, interests: [String] = []) async throws -> TrendsPayload {
        var query = ["sort": "niche"]
        if let businessId {
            query["businessId"] = businessId
        } else if !interests.isEmpty {
            query["interests"] = interests.joined(separator: ",")
        }
        return try decode(TrendsPayload.self, from: try await request("GET", "trends", query: query))
    }

    func saveTrend(id: String) async throws {
        _ = try await request("POST", "trends/\(id)/save")
    }

    /// Returns **204 with an empty body** — there is nothing to decode, and
    /// attempting it throws. It also never 404s, being a `deleteMany`.
    func unsaveTrend(id: String) async throws {
        _ = try await request("DELETE", "trends/\(id)/save")
    }

    // MARK: - Growth

    func getGrowth(businessId: String) async throws -> GrowthPayload {
        try decode(
            GrowthPayload.self,
            from: try await request("GET", "growth", query: ["businessId": businessId])
        )
    }

    // MARK: - Missions

    /// ⚠️ This GET has write side-effects: the server awards newly-completed
    /// missions as part of answering it, and reports them in `justCompleted`.
    /// Never call it speculatively, on a timer, or to prefetch.
    func getMissions(businessId: String) async throws -> MissionsPayload {
        try decode(
            MissionsPayload.self,
            from: try await request("GET", "missions", query: ["businessId": businessId])
        )
    }

    // MARK: - Money and shelf

    func getPayments(businessId: String) async throws -> PaymentsPayload {
        try decode(
            PaymentsPayload.self,
            from: try await request("GET", "payments", query: ["businessId": businessId])
        )
    }

    func createPayment(_ body: CreatePayment) async throws -> Payment {
        try decode(Payment.self, from: try await request("POST", "payments", body: body))
    }

    func getShelf(businessId: String) async throws -> ProductsPayload {
        try decode(
            ProductsPayload.self,
            from: try await request("GET", "products", query: ["businessId": businessId])
        )
    }

    // MARK: - Clients

    func getGraph(businessId: String) async throws -> GraphPayload {
        try decode(
            GraphPayload.self,
            from: try await request("GET", "graph", query: ["businessId": businessId])
        )
    }

    func getActivityFeed(businessId: String, limit: Int) async throws -> [FeedInteraction] {
        try decode(
            [FeedInteraction].self,
            from: try await request(
                "GET", "interactions",
                query: ["businessId": businessId, "limit": String(limit)]
            )
        )
    }

    func createContact(_ body: CreateContact) async throws -> ContactDetail {
        try decode(ContactDetail.self, from: try await request("POST", "contacts", body: body))
    }

    func logInteraction(contactId: String, type: String = "MESSAGE") async throws -> ContactDetail {
        try decode(
            ContactDetail.self,
            from: try await request(
                "POST", "contacts/\(contactId)/interactions",
                body: LogInteraction(type: type)
            )
        )
    }

    // MARK: - Socials

    func getSocials(businessId: String) async throws -> [SocialLink] {
        try decode(
            [SocialLink].self,
            from: try await request("GET", "socials", query: ["businessId": businessId])
        )
    }

    /// Send **all seven platforms every time**. An empty string deletes that
    /// link server-side; omitting a platform leaves whatever was there.
    func saveSocials(businessId: String, links: [SocialLinkInput]) async throws -> [SocialLink] {
        try decode(
            [SocialLink].self,
            from: try await request(
                "PUT", "socials",
                body: SaveSocials(businessId: businessId, links: links)
            )
        )
    }
}

// MARK: - Request bodies

struct CreateProfile: Encodable {
    let name: String
    let email: String
    let age: Int
    let gender: String
    let experienceLevel: String
}

struct UpdateProfile: Encodable {
    let name: String
    let email: String
    /// Re-sent unchanged: the server patches only what it receives.
    let age: Int
    let gender: String
    let location: String?
    let bio: String?
    let goals: String?
}

struct CreateBusiness: Encodable {
    let name: String
    let niche: String
    let description: String
    let businessType: String?
}

struct UpdateBusiness: Encodable {
    let name: String
    let niche: String
    let description: String
    /// An empty string clears it. `nil` leaves it untouched.
    let pageUrl: String?
}

struct CreatePayment: Encodable {
    let businessId: String
    let amount: Double
    let note: String?
}

/// Requires exactly one of `sourceUrl` or `noLinkKind` — the server rejects a
/// contact with neither, because every contact belongs to a channel and the
/// channel has to be derivable from something.
struct CreateContact: Encodable {
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

struct LogInteraction: Encodable {
    let type: String
}

struct SocialLinkInput: Encodable {
    let platform: String
    let url: String
}

private struct SaveSocials: Encodable {
    let businessId: String
    let links: [SocialLinkInput]
}
