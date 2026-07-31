import SwiftUI

/// You: who you are, and where people can find you.
struct YouScreen: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app

    @State private var section: Section = .business

    enum Section: String, CaseIterable {
        case business, profile, socials, settings

        var label: String {
            switch self {
            case .business: return "Business"
            case .profile: return "About you"
            case .socials: return "Socials"
            case .settings: return "Settings"
            }
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                header
                picker
                switch section {
                case .business: BusinessSection()
                case .profile: ProfileSection()
                case .socials: SocialsSection()
                case .settings: SettingsSection()
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 64)
        }
        .background(theme.scheme.background)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(app.profile?.name ?? "You")
                .font(.custom(Typeface.display, size: 26))
                .tracking(-0.4)
                .foregroundStyle(theme.scheme.text)
                .padding(.top, 6)
            Text(app.profile?.email ?? "Who you are, and where people can find you.")
                .font(.custom(Typeface.sansMedium, size: 13))
                .foregroundStyle(theme.scheme.textSecondary)
        }
    }

    private var picker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Section.allCases, id: \.self) { option in
                    FilterChip(label: option.label, isOn: section == option) {
                        section = option
                    }
                }
            }
        }
        .padding(.top, 12)
        .padding(.bottom, 12)
    }
}

// MARK: - Business

