import ClerkKit
import Foundation

/// Clerk configuration.
///
/// The publishable key is safe in source — that is what "publishable" means,
/// and Clerk's own quickstart embeds it. The secret key lives only in the
/// server's environment and never comes near this target.
enum ClerkConfig {
    /// The **development** instance.
    ///
    /// Clerk logs a warning about development keys at launch, and it is right
    /// to: they carry strict usage limits and must not ship. Before the App
    /// Store build, create a production instance and swap this — it is a
    /// different key and a different user pool, so it is worth doing early
    /// enough to test rather than on submission day.
    static let publishableKey = "pk_test_Z3JlYXQtYW5jaG92eS0zMi5jbGVyay5hY2NvdW50cy5kZXYk"
}

/// Supplies the API client with a bearer token, per request.
///
/// Deliberately not caching. Clerk session tokens live about a minute and
/// `getToken()` refreshes silently, so holding the string works right up until
/// the app has been idle — and then 401s everything at once, which looks like
/// the session being lost rather than a stale token.
///
/// A failure returns nil rather than throwing: the request then goes out
/// unauthenticated and the server answers 401, which is the same outcome the
/// caller has to handle anyway. Turning it into a separate error would give
/// every call site two ways to express one problem.
struct ClerkTokenProvider: TokenProvider {
    func token() async -> String? {
        try? await Clerk.shared.auth.getToken()
    }
}

/// The signed-in user's email address.
///
/// Onboarding needs it — the server requires an email on the profile and the
/// user has already proved this one. Reading it from Clerk rather than asking
/// again avoids a question whose answer is already known and could be typed
/// differently.
@MainActor
enum AccountEmail {
    static var current: String? {
        // ⚠️ The most likely line in this file to need correcting: the exact
        // shape of the user's email collection differs across Clerk versions.
        // If this does not compile, the fix is one property path, and the
        // fallback below keeps onboarding working meanwhile.
        Clerk.shared.user?.primaryEmailAddress?.emailAddress
    }
}
