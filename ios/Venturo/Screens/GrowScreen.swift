import SwiftUI

/// Grow: where the people who buy what you make already gather.
///
/// Each community is an accordion — image and one-line teaser collapsed, the
/// full profile in place when tapped. Expanding rather than navigating because
/// the useful act is comparing several, and a push per community turns that
/// into back-and-forth.
struct GrowScreen: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app
    @Environment(\.openURL) private var openURL

    @State private var posts: [GrowthPost]?
    @State private var expanded: Set<String> = []
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                header
                content
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 64)
        }
        .background(theme.scheme.background)
        .refreshable { await load() }
        .task { if posts == nil { await load() } }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Grow")
                .font(.custom(Typeface.display, size: 30))
                .tracking(-0.45)
                .foregroundStyle(theme.scheme.text)
                .padding(.top, 6)
            Text("Where your customers already gather.")
                .font(.custom(Typeface.sansMedium, size: 13))
                .foregroundStyle(theme.scheme.textSecondary)
        }
        .padding(.bottom, 12)
    }

    @ViewBuilder private var content: some View {
        // Growth is inherently business-centric — the feed ranks against a
        // business, so there is nothing honest to show an explorer. Saying that
        // plainly beats an empty list that looks broken.
        if app.activeBusiness == nil {
            explorerState
        } else if let posts {
            if posts.isEmpty {
                Text("No communities for this niche yet.")
                    .font(.custom(Typeface.sansMedium, size: 14))
                    .foregroundStyle(theme.scheme.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 56)
            } else {
                ForEach(posts) { post in
                    CommunityCard(
                        post: post,
                        isExpanded: expanded.contains(post.id),
                        onToggle: {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                if expanded.contains(post.id) { expanded.remove(post.id) }
                                else { expanded.insert(post.id) }
                            }
                        },
                        onExplore: { if let url = URL(string: post.url) { openURL(url) } }
                    )
                    .padding(.bottom, 16)
                }
            }
        } else if let errorMessage {
            VStack(spacing: Space.three) {
                Text("Couldn't load Grow")
                    .font(.custom(Typeface.sansBold, size: 15))
                    .foregroundStyle(theme.scheme.text)
                Text(errorMessage)
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.textSecondary)
                    .multilineTextAlignment(.center)
                Button("Try again") { Task { await load() } }
                    .font(.custom(Typeface.sansSemiBold, size: 14))
                    .foregroundStyle(theme.scheme.accentText)
                    .padding(.horizontal, 24).padding(.vertical, 10)
                    .background(theme.scheme.accent, in: Capsule())
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 56)
        } else {
            ProgressView().tint(theme.scheme.accent)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 64)
        }
    }

    private var explorerState: some View {
        VStack(spacing: Space.two) {
            Icon(name: .compass, size: 32, color: theme.scheme.accent)
            Text("Growth comes after the idea")
                .font(.custom(Typeface.display, size: 20))
                .foregroundStyle(theme.scheme.text)
            Text("Find something worth selling in Discover first. Then this fills up with the places its buyers already are.")
                .font(.custom(Typeface.sansMedium, size: 14))
                .foregroundStyle(theme.scheme.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 56)
        .padding(.horizontal, 24)
    }

    private func load() async {
        guard let business = app.activeBusiness else { return }
        errorMessage = nil
        do {
            posts = try await app.content.getGrowth(businessId: business.id).posts
        } catch {
            if posts == nil { errorMessage = error.localizedDescription }
        }
    }
}

