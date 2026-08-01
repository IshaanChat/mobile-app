import CloudKit
import Foundation

/// Whether this device can store anything at all.
///
/// Distinct from "has a profile". Somebody with no iCloud account can read the
/// whole content database and browse Discover; they just cannot keep anything.
/// The app has to be able to tell those two apart, because one is a limitation
/// to explain at the point of use and the other is a state to route on.
enum AccountAvailability: Equatable {
    case available
    /// Signed out of iCloud entirely. Browsing works; saving does not.
    case noAccount
    /// Restricted by parental controls or MDM, or CloudKit could not say.
    case unavailable(String)
}

/// The user's own records, in CloudKit's private database.
///
/// Everything here is stored against the user's iCloud quota rather than ours,
/// is invisible to us by design, and syncs across their devices for free. That
/// last property is new — the Postgres version had no sync at all.
///
/// All of it lives in one custom zone. The default zone would work, but a
/// custom zone can be deleted whole, which turns account deletion from "query
/// every type and hope you got them all" into one call that either succeeds or
/// does not. App Store Guideline 5.1.1(v) requires in-app deletion, and this is
/// the version of it that can actually be proven.
actor CloudKitPrivate {
    private let container: CKContainer
    private let database: CKDatabase
    private let zoneID: CKRecordZone.ID

    /// Zone creation is idempotent but not free, so it is done once per launch
    /// on the first write rather than on every one.
    private var zoneReady = false

    /// The profile is a singleton, so it gets a known name rather than a
    /// generated one — that makes "do I have a profile" a fetch rather than a
    /// query, and fetches do not depend on indexes.
    private static let profileRecordName = "profile"

    init(containerIdentifier: String = "iCloud.com.ishaanchaturvedi.salesmechanic") {
        self.container = CKContainer(identifier: containerIdentifier)
        self.database = container.privateCloudDatabase
        self.zoneID = CKRecordZone.ID(zoneName: "Venturo", ownerName: CKCurrentUserDefaultName)
    }

    // MARK: - Account

    func availability() async -> AccountAvailability {
        do {
            switch try await container.accountStatus() {
            case .available:
                return .available
            case .noAccount:
                return .noAccount
            case .restricted:
                return .unavailable("iCloud is restricted on this device.")
            case .couldNotDetermine:
                return .unavailable("Couldn't reach iCloud.")
            case .temporarilyUnavailable:
                return .unavailable("iCloud is temporarily unavailable.")
            @unknown default:
                return .unavailable("iCloud is unavailable.")
            }
        } catch {
            return .unavailable(error.localizedDescription)
        }
    }

    private func ensureZone() async throws {
        guard !zoneReady else { return }
        _ = try? await database.modifyRecordZones(
            saving: [CKRecordZone(zoneID: zoneID)],
            deleting: []
        )
        zoneReady = true
    }

    private func recordID(_ name: String) -> CKRecord.ID {
        CKRecord.ID(recordName: name, zoneID: zoneID)
    }

    // MARK: - Profile

    func getProfile() async throws -> UserProfile? {
        do {
            let record = try await database.record(for: recordID(Self.profileRecordName))
            return Self.profile(from: record)
        } catch let error as CKError where error.code == .unknownItem || error.code == .zoneNotFound {
            // No profile yet, or nothing has ever been written. Both mean the
            // same thing to the caller: this account is at onboarding.
            return nil
        }
    }

    func createProfile(_ body: CreateProfile) async throws -> UserProfile {
        try await ensureZone()
        let record = CKRecord(recordType: "Profile", recordID: recordID(Self.profileRecordName))
        record["name"] = body.name
        record["email"] = body.email
        record["age"] = body.age
        record["gender"] = body.gender
        record["experienceLevel"] = body.experienceLevel
        record["favouriteNiche"] = body.favouriteNiche.isEmpty ? nil : body.favouriteNiche
        record["createdAt"] = Int(Date().timeIntervalSince1970)
        record["updatedAt"] = Int(Date().timeIntervalSince1970)
        let saved = try await database.save(record)
        return Self.profile(from: saved)
    }

    func updateProfile(_ body: UpdateProfile) async throws -> UserProfile {
        try await ensureZone()
        let id = recordID(Self.profileRecordName)
        // Fetch and mutate rather than building fresh: a new CKRecord with an
        // existing ID saves as a conflict, and overwriting would drop whatever
        // fields this particular form does not carry.
        let record = (try? await database.record(for: id))
            ?? CKRecord(recordType: "Profile", recordID: id)
        record["name"] = body.name
        record["email"] = body.email
        record["age"] = body.age
        record["gender"] = body.gender
        record["location"] = body.location
        record["updatedAt"] = Int(Date().timeIntervalSince1970)
        let saved = try await database.save(record)
        return Self.profile(from: saved)
    }

    private static func profile(from record: CKRecord) -> UserProfile {
        UserProfile(
            id: record.recordID.recordName,
            name: record.str("name") ?? "",
            email: record.str("email") ?? "",
            age: record.num("age") ?? 0,
            gender: record.str("gender") ?? "PREFER_NOT_TO_SAY",
            location: record.str("location"),
            phone: record.str("phone"),
            bio: record.str("bio"),
            experienceLevel: record.str("experienceLevel"),
            goals: record.str("goals"),
            favouriteNiche: record.str("favouriteNiche"),
            createdAt: record.date("createdAt"),
            updatedAt: record.date("updatedAt")
        )
    }

    // MARK: - Businesses

    func getBusinesses() async throws -> [Business] {
        try await fetchAll("Business").map(Self.business(from:))
    }

    func createBusiness(_ body: CreateBusiness) async throws -> Business {
        try await ensureZone()
        let record = CKRecord(recordType: "Business", recordID: recordID(UUID().uuidString))
        record["name"] = body.name
        record["niche"] = body.niche
        // `description` is taken on NSObject and assigning it to a CKRecord key
        // of the same name is a trap worth not setting: the field is `about`.
        record["about"] = body.description
        record["businessType"] = body.businessType
        record["createdAt"] = Int(Date().timeIntervalSince1970)
        record["updatedAt"] = Int(Date().timeIntervalSince1970)
        return Self.business(from: try await database.save(record))
    }

    func updateBusiness(id: String, _ body: UpdateBusiness) async throws -> Business {
        try await ensureZone()
        let record = try await database.record(for: recordID(id))
        record["name"] = body.name
        record["niche"] = body.niche
        record["about"] = body.description
        if let pageUrl = body.pageUrl {
            // An empty string clears it; nil leaves it alone. Same contract the
            // API had, kept so the calling screen does not have to change.
            record["pageUrl"] = pageUrl.isEmpty ? nil : pageUrl
        }
        record["updatedAt"] = Int(Date().timeIntervalSince1970)
        return Self.business(from: try await database.save(record))
    }

    private static func business(from record: CKRecord) -> Business {
        Business(
            id: record.recordID.recordName,
            name: record.str("name") ?? "",
            niche: record.str("niche") ?? "",
            description: record.str("about") ?? "",
            idealCustomer: record.str("idealCustomer"),
            audienceKeywords: record.str("audienceKeywords"),
            salesAvenues: record.str("salesAvenues"),
            businessType: record.str("businessType"),
            pageUrl: record.str("pageUrl"),
            createdAt: record.date("createdAt"),
            updatedAt: record.date("updatedAt")
        )
    }

    // MARK: - Saved products

    /// The slugs, as a set — every Discover card asks whether it is saved, and
    /// 886 linear searches per redraw is not a thing to do.
    func savedSlugs() async throws -> Set<String> {
        let records = try await fetchAll("SavedTrend")
        return Set(records.compactMap { $0.str("productSlug") })
    }

    /// Named for the slug, so saving twice is one record rather than two and
    /// unsaving is a delete by ID with nothing to look up first.
    func saveTrend(slug: String) async throws {
        try await ensureZone()
        let record = CKRecord(recordType: "SavedTrend", recordID: recordID("saved-\(slug)"))
        record["productSlug"] = slug
        record["savedAt"] = Int(Date().timeIntervalSince1970)
        _ = try await database.save(record)
    }

    func unsaveTrend(slug: String) async throws {
        do {
            _ = try await database.deleteRecord(withID: recordID("saved-\(slug)"))
        } catch let error as CKError where error.code == .unknownItem {
            // Already gone. The optimistic heart can double-fire on a fast
            // double tap, and that is not an error worth surfacing.
        }
    }

    // MARK: - Journey

    func completedMilestones() async throws -> Set<String> {
        let records = try await fetchAll("MilestoneCompletion")
        return Set(records.compactMap { $0.str("milestoneSlug") })
    }

    func completeMilestone(slug: String, xp: Int) async throws {
        try await ensureZone()
        let record = CKRecord(
            recordType: "MilestoneCompletion",
            recordID: recordID("done-\(slug)")
        )
        record["milestoneSlug"] = slug
        record["completedAt"] = Int(Date().timeIntervalSince1970)
        record["xpAwarded"] = xp
        _ = try await database.save(record)
    }

    // MARK: - Clients

    /// Business, channels and contacts in one go — the graph screen draws all
    /// three together and three sequential round trips would show it building
    /// itself.
    func getGraph(businessId: String) async throws -> GraphPayload {
        async let channelTask = fetchAll("Channel")
        async let contactTask = fetchAll("Contact")
        async let businessTask = getBusinesses()

        let (channelRecords, contactRecords, businesses) = try await (channelTask, contactTask, businessTask)
        // Throws rather than returning nil: every caller wraps this in `try?`
        // already, and an optional return would leave them double-optional.
        guard let business = businesses.first(where: { $0.id == businessId }) else {
            throw CKError(.unknownItem)
        }

        return GraphPayload(
            business: business,
            channels: channelRecords
                .filter { $0.str("businessId") == businessId }
                .map(Self.channel(from:)),
            contacts: contactRecords
                .filter { $0.str("businessId") == businessId }
                .map { Self.contact(from: $0, lastInteractionAt: nil) }
        )
    }

    /// Every contact belongs to a channel, and the channel is derived rather
    /// than chosen — from the pasted link, or from how they were met.
    func createContact(_ body: CreateContact) async throws -> ContactDetail {
        try await ensureZone()

        let detected: ChannelDetect.Detected = body.sourceUrl
            .flatMap(ChannelDetect.detect)
            ?? ChannelDetect.forNoLink(body.noLinkKind ?? "OTHER")

        let channelRecord = try await channel(
            forBusiness: body.businessId,
            type: detected.type,
            label: detected.label
        )

        let record = CKRecord(recordType: "Contact", recordID: recordID(UUID().uuidString))
        record["businessId"] = body.businessId
        record["channelId"] = channelRecord.recordID.recordName
        record["name"] = body.name
        record["sourceUrl"] = body.sourceUrl
        record["status"] = "PROSPECT"
        record["relationshipStrength"] = 0.0
        record["engagementScore"] = 0.0
        record["createdAt"] = Int(Date().timeIntervalSince1970)
        record["updatedAt"] = Int(Date().timeIntervalSince1970)

        let saved = try await database.save(record)
        return ContactDetail(
            id: saved.recordID.recordName,
            name: body.name,
            notes: nil,
            sourceUrl: body.sourceUrl,
            status: "PROSPECT",
            relationshipStrength: 0,
            engagementScore: 0,
            businessId: body.businessId,
            channelId: channelRecord.recordID.recordName,
            createdAt: saved.date("createdAt"),
            updatedAt: saved.date("updatedAt"),
            interactions: [],
            channel: Self.channel(from: channelRecord)
        )
    }

    /// Reuses a channel of the same type rather than making one per contact —
    /// otherwise the graph grows a node for every person instead of every place.
    private func channel(forBusiness businessId: String, type: String, label: String) async throws -> CKRecord {
        let existing = try await fetchAll("Channel").first {
            $0.str("businessId") == businessId && $0.str("type") == type && $0.str("label") == label
        }
        if let existing { return existing }

        let record = CKRecord(recordType: "Channel", recordID: recordID(UUID().uuidString))
        record["businessId"] = businessId
        record["type"] = type
        record["label"] = label
        record["createdAt"] = Int(Date().timeIntervalSince1970)
        return try await database.save(record)
    }

    /// Logs a touch and recomputes the contact's two scores from every
    /// interaction it has, which is what the server did on the same event.
    func logInteraction(
        contactId: String,
        type: String,
        weight: Int = 1,
        businessType: String?
    ) async throws -> ContactDetail {
        try await ensureZone()

        let contactRecord = try await database.record(for: recordID(contactId))

        let interaction = CKRecord(recordType: "Interaction", recordID: recordID(UUID().uuidString))
        interaction["contactId"] = contactId
        interaction["businessId"] = contactRecord.str("businessId")
        interaction["type"] = type
        interaction["weight"] = weight
        interaction["occurredAt"] = Int(Date().timeIntervalSince1970)
        _ = try await database.save(interaction)

        let all = try await fetchAll("Interaction").filter { $0.str("contactId") == contactId }
        let scores = Scoring.scores(
            for: all.map {
                Scoring.Input(
                    occurredAt: $0.date("occurredAt"),
                    weight: Double($0.num("weight") ?? 1)
                )
            },
            businessType: businessType
        )

        contactRecord["relationshipStrength"] = Double(scores.relationshipStrength)
        contactRecord["engagementScore"] = Double(scores.engagementScore)
        // A logged interaction is the definition of engaged. It never goes back
        // down — a quiet customer is still a customer.
        if contactRecord.str("status") == "PROSPECT" { contactRecord["status"] = "ENGAGED" }
        contactRecord["updatedAt"] = Int(Date().timeIntervalSince1970)
        let savedContact = try await database.save(contactRecord)

        let channelRecord = try? await database.record(
            for: recordID(savedContact.str("channelId") ?? "")
        )

        return ContactDetail(
            id: savedContact.recordID.recordName,
            name: savedContact.str("name") ?? "",
            notes: savedContact.str("notes"),
            sourceUrl: savedContact.str("sourceUrl"),
            status: savedContact.str("status") ?? "PROSPECT",
            relationshipStrength: Double(scores.relationshipStrength),
            engagementScore: Double(scores.engagementScore),
            businessId: savedContact.str("businessId") ?? "",
            channelId: savedContact.str("channelId") ?? "",
            createdAt: savedContact.date("createdAt"),
            updatedAt: savedContact.date("updatedAt"),
            interactions: all.map(Self.interaction(from:)),
            channel: channelRecord.map(Self.channel(from:))
                ?? Channel(id: "", type: "OTHER", label: nil, url: nil,
                           businessId: savedContact.str("businessId") ?? "", createdAt: Date())
        )
    }

    func getActivityFeed(businessId: String, limit: Int) async throws -> [FeedInteraction] {
        async let interactionTask = fetchAll("Interaction")
        async let contactTask = fetchAll("Contact")
        async let channelTask = fetchAll("Channel")
        let (interactions, contacts, channels) = try await (interactionTask, contactTask, channelTask)

        let contactsById = Dictionary(uniqueKeysWithValues: contacts.map { ($0.recordID.recordName, $0) })
        let channelsById = Dictionary(uniqueKeysWithValues: channels.map { ($0.recordID.recordName, $0) })

        return interactions
            .filter { $0.str("businessId") == businessId }
            .sorted { $0.date("occurredAt") > $1.date("occurredAt") }
            .prefix(limit)
            .compactMap { record -> FeedInteraction? in
                guard let contactId = record.str("contactId"),
                      let contact = contactsById[contactId]
                else { return nil }
                let channel = contact.str("channelId").flatMap { channelsById[$0] }

                return FeedInteraction(
                    id: record.recordID.recordName,
                    type: record.str("type") ?? "MESSAGE",
                    note: record.str("note"),
                    weight: record.num("weight") ?? 1,
                    occurredAt: record.date("occurredAt"),
                    createdAt: record.date("occurredAt"),
                    contactId: contactId,
                    contact: FeedContact(
                        id: contactId,
                        name: contact.str("name") ?? "",
                        status: contact.str("status") ?? "PROSPECT",
                        channel: FeedChannel(
                            type: channel?.str("type") ?? "OTHER",
                            label: channel?.str("label")
                        )
                    )
                )
            }
    }

    private static func channel(from record: CKRecord) -> Channel {
        Channel(
            id: record.recordID.recordName,
            type: record.str("type") ?? "OTHER",
            label: record.str("label"),
            url: record.str("url"),
            businessId: record.str("businessId") ?? "",
            createdAt: record.date("createdAt")
        )
    }

    private static func contact(from record: CKRecord, lastInteractionAt: Date?) -> Contact {
        Contact(
            id: record.recordID.recordName,
            name: record.str("name") ?? "",
            notes: record.str("notes"),
            sourceUrl: record.str("sourceUrl"),
            status: record.str("status") ?? "PROSPECT",
            relationshipStrength: record.dbl("relationshipStrength") ?? 0,
            engagementScore: record.dbl("engagementScore") ?? 0,
            businessId: record.str("businessId") ?? "",
            channelId: record.str("channelId") ?? "",
            createdAt: record.date("createdAt"),
            updatedAt: record.date("updatedAt"),
            lastInteractionAt: lastInteractionAt
        )
    }

    private static func interaction(from record: CKRecord) -> Interaction {
        Interaction(
            id: record.recordID.recordName,
            type: record.str("type") ?? "MESSAGE",
            note: record.str("note"),
            weight: record.num("weight") ?? 1,
            occurredAt: record.date("occurredAt"),
            createdAt: record.date("occurredAt"),
            contactId: record.str("contactId") ?? ""
        )
    }

    // MARK: - Money

    func getPayments(businessId: String) async throws -> PaymentsPayload {
        async let paymentTask = fetchAll("Payment")
        async let contactTask = fetchAll("Contact")
        let (paymentRecords, contactRecords) = try await (paymentTask, contactTask)

        let names = Dictionary(
            uniqueKeysWithValues: contactRecords.map {
                ($0.recordID.recordName, $0.str("name") ?? "")
            }
        )

        let payments = paymentRecords
            .filter { $0.str("businessId") == businessId }
            .sorted { $0.date("occurredAt") > $1.date("occurredAt") }
            .map { record -> Payment in
                let contactId = record.str("contactId")
                return Payment(
                    id: record.recordID.recordName,
                    amount: record.dbl("amount") ?? 0,
                    note: record.str("note"),
                    quantity: record.num("quantity") ?? 1,
                    occurredAt: record.date("occurredAt"),
                    createdAt: record.date("createdAt"),
                    businessId: businessId,
                    contactId: contactId,
                    contact: contactId.flatMap { id in
                        names[id].map { NamedRef(id: id, name: $0) }
                    },
                    productId: record.str("productId"),
                    product: nil
                )
            }

        return PaymentsPayload(payments: payments, summary: Self.summary(of: payments))
    }

    /// Computed here because the server used to. Same arithmetic, one fewer
    /// round trip — and it stays correct offline, which the API version did not.
    private static func summary(of payments: [Payment]) -> PaymentSummary {
        let total = payments.reduce(0) { $0 + $1.amount }

        let calendar = Calendar.current
        let now = Date()
        let thisMonth = payments
            .filter { calendar.isDate($0.occurredAt, equalTo: now, toGranularity: .month) }
            .reduce(0) { $0 + $1.amount }

        var byContact: [String: (name: String, total: Double)] = [:]
        for payment in payments {
            guard let contact = payment.contact else { continue }
            byContact[contact.id, default: (contact.name, 0)].total += payment.amount
        }
        let top = byContact.values.max { $0.total < $1.total }

        return PaymentSummary(
            total: total,
            thisMonth: thisMonth,
            count: payments.count,
            average: payments.isEmpty ? 0 : total / Double(payments.count),
            topClient: top.map { TopClient(name: $0.name, total: $0.total) }
        )
    }

    func createPayment(_ body: CreatePayment) async throws -> Payment {
        try await ensureZone()
        let record = CKRecord(recordType: "Payment", recordID: recordID(UUID().uuidString))
        record["businessId"] = body.businessId
        record["amount"] = body.amount
        record["note"] = body.note
        record["quantity"] = 1
        record["occurredAt"] = Int(Date().timeIntervalSince1970)
        record["createdAt"] = Int(Date().timeIntervalSince1970)
        let saved = try await database.save(record)

        return Payment(
            id: saved.recordID.recordName,
            amount: body.amount,
            note: body.note,
            quantity: 1,
            occurredAt: saved.date("occurredAt"),
            createdAt: saved.date("createdAt"),
            businessId: body.businessId,
            contactId: nil,
            contact: nil,
            productId: nil,
            product: nil
        )
    }

    // MARK: - Shelf

    func getShelf(businessId: String) async throws -> ProductsPayload {
        let records = try await fetchAll("ShelfProduct").filter { $0.str("businessId") == businessId }

        let products = records.map { record in
            ShelfProduct(
                id: record.recordID.recordName,
                name: record.str("name") ?? "",
                businessId: businessId,
                description: record.str("about"),
                price: record.dbl("price"),
                // Absent means untracked, which is not zero. The UI says "not
                // tracked" rather than implying sold out.
                stock: record.num("stock"),
                sku: record.str("sku"),
                url: record.str("url"),
                createdAt: record.date("createdAt"),
                updatedAt: record.date("updatedAt")
            )
        }

        let threshold = 3
        return ProductsPayload(
            products: products,
            summary: ProductSummary(
                count: products.count,
                inventoryValue: products.reduce(0) { sum, product in
                    sum + (product.price ?? 0) * Double(product.stock ?? 0)
                },
                lowStock: products.filter { ($0.stock ?? Int.max) <= threshold }.count,
                lowStockThreshold: threshold
            )
        )
    }

    // MARK: - Socials

    func getSocials(businessId: String) async throws -> [SocialLink] {
        try await fetchAll("SocialLink")
            .filter { $0.str("businessId") == businessId }
            .map { record in
                SocialLink(
                    id: record.recordID.recordName,
                    platform: record.str("platform") ?? "",
                    url: record.str("url") ?? "",
                    businessId: businessId
                )
            }
    }

    /// Replaces the whole set, which is what the form submits. Named by
    /// business and platform so re-saving overwrites rather than accumulating,
    /// and so clearing a field deletes the row.
    func saveSocials(businessId: String, links: [SocialLinkInput]) async throws -> [SocialLink] {
        try await ensureZone()

        let existing = try await fetchAll("SocialLink").filter { $0.str("businessId") == businessId }
        let keep = Set(links.filter { !$0.url.isEmpty }.map(\.platform))
        let toDelete = existing
            .filter { !keep.contains($0.str("platform") ?? "") }
            .map(\.recordID)

        var toSave: [CKRecord] = []
        for link in links where !link.url.isEmpty {
            let record = CKRecord(
                recordType: "SocialLink",
                recordID: recordID("social-\(businessId)-\(link.platform)")
            )
            record["businessId"] = businessId
            record["platform"] = link.platform
            record["url"] = link.url
            toSave.append(record)
        }

        _ = try await database.modifyRecords(
            saving: toSave,
            deleting: toDelete,
            savePolicy: .allKeys
        )
        return try await getSocials(businessId: businessId)
    }

    // MARK: - Export

    /// Everything this account holds, as JSON.
    ///
    /// Assembled here because there is no server to ask. That is arguably an
    /// improvement: the export is now built from the same records the app
    /// reads, so it cannot drift from what the user actually sees.
    func exportAccount() async throws -> Data {
        async let profileTask = getProfile()
        async let businessTask = getBusinesses()
        let (profile, businesses) = try await (profileTask, businessTask)

        var payload: [String: Any] = [
            "exportedAt": ISO8601DateFormatter().string(from: Date()),
            "profile": profile.map {
                [
                    "name": $0.name, "email": $0.email, "age": $0.age, "gender": $0.gender,
                    "location": $0.location as Any, "bio": $0.bio as Any,
                ]
            } as Any,
        ]

        var businessPayloads: [[String: Any]] = []
        for business in businesses {
            async let contactTask = getGraph(businessId: business.id)
            async let paymentTask = getPayments(businessId: business.id)
            async let shelfTask = getShelf(businessId: business.id)
            let (graph, payments, shelf) = try await (contactTask, paymentTask, shelfTask)

            businessPayloads.append([
                "name": business.name,
                "niche": business.niche,
                "description": business.description,
                "contacts": (graph.contacts).map {
                    ["name": $0.name, "status": $0.status, "sourceUrl": $0.sourceUrl as Any]
                },
                "payments": payments.payments.map {
                    ["amount": $0.amount, "note": $0.note as Any,
                     "occurredAt": ISO8601DateFormatter().string(from: $0.occurredAt)]
                },
                "products": shelf.products.map {
                    ["name": $0.name, "price": $0.price as Any, "stock": $0.stock as Any]
                },
            ])
        }
        payload["businesses"] = businessPayloads
        payload["saved"] = Array(try await savedSlugs())
        payload["milestones"] = Array(try await completedMilestones())

        return try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])
    }

    // MARK: - Account deletion

    /// Removes everything, by deleting the zone the whole account lives in.
    ///
    /// One call, and nothing survives it — which is the property that makes
    /// this provable rather than merely thorough. Guideline 5.1.1(v).
    func deleteEverything() async throws {
        _ = try await database.modifyRecordZones(saving: [], deleting: [zoneID])
        zoneReady = false
    }

    // MARK: - Fetching

    private func fetchAll(_ recordType: String) async throws -> [CKRecord] {
        let query = CKQuery(recordType: recordType, predicate: NSPredicate(value: true))
        var records: [CKRecord] = []

        do {
            var response = try await database.records(
                matching: query,
                inZoneWith: zoneID,
                resultsLimit: CKQueryOperation.maximumResults
            )
            while true {
                for (_, result) in response.matchResults {
                    if let record = try? result.get() { records.append(record) }
                }
                guard let cursor = response.queryCursor else { break }
                response = try await database.records(
                    continuingMatchFrom: cursor,
                    resultsLimit: CKQueryOperation.maximumResults
                )
            }
        } catch let error as CKError where error.code == .zoneNotFound || error.code == .unknownItem {
            // Nothing has ever been written on this account. Empty, not broken.
            return []
        }

        return records
    }
}

// MARK: - Typed reads

private extension CKRecord {
    func str(_ key: String) -> String? { self[key] as? String }
    func num(_ key: String) -> Int? { (self[key] as? NSNumber)?.intValue }
    func dbl(_ key: String) -> Double? { (self[key] as? NSNumber)?.doubleValue }

    /// Stored as epoch seconds rather than CloudKit's own timestamp type, so
    /// the schema file can declare it and there is one representation to reason
    /// about rather than two.
    func date(_ key: String) -> Date {
        guard let seconds = num(key) else { return Date() }
        return Date(timeIntervalSince1970: TimeInterval(seconds))
    }
}
