import SwiftUI

/// The last thing onboarding does, and the only cinematic moment in the app.
///
/// Three beats and then the app. It exists because the transition from
/// answering questions to using the thing is the one place a small app can
/// afford to hold somebody still for four seconds — they have just told it
/// about themselves, and going straight to a feed would spend that for nothing.
///
/// It plays once, on a black field, deliberately unlike everything else here.
/// The rest of Venturo is warm and flat; this is the exception that makes
/// arriving feel like arriving.
struct ReadySequence: View {
    let name: String
    /// The closing words, from the script. "Start your venture."
    let closer: String?
    /// Called when the last beat has played. The caller uses this to move the
    /// app on, so the fade out of here is the fade into Discover.
    let onFinish: () -> Void

    @State private var beat: Beat = .ready
    @State private var markScale: CGFloat = 0.6
    @State private var markOpacity: Double = 0

    private enum Beat {
        case ready      // "Are you ready?"
        case dark       // a held breath
        case closer     // "Start your … venture"
        case done
    }

    /// Split so the second half can land after a pause. "Start your" arrives,
    /// then a beat, then the word the app is named for.
    private var closerParts: (String, String) {
        let text = closer ?? "Start your venture"
        guard let lastSpace = text.lastIndex(of: " ") else { return (text, "") }
        return (String(text[text.startIndex..<lastSpace]), String(text[text.index(after: lastSpace)...]))
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            switch beat {
            case .ready:
                VStack(spacing: 16) {
                    BrandMark(size: 64)
                        .scaleEffect(markScale)
                        .opacity(markOpacity)
                    Text(name.isEmpty ? "Are you ready?" : "Ready, \(name)?")
                        .font(.custom(Typeface.display, size: 34))
                        .tracking(-0.6)
                        .foregroundStyle(.white)
                        .opacity(markOpacity)
                }
                .transition(.opacity)

            case .dark:
                Color.clear

            case .closer, .done:
                VStack(spacing: 4) {
                    Text(closerParts.0)
                        .font(.custom(Typeface.sansMedium, size: 20))
                        .foregroundStyle(.white.opacity(0.65))
                    Text(closerParts.1)
                        .font(.custom(Typeface.wordmark, size: 44))
                        // The accent's dark-mode purple: this is a black field,
                        // and the light one measures 1.64:1 on it.
                        .foregroundStyle(Color(hex: 0xD0B8F0))
                        .frame(height: 50)
                }
                .transition(.opacity.combined(with: .scale(scale: 0.94)))
            }
        }
        .task { await play() }
        // Nothing to tap through. Four seconds is short enough not to need an
        // escape hatch, and offering one would say the app expected to be
        // skipped.
        .statusBarHidden()
    }

    private func play() async {
        withAnimation(.easeOut(duration: 0.7)) {
            markScale = 1
            markOpacity = 1
        }
        try? await Task.sleep(for: .milliseconds(1600))

        withAnimation(.easeInOut(duration: 0.45)) { beat = .dark }
        try? await Task.sleep(for: .milliseconds(650))

        withAnimation(.easeOut(duration: 0.6)) { beat = .closer }
        try? await Task.sleep(for: .milliseconds(1700))

        // The caller swaps this view for the app. Fading here rather than
        // cutting means the last frame of onboarding and the first frame of
        // Discover are the same moment.
        withAnimation(.easeInOut(duration: 0.5)) { beat = .done }
        try? await Task.sleep(for: .milliseconds(350))
        onFinish()
    }
}