/// One community, collapsed or open.
struct CommunityCard: View {
    @Environment(\.theme) private var theme
    let post: GrowthPost
    let isExpanded: Bool
    let onToggle: () -> Void
    let onExplore: () -> Void

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 0) {
                hero
                summary
                if isExpanded { detail }
            }
        }
    }

    /// Taller than a product hero — 4:3. These images are mood rather than
    /// merchandise (a room, a workshop, a table of tools) and a shallow band
    /// reads as a header strip instead of a photograph.
    private var hero: some View {
        ZStack {
            theme.scheme.accentSoft
            if let raw = post.imageUrl, let url = URL(string: raw) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() }
                    else { Color.clear }
                }
            } else {
                // No photo yet. The platform name on a tinted panel is honest
                // about being unillustrated; an empty frame reads as a failure.
                Text(post.platform)
                    .font(.custom(Typeface.display, size: 26))
                    .foregroundStyle(theme.scheme.accent.opacity(0.42))
            }
        }
        .aspectRatio(4.0 / 3.0, contentMode: .fit)
        .frame(maxWidth: .infinity)
        .clipped()
        .overlay(alignment: .bottomLeading) {
            HStack(spacing: 8) {
                HeroChip(label: post.platform, background: PlatformColor.of(post.platform))
                HeroChip(label: KindLabel.of(post.kind))
            }
            .padding(14)
        }
        .overlay(alignment: .bottomTrailing) {
            ImageAttribution(credit: post.imageCredit).padding(14)
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onToggle)
    }

    private var summary: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(post.title)
                    .font(.custom(Typeface.sansSemiBold, size: 18))
                    .tracking(-0.4)
                    .foregroundStyle(theme.scheme.text)
                Text(post.tagline)
                    .font(.custom(Typeface.sansMedium, size: 14))
                    .foregroundStyle(theme.scheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if let members = post.memberCount {
                    Text("\(members.formatted(.number.notation(.compactName))) members")
                        .font(.custom(Typeface.sansMedium, size: 12))
                        .monospacedDigit()
                        .foregroundStyle(theme.scheme.textSecondary)
                        .padding(.top, 1)
                }
            }
            Spacer(minLength: 0)
            Icon(name: .chev, size: 12, color: theme.scheme.textSecondary, rotate: isExpanded ? 180 : 0)
                .padding(.top, 4)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .contentShape(Rectangle())
        .onTapGesture(perform: onToggle)
    }

    private var detail: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Overview is paragraphs separated by blank lines.
            ForEach(Array(paragraphs(post.overview).enumerated()), id: \.offset) { _, para in
                Text(para)
                    .font(.custom(Typeface.sans, size: 14))
                    .lineSpacing(8.4)
                    .foregroundStyle(theme.scheme.text)
                    .fixedSize(horizontal: false, vertical: true)
            }

            MiniBlock {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Who you'll find here")
                        .font(.custom(Typeface.sansSemiBold, size: 12))
                        .foregroundStyle(theme.scheme.textSecondary)
                    Text(post.audience)
                        .font(.custom(Typeface.sansMedium, size: 14))
                        .foregroundStyle(theme.scheme.text)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            bulletSection("What they talk about", post.discussions, mark: "•", tint: theme.scheme.textSecondary)
            bulletSection("What wins them over", post.loves, mark: "✓", tint: theme.scheme.success)
            bulletSection("What turns them off", post.dislikes, mark: "✕", tint: theme.scheme.danger)
            bulletSection("House rules", post.rules, mark: "§", tint: theme.scheme.textSecondary)

            // "The play" gets an accent edge — it is the one part that tells you
            // what to actually do, rather than describing the room.
            VStack(alignment: .leading, spacing: 4) {
                Text("The play")
                    .font(.custom(Typeface.sansBold, size: 11))
                    .tracking(0.9)
                    .foregroundStyle(theme.scheme.accent)
                Text(post.approach)
                    .font(.custom(Typeface.sansMedium, size: 14))
                    .foregroundStyle(theme.scheme.text)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 13)
            .padding(.vertical, 11)
            .background(theme.scheme.backgroundSelected)
            .overlay(alignment: .leading) {
                Rectangle().fill(theme.scheme.accent).frame(width: 3)
            }
            .clipShape(RoundedRectangle(cornerRadius: Radius.inset, style: .continuous))

            GhostButton(label: "Explore \(post.title)", action: onExplore)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
    }

    @ViewBuilder
    private func bulletSection(_ title: String, _ body: String, mark: String, tint: Color) -> some View {
        let items = lines(body)
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                    .font(.custom(Typeface.sansSemiBold, size: 15))
                    .foregroundStyle(theme.scheme.text)
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .top, spacing: 9) {
                        Text(mark)
                            .font(.custom(Typeface.sansBold, size: 13))
                            .foregroundStyle(tint)
                        Text(item)
                            .font(.custom(Typeface.sansMedium, size: 13))
                            .foregroundStyle(theme.scheme.text)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
    }

    /// Newline-separated lists, blanks dropped.
    private func lines(_ s: String) -> [String] {
        s.split(separator: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    /// Paragraphs are separated by a blank line.
    private func paragraphs(_ s: String) -> [String] {
        s.components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }
}

enum PlatformColor {
    static func of(_ platform: String) -> Color {
        switch platform.lowercased() {
        case "reddit": return Color(hex: 0xD93A00)
        case "instagram": return Color(hex: 0xC13584)
        case "tiktok": return Color(hex: 0x111111)
        case "youtube": return Color(hex: 0xC4302B)
        case "pinterest": return Color(hex: 0xBD081C)
        case "facebook": return Color(hex: 0x1877F2)
        case "etsy": return Color(hex: 0xE07B39)
        case "x", "twitter": return Color(hex: 0x14171A)
        default: return Color(hex: 0x60646C)
        }
    }
}

enum KindLabel {
    static func of(_ kind: String) -> String {
        switch kind {
        case "community": return "Community"
        case "hashtag": return "Hashtag"
        case "marketplace": return "Marketplace"
        case "search": return "Trends & research"
        case "event": return "Event"
        default: return kind.capitalized
        }
    }
}
