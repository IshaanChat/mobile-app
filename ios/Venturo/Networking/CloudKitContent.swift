import CloudKit
import Foundation

/// Reads the curated content database out of CloudKit's public database.
///
/// Returns the same model types `APIClient` did, deliberately — the screens are
/// the part of this app that has been designed, and a migration that rewrites
/// them is a migration that redesigns them by accident.
///
/// **No account is required.** The public database reads without an iCloud
/// login, which is what lets Discover be the front door rather than something
/// behind a sign-up wall. Anything needing an identity lives in the private
/// database and is not here.
///
/// Two things are stubbed until the private database lands: `saved` on a
/// product and `completed` on a milestone. Both are per-user facts, both
/// currently read false, and both are marked at their call sites rather than
/// quietly defaulted.
/// An actor rather than a main-actor class: it holds a mutable cache, does no
/// UI work, and is constructed from `AppState.init`, which is not isolated.
actor CloudKitContent {
    private let database: CKDatabase

    /// 886 products across ~5 round trips is not something to repeat on every
    /// tab change. Content changes when the push script runs, not while the app
    /// is open, so a generous window costs nothing and saves the feed.
    private var cache: [String: (fetched: Date, records: [CKRecord])] = [:]
    private let cacheWindow: TimeInterval = 15 * 60

    init(containerIdentifier: String = "iCloud.com.ishaanchaturvedi.salesmechanic") {
        self.database = CKContainer(identifier: containerIdentifier).publicCloudDatabase
    }

    // MARK: - Fetching

    /// Every record of a type, following cursors.
    ///
    /// `NSPredicate(value: true)` is only legal because the schema marks
    /// `___recordID` QUERYABLE — without it CloudKit rejects the query rather
    /// than returning nothing, which is the better of the two failures.
    private func fetchAll(_ recordType: String, sortedBy key: String? = nil) async throws -> [CKRecord] {
        if let hit = cache[recordType], Date().timeIntervalSince(hit.fetched) < cacheWindow {
            return hit.records
        }

        let query = CKQuery(recordType: recordType, predicate: NSPredicate(value: true))
        if let key {
            query.sortDescriptors = [NSSortDescriptor(key: key, ascending: false)]
        }

        var records: [CKRecord] = []
        var response = try await database.records(
            matching: query,
            resultsLimit: CKQueryOperation.maximumResults
        )

        while true {
            for (_, result) in response.matchResults {
                // One unreadable record should not lose the other 885.
                if let record = try? result.get() { records.append(record) }
            }
            guard let cursor = response.queryCursor else { break }
            response = try await database.records(
                continuingMatchFrom: cursor,
                resultsLimit: CKQueryOperation.maximumResults
            )
        }

        cache[recordType] = (Date(), records)
        return records
    }

    /// Drops every cached type. Called after anything that should show new
    /// content immediately rather than within the window.
    func invalidate() {
        cache.removeAll()
    }

    // MARK: - Discover

    /// `savedSlugs` comes from the private database and is joined here, because
    /// CloudKit cannot reference across databases. Passing it in rather than
    /// fetching it keeps this side account-free — somebody with no iCloud login
    /// gets the same feed, minus the hearts.
    func getTrends(
        businessId: String?,
        interests: [String] = [],
        savedSlugs: Set<String> = []
    ) async throws -> TrendsPayload {
        async let productTask = fetchAll("Product", sortedBy: "hotness")
        async let nicheTask = fetchAll("Niche")

        let (productRecords, nicheRecords) = try await (productTask, nicheTask)

        let niches = Dictionary(
            uniqueKeysWithValues: nicheRecords.map { ($0.recordID.recordName, $0) }
        )
        let products = productRecords.map { record -> DiscoverProduct in
            var item = product(from: record, niches: niches)
            item.saved = savedSlugs.contains(item.slug)
            return item
        }

        return TrendsPayload(
            generatedAt: Date(),
            sort: "niche",
            sections: sections(for: products),
            products: products
        )
    }

    /// Shelves, ordered by their best product.
    ///
    /// Provisional. The server ranked this in `trends/rank.ts` with the user's
    /// niche and interests in hand; porting that is its own piece of work, and
    /// pretending otherwise here would bury it. What this does keep is the one
    /// ordering rule that is not about scoring: Sourced leads.
    private func sections(for products: [DiscoverProduct]) -> [TrendSection] {
        var grouped: [String: [DiscoverProduct]] = [:]
        for product in products {
            grouped[product.niche?.domain ?? "sourced", default: []].append(product)
        }

        return grouped
            .map { domain, items in
                (
                    section: TrendSection(
                        key: domain,
                        title: title(forDomain: domain),
                        productIds: items.map(\.id)
                    ),
                    best: items.map(\.hotness).max() ?? 0,
                    isSourced: domain == "sourced"
                )
            }
            .sorted { a, b in
                if a.isSourced != b.isSourced { return a.isSourced }
                return a.best > b.best
            }
            .map(\.section)
    }

    private func title(forDomain domain: String) -> String {
        if domain == "sourced" { return "Sourced" }
        return domain
            .split(separator: "-")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }

    private func product(from record: CKRecord, niches: [String: CKRecord]) -> DiscoverProduct {
        let slug = record.recordID.recordName
        let nicheSlug = record.string("nicheSlug")
        let nicheRecord = nicheSlug.flatMap { niches[$0] }

        let niche = nicheRecord.flatMap { record -> ProductNiche? in
            guard let name = record.string("name") else { return nil }
            return ProductNiche(
                slug: record.recordID.recordName,
                name: name,
                label: record.string("label"),
                domain: record.string("domain") ?? "",
                audience: record.string("audience") ?? "both"
            )
        }

        return DiscoverProduct(
            id: slug,
            slug: slug,
            title: record.string("title") ?? slug,
            blurb: record.string("blurb") ?? "",
            category: niche?.domain ?? record.string("sourceCategory") ?? "",
            niche: niche,
            sourcingType: record.string("sourcingType"),
            sourceName: record.string("sourceName"),
            sourcingUrl: record.string("sourcingUrl"),
            sourceCost: record.string("sourceCost"),
            typicalResale: record.string("typicalResale"),
            priceRange: priceRange(from: record),
            imageUrl: record.string("imageUrl"),
            imageCredit: record.string("imageCredit"),
            hotness: record.int("hotness") ?? 0,
            tier: record.string("tier"),
            evidence: evidence(from: record),
            // Private database. False for everyone until phase 4.
            saved: false,
            savedAt: nil
        )
    }

    /// Free text, never a parsed number — the honest answer is usually a range.
    private func priceRange(from record: CKRecord) -> String? {
        guard let low = record.double("signalPriceLow") else { return nil }
        guard let high = record.double("signalPriceHigh"), high > low else {
            return String(format: "$%.2f", low)
        }
        return String(format: "$%.2f–%.2f", low, high)
    }

    private func evidence(from record: CKRecord) -> DiscoverEvidence? {
        let sources = record["signalSources"] as? [String] ?? []
        let heat = record.int("signalHeat")
        let interest = record.int("signalInterest")
        let units = record.int("signalUnitsSold")

        // An empty block beats an invented one — if nothing was measured, say
        // nothing rather than rendering a card full of zeroes.
        guard heat != nil || interest != nil || units != nil || !sources.isEmpty else {
            return nil
        }

        return DiscoverEvidence(
            heat: heat,
            heatDelta: nil,
            unitsSold: units,
            listings: nil,
            saturation: nil,
            priceLow: record.double("signalPriceLow"),
            priceHigh: record.double("signalPriceHigh"),
            adCount: nil,
            adDaysLive: nil,
            adReach: nil,
            interest: interest,
            interestTrend: record.double("signalInterestTrend"),
            liveSourcingUrl: nil,
            liveMerchant: nil,
            adSource: nil,
            adCoverage: nil,
            adEvidenceUrl: nil,
            adAdvertiser: nil,
            sources: sources,
            polledAt: record.string("signalPolledAt").flatMap(CloudKitContent.date(from:))
        )
    }

    // MARK: - Grow

    func getGrowth(businessId: String?) async throws -> GrowthPayload {
        let records = try await fetchAll("Community", sortedBy: "hotness")
        return GrowthPayload(
            generatedAt: Date(),
            posts: records.map { record in
                GrowthPost(
                    id: record.recordID.recordName,
                    title: record.string("title") ?? record.recordID.recordName,
                    platform: record.string("platform") ?? "",
                    kind: record.string("kind") ?? "community",
                    url: record.string("url") ?? "",
                    tagline: record.string("tagline") ?? "",
                    audience: record.string("audience") ?? "",
                    imageUrl: record.string("imageUrl"),
                    imageCredit: record.string("imageCredit"),
                    memberCount: nil,
                    hotness: record.int("hotness") ?? 0,
                    overview: record.string("overview") ?? "",
                    discussions: record.string("discussions") ?? "",
                    loves: record.string("loves") ?? "",
                    dislikes: record.string("dislikes") ?? "",
                    rules: record.string("rules") ?? "",
                    approach: record.string("approach") ?? ""
                )
            }
        )
    }

    // MARK: - Tips

    func getTips(tab: String, level: Int) async throws -> [Tip] {
        let records = try await fetchAll("Tip")
        return records.compactMap { record -> Tip? in
            guard let text = record.string("text") else { return nil }
            let slug = record.recordID.recordName
            let tipTab = record.string("tab") ?? "any"
            let tipLevel = record.int("level") ?? 1

            // The server filtered; filtering here keeps one fetch serving every
            // tab, which is the whole reason the cache is worth having.
            guard tipTab == "any" || tipTab == tab, tipLevel <= level else { return nil }

            return Tip(id: slug, slug: slug, kind: record.string("kind") ?? "know",
                       text: text, tab: tipTab, level: tipLevel)
        }
    }

    // MARK: - Journey

    /// `completed` comes from the private database, same join as Discover's
    /// hearts. Empty for somebody with no account, which reads correctly: they
    /// can see the whole path and have walked none of it.
    func getJourney(completed: Set<String> = []) async throws -> JourneyPayload {
        async let levelTask = fetchAll("JourneyLevel", sortedBy: "level")
        async let milestoneTask = fetchAll("Milestone", sortedBy: "level")
        async let playbookTask = fetchAll("Playbook")

        let (levelRecords, milestoneRecords, playbookRecords) =
            try await (levelTask, milestoneTask, playbookTask)

        let byLevel = Dictionary(grouping: milestoneRecords) { $0.int("level") ?? 1 }

        // Levels gate sequentially: one is always open, and each later one waits
        // on the one before being finished. The server decided this; it is
        // decided here now, which is what moving off the API costs.
        var previousComplete = true
        var levels: [JourneyLevel] = []

        for record in levelRecords.sorted(by: { ($0.int("level") ?? 0) < ($1.int("level") ?? 0) }) {
            let number = record.int("level") ?? 1
            let milestones = (byLevel[number] ?? []).map {
                milestone(from: $0, completed: completed)
            }
            let done = milestones.filter(\.completed).count
            let isComplete = !milestones.isEmpty && done == milestones.count

            levels.append(
                JourneyLevel(
                    level: number,
                    name: record.string("name") ?? "",
                    title: record.string("title") ?? "",
                    unlocked: previousComplete,
                    complete: isComplete,
                    completedCount: done,
                    total: milestones.count,
                    milestones: milestones
                )
            )
            previousComplete = isComplete
        }

        let playbooks = playbookRecords.map { record in
            Playbook(
                slug: record.recordID.recordName,
                name: record.string("name") ?? "",
                blurb: record.string("blurb") ?? "",
                steps: record["steps"] as? [String] ?? []
            )
        }

        let all = levels.flatMap(\.milestones)
        let done = all.filter(\.completed)
        // The level you are *on* is the first unfinished one, not the last
        // finished — someone who has done nothing is on level 1, not level 0.
        let current = levels.first { $0.unlocked && !$0.complete } ?? levels.last

        return JourneyPayload(
            levels: levels,
            playbooks: playbooks,
            summary: JourneySummary(
                xp: done.reduce(0) { $0 + $1.xp },
                completed: done.count,
                total: all.count,
                level: current?.level ?? 1,
                levelName: current?.name ?? levels.first?.name ?? "",
                levelComplete: !levels.isEmpty && levels.allSatisfy(\.complete)
            ),
            // The server awarded milestones while answering; nothing is proven
            // server-side any more, so this is always empty and the celebration
            // fires from the completion call instead.
            justCompleted: []
        )
    }

    private func milestone(from record: CKRecord, completed: Set<String>) -> Milestone2 {
        let trigger = record.string("trigger")
        let slug = record.recordID.recordName
        return Milestone2(
            slug: slug,
            title: record.string("title") ?? "",
            detail: record.string("detail") ?? "",
            // `where` in the content files, `place` in CloudKit, `she` in
            // Swift. Three names for one field, because two of them are
            // reserved words somewhere.
            she: record.string("place") ?? "in-app",
            trigger: trigger,
            tab: record.string("tab"),
            xp: record.int("xp") ?? 0,
            completed: completed.contains(slug),
            // A milestone the app can prove has no "mark done" control.
            automatic: trigger != nil
        )
    }

    // MARK: - Onboarding

    /// One record holding the whole script as JSON, decoded with the same
    /// decoder the API used — the script is a nested tree of forks and prompts
    /// that no flat record type models, and keeping it whole is what preserves
    /// "edit the file, push, live".
    func getOnboardingScript() async throws -> OnboardingScript {
        let records = try await fetchAll("OnboardingScript")
        guard let json = records.first?.string("json"), let data = json.data(using: .utf8) else {
            throw CKError(.unknownItem)
        }
        return try JSONDecoder().decode(OnboardingScript.self, from: data)
    }

    // MARK: - Dates

    /// The content files carry fractional seconds, which `.iso8601` rejects
    /// outright rather than tolerating.
    private static let formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static func date(from string: String) -> Date? {
        formatter.date(from: string) ?? ISO8601DateFormatter().date(from: string)
    }
}

// MARK: - Typed reads

/// CloudKit hands back `Any?`. These keep the mapping above readable and put
/// every force-unwrap-shaped decision in one place instead of two hundred.
private extension CKRecord {
    func string(_ key: String) -> String? { self[key] as? String }
    func int(_ key: String) -> Int? { (self[key] as? NSNumber)?.intValue }
    func double(_ key: String) -> Double? { (self[key] as? NSNumber)?.doubleValue }
}
