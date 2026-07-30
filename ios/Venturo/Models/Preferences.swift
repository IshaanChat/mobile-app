import Foundation

/// State that lives on the device rather than the server.
///
/// Four values, ported from `mobile/src/lib/prefs.ts`. The wire formats are
/// kept identical to the React Native app's — not for interoperability, since
/// nothing reads both, but because the semantics were already decided and
/// changing them silently would change behaviour that was deliberate.
enum Preferences {
    private static let defaults = UserDefaults.standard

    private enum Key {
        static let activeBusinessId = "sm.activeBusinessId"
        static let interests = "sm.interests"
        static let streak = "sm.streak"
        static let coolingOffDays = "sm.coolingOffDays"
    }

    // MARK: - Active business

    static var activeBusinessId: String? {
        get { defaults.string(forKey: Key.activeBusinessId) }
        set {
            if let newValue {
                defaults.set(newValue, forKey: Key.activeBusinessId)
            } else {
                defaults.removeObject(forKey: Key.activeBusinessId)
            }
        }
    }

    // MARK: - Onboarding interests

    /// What an explorer said they were into. Sent to `/api/trends` as the
    /// `interests` query param, standing in for the business they do not have
    /// yet. Stored comma-joined to match the query format it feeds.
    static var interests: [String] {
        get {
            (defaults.string(forKey: Key.interests) ?? "")
                .split(separator: ",")
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
        }
        set { defaults.set(newValue.joined(separator: ","), forKey: Key.interests) }
    }

    // MARK: - Streak

    /// Days opened in a row.
    ///
    /// Call once per launch. Returns the current count and writes only when the
    /// day has actually changed, so repeated calls in one session are free.
    ///
    /// Deliberately uses the **local** calendar day rather than UTC: somebody
    /// opening the app at 11pm and again at 1am has used it on two days by any
    /// measure they would recognise, and a UTC boundary would disagree with
    /// them depending on where they live.
    @discardableResult
    static func touchStreak(now: Date = Date(), calendar: Calendar = .current) -> Int {
        let today = dayString(now, calendar)
        let stored = defaults.string(forKey: Key.streak) ?? ""
        let parts = stored.split(separator: "|", maxSplits: 1)
        let lastDay = parts.count == 2 ? String(parts[0]) : ""
        let lastCount = parts.count == 2 ? Int(parts[1]) ?? 0 : 0

        if lastDay == today { return lastCount }

        let yesterday = dayString(
            calendar.date(byAdding: .day, value: -1, to: now) ?? now, calendar)
        let next = lastDay == yesterday ? lastCount + 1 : 1

        defaults.set("\(today)|\(next)", forKey: Key.streak)
        return next
    }

    private static func dayString(_ date: Date, _ calendar: Calendar) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    // MARK: - Cooling off

    /// How long a contact can go quiet before they surface under "Who needs
    /// you". Defaults to a week; the UI offers 3, 7, 14 and 30.
    static var coolingOffDays: Int {
        get {
            let stored = defaults.integer(forKey: Key.coolingOffDays)
            return (1...60).contains(stored) ? stored : 7
        }
        set { defaults.set(min(max(newValue, 1), 60), forKey: Key.coolingOffDays) }
    }

    /// Wipes everything this app stores locally. Server data is untouched.
    static func reset() {
        [Key.activeBusinessId, Key.interests, Key.streak, Key.coolingOffDays]
            .forEach(defaults.removeObject(forKey:))
    }
}