private struct BusinessSection: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app

    @State private var name = ""
    @State private var niche = ""
    @State private var description = ""
    @State private var pageUrl = ""
    @State private var isSaving = false
    @State private var savedAt: Date?
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let business = app.activeBusiness {
                PanelCard(title: "Your business", icon: .shop) {
                    VStack(alignment: .leading, spacing: 10) {
                        LabeledField(label: "Name", placeholder: "Business name", text: $name)
                        LabeledField(label: "Product / niche", placeholder: "What you sell", text: $niche)
                        LabeledField(label: "Describe it in a sentence", placeholder: "What you make, and who for", text: $description)
                        LabeledField(label: "Where should people land?", placeholder: "etsy.com/shop/yours", text: $pageUrl)
                        if let errorMessage {
                            Text(errorMessage)
                                .font(.custom(Typeface.sansMedium, size: 13))
                                .foregroundStyle(theme.scheme.danger)
                        }
                        PrimaryButton(label: buttonLabel) { Task { await save(business) } }
                            .disabled(isSaving || !isDirty(business))
                            .opacity(isDirty(business) ? 1 : 0.5)
                    }
                }

                if app.businesses.count > 1 {
                    PanelCard(title: "All your ventures", icon: .book) {
                        VStack(spacing: 0) {
                            ForEach(app.businesses) { venture in
                                HStack {
                                    Text(venture.name)
                                        .font(.custom(Typeface.sansMedium, size: 14))
                                        .foregroundStyle(theme.scheme.text)
                                    Spacer()
                                    if venture.id == business.id {
                                        Text("active")
                                            .font(.custom(Typeface.sansBold, size: 11))
                                            .foregroundStyle(theme.scheme.accent)
                                    } else {
                                        Button("Switch →") { app.switchBusiness(to: venture.id) }
                                            .font(.custom(Typeface.sansSemiBold, size: 13))
                                            .foregroundStyle(theme.scheme.accent)
                                    }
                                }
                                .padding(.vertical, 9)
                            }
                        }
                    }
                }
            } else {
                ExplorerEmpty(
                    title: "No business yet",
                    body_: "When you commit to a product in Discover, your business gets set up right here."
                )
            }
        }
        .onAppear { fill() }
    }

    private var buttonLabel: String {
        if isSaving { return "Saving…" }
        if let savedAt, Date().timeIntervalSince(savedAt) < 2 { return "Saved ✓" }
        return "Save changes"
    }

    private func fill() {
        guard let business = app.activeBusiness else { return }
        name = business.name
        niche = business.niche
        description = business.description
        pageUrl = business.pageUrl ?? ""
    }

    private func isDirty(_ business: Business) -> Bool {
        name != business.name || niche != business.niche
            || description != business.description || pageUrl != (business.pageUrl ?? "")
    }

    private func save(_ business: Business) async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            // An empty string clears the link server-side; nil would leave it.
            let updated = try await app.api.updateBusiness(
                id: business.id,
                UpdateBusiness(name: name, niche: niche, description: description, pageUrl: pageUrl)
            )
            app.businessUpdated(updated)
            savedAt = Date()
        } catch let error as APIError {
            errorMessage = error.message
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Profile

private struct ProfileSection: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app

    @State private var name = ""
    @State private var email = ""
    @State private var location = ""
    @State private var bio = ""
    @State private var goals = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        PanelCard(title: "About you", icon: .user) {
            VStack(alignment: .leading, spacing: 10) {
                LabeledField(label: "Your name", placeholder: "Name", text: $name)
                LabeledField(label: "Email", placeholder: "you@example.com", text: $email, keyboard: .emailAddress)
                LabeledField(label: "Location", placeholder: "e.g. Austin, TX", text: $location)
                LabeledField(label: "Bio", placeholder: "A sentence about you — people buy from people", text: $bio)
                LabeledField(label: "What do you want from this?", placeholder: "e.g. replace my day job in two years", text: $goals)
                if let errorMessage {
                    Text(errorMessage)
                        .font(.custom(Typeface.sansMedium, size: 13))
                        .foregroundStyle(theme.scheme.danger)
                }
                PrimaryButton(label: isSaving ? "Saving…" : "Save") { Task { await save() } }
                    .disabled(isSaving)
            }
        }
        .onAppear { fill() }
    }

    private func fill() {
        guard let profile = app.profile else { return }
        name = profile.name
        email = profile.email
        location = profile.location ?? ""
        bio = profile.bio ?? ""
        goals = profile.goals ?? ""
    }

    private func save() async {
        guard let profile = app.profile else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            // age and gender are re-sent unchanged: the server patches only what
            // it receives, so omitting them would not preserve them.
            let updated = try await app.api.updateProfile(
                id: profile.id,
                UpdateProfile(
                    name: name, email: email, age: profile.age, gender: profile.gender,
                    location: location.isEmpty ? nil : location,
                    bio: bio.isEmpty ? nil : bio,
                    goals: goals.isEmpty ? nil : goals
                )
            )
            app.profileUpdated(updated)
        } catch let error as APIError {
            errorMessage = error.message
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Socials

private struct SocialsSection: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app

    /// Fixed order, and all seven always shown — the form is a checklist of
    /// where you could be findable, not a list of where you already are.
    private static let platforms = [
        ("INSTAGRAM", "Instagram"), ("TWITTER", "X"), ("TIKTOK", "TikTok"),
        ("YOUTUBE", "YouTube"), ("REDDIT", "Reddit"), ("FACEBOOK", "Facebook"),
        ("PINTEREST", "Pinterest"),
    ]

    @State private var links: [String: String] = [:]
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if let business = app.activeBusiness {
                PanelCard(title: "Where your business lives", icon: .link) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Grow uses these to meet customers where you already are.")
                            .font(.custom(Typeface.sansMedium, size: 12))
                            .foregroundStyle(theme.scheme.textSecondary)
                        ForEach(Self.platforms, id: \.0) { key, label in
                            LabeledField(
                                label: label,
                                placeholder: "Link (optional)",
                                text: Binding(
                                    get: { links[key] ?? "" },
                                    set: { links[key] = $0 }
                                ),
                                keyboard: .URL
                            )
                        }
                        Text("\(connectedCount) connected")
                            .font(.custom(Typeface.sansMedium, size: 12))
                            .foregroundStyle(theme.scheme.textSecondary)
                        if let errorMessage {
                            Text(errorMessage)
                                .font(.custom(Typeface.sansMedium, size: 13))
                                .foregroundStyle(theme.scheme.danger)
                        }
                        PrimaryButton(label: isSaving ? "Saving…" : "Save links") {
                            Task { await save(business) }
                        }
                        .disabled(isSaving)
                    }
                }
                .task { await load(business) }
            } else {
                ExplorerEmpty(
                    title: "Nothing to link yet",
                    body_: "Your socials attach to a business, so this opens up once you have one."
                )
            }
        }
    }

    private var connectedCount: Int {
        links.values.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }.count
    }

    private func load(_ business: Business) async {
        guard let existing = try? await app.api.getSocials(businessId: business.id) else { return }
        var next: [String: String] = [:]
        for link in existing { next[link.platform] = link.url }
        links = next
    }

    private func save(_ business: Business) async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        // All seven every time, blanks included — an empty string is how the
        // server is told to delete that link. Sending only the filled ones
        // would leave removed links in place.
        let payload = Self.platforms.map { key, _ in
            SocialLinkInput(platform: key, url: links[key] ?? "")
        }
        do {
            _ = try await app.api.saveSocials(businessId: business.id, links: payload)
        } catch let error as APIError {
            errorMessage = error.message
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Settings

private struct SettingsSection: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app

    @State private var coolingOff = Preferences.coolingOffDays

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            PanelCard(title: "Relationship reminders", icon: .sliders) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("How long somebody can go quiet before they show up in \"Who needs you\".")
                        .font(.custom(Typeface.sansMedium, size: 13))
                        .foregroundStyle(theme.scheme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 8) {
                        ForEach([3, 7, 14, 30], id: \.self) { days in
                            FilterChip(label: "\(days)d", isOn: coolingOff == days) {
                                coolingOff = days
                                Preferences.coolingOffDays = days
                            }
                        }
                    }
                }
            }

            PanelCard(title: "Appearance", icon: .spark) {
                Text("Follows your system light and dark setting — the artisan palette in daylight, charcoal and lavender at night.")
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Account deletion and export live here. Both exist server-side —
            // DELETE /api/account and GET /api/account/export — and both are
            // App Store requirements rather than niceties, so they are wired
            // in the settings screen rather than buried.
            AccountSection()
        }
    }
}
