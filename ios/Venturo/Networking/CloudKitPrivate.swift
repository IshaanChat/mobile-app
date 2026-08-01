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

    /// Stored as epoch seconds rather than CloudKit's own timestamp type, so
    /// the schema file can declare it and there is one representation to reason
    /// about rather than two.
    func date(_ key: String) -> Date {
        guard let seconds = num(key) else { return Date() }
        return Date(timeIntervalSince1970: TimeInterval(seconds))
    }
}
