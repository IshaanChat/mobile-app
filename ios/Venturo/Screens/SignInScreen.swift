import AuthenticationServices
import ClerkKit
import SwiftUI

/// Sign in, or make an account.
///
/// Sign in with Apple sits first and is the only one drawn as a full-width
/// system button. Beyond looking native, guideline 4.8 requires an equivalent
/// privacy-preserving option wherever a third-party login like Google is
/// offered — so it is not a nicety, it is the thing that lets Google exist here
/// at all.
struct SignInScreen: View {
    @Environment(\.theme) private var theme

    @State private var mode: Mode = .signIn
    @State private var step: Step = .credentials
    @State private var email = ""
    @State private var password = ""
    @State private var code = ""
    @State private var isBusy = false
    @State private var errorMessage: String?

    /// Held between `signUp` and `verifyEmailCode` — the flow is two calls and
    /// the second one needs the object the first returned.
    @State private var pendingSignUp: SignUp?

    private enum Mode { case signIn, signUp }
    private enum Step { case credentials, verify }

    var body: some View {
        ZStack {
            theme.scheme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if step == .credentials { credentials } else { verification }
                }
                .padding(.horizontal, 28)
                .padding(.top, 60)
                .padding(.bottom, 40)
            }
        }
    }

    // MARK: - Credentials

    private var credentials: some View {
        VStack(alignment: .leading, spacing: 0) {
            mark
            Text("Venturo")
                .font(.custom(Typeface.wordmark, size: 34))
                .foregroundStyle(theme.scheme.accent)
                .frame(height: 38)
                .padding(.top, 14)
            Text("Big companies have sales teams.\nYou have this.")
                .font(.custom(Typeface.sansMedium, size: 15))
                .lineSpacing(4)
                .foregroundStyle(theme.scheme.textSecondary)
                .padding(.top, 6)

            appleButton.padding(.top, 28)
            googleButton.padding(.top, 10)

            divider.padding(.vertical, 20)

            LabeledField(label: "Email", placeholder: "you@example.com", text: $email, keyboard: .emailAddress)
                .textInputAutocapitalization(.never)
            SecureLabeledField(label: "Password", placeholder: "••••••••", text: $password)
                .padding(.top, 10)

            if let errorMessage {
                Text(errorMessage)
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.danger)
                    .padding(.top, 10)
            }

            PrimaryButton(label: primaryLabel) {
                Task { await submitCredentials() }
            }
            .disabled(isBusy || email.isEmpty || password.isEmpty)
            .opacity(email.isEmpty || password.isEmpty ? 0.5 : 1)
            .padding(.top, 16)

            Button(mode == .signIn ? "No account yet? Make one" : "Already have an account? Sign in") {
                mode = mode == .signIn ? .signUp : .signIn
                errorMessage = nil
            }
            .font(.custom(Typeface.sansSemiBold, size: 14))
            .foregroundStyle(theme.scheme.accent)
            .frame(maxWidth: .infinity)
            .padding(.top, 18)
        }
    }

    private var mark: some View {
        BrandMark(size: 52)
    }

    private var primaryLabel: String {
        if isBusy { return "One moment…" }
        return mode == .signIn ? "Sign in" : "Create account"
    }

    private var divider: some View {
        HStack(spacing: 12) {
            Rectangle().fill(theme.scheme.border).frame(height: 1)
            Text("or with email")
                .font(.custom(Typeface.sansMedium, size: 12))
                .foregroundStyle(theme.scheme.textSecondary)
                .fixedSize()
            Rectangle().fill(theme.scheme.border).frame(height: 1)
        }
    }

    // MARK: - Social

    private var appleButton: some View {
        Button {
            Task { await signInWithApple() }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "apple.logo")
                Text("Continue with Apple")
                    .font(.custom(Typeface.sansSemiBold, size: 16))
            }
            .foregroundStyle(theme.scheme.background)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(theme.scheme.text, in: RoundedRectangle(cornerRadius: Radius.inset, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(isBusy)
    }

    private var googleButton: some View {
        Button {
            Task { await signInWithGoogle() }
        } label: {
            Text("Continue with Google")
                .font(.custom(Typeface.sansSemiBold, size: 16))
                .foregroundStyle(theme.scheme.text)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(theme.scheme.backgroundElement, in: RoundedRectangle(cornerRadius: Radius.inset, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: Radius.inset, style: .continuous)
                        .strokeBorder(theme.scheme.border, lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
        .disabled(isBusy)
    }

    // MARK: - Verification

    private var verification: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Check your email")
                .font(.custom(Typeface.display, size: 28))
                .tracking(-0.5)
                .foregroundStyle(theme.scheme.text)
            Text("We sent a six-digit code to \(email).")
                .font(.custom(Typeface.sansMedium, size: 15))
                .foregroundStyle(theme.scheme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)

            TextField("123456", text: $code)
                .keyboardType(.numberPad)
                .font(.custom(Typeface.sansMedium, size: 22))
                .tracking(6)
                .foregroundStyle(theme.scheme.text)
                .padding(.horizontal, 14)
                .padding(.vertical, 14)
                .background(theme.scheme.backgroundElement)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(theme.scheme.border, lineWidth: 1)
                }
                .padding(.top, 24)

            if let errorMessage {
                Text(errorMessage)
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.danger)
                    .padding(.top, 10)
            }

            PrimaryButton(label: isBusy ? "Checking…" : "Verify") {
                Task { await verify() }
            }
            .disabled(isBusy || code.count < 6)
            .opacity(code.count < 6 ? 0.5 : 1)
            .padding(.top, 16)

            Button("Back") {
                step = .credentials
                code = ""
                errorMessage = nil
            }
            .font(.custom(Typeface.sansSemiBold, size: 14))
            .foregroundStyle(theme.scheme.textSecondary)
            .frame(maxWidth: .infinity)
            .padding(.top, 18)
        }
    }

    // MARK: - Actions

    private func submitCredentials() async {
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }

        do {
            if mode == .signIn {
                _ = try await Clerk.shared.auth.signInWithPassword(
                    identifier: email.trimmingCharacters(in: .whitespaces),
                    password: password
                )
            } else {
                let signUp = try await Clerk.shared.auth.signUp(
                    emailAddress: email.trimmingCharacters(in: .whitespaces),
                    password: password
                )
                pendingSignUp = try await signUp.sendEmailCode()
                step = .verify
            }
        } catch {
            errorMessage = Self.readable(error)
        }
    }

    private func verify() async {
        guard let pendingSignUp else { return }
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        do {
            _ = try await pendingSignUp.verifyEmailCode(code.trimmingCharacters(in: .whitespaces))
        } catch {
            errorMessage = Self.readable(error)
        }
    }

    private func signInWithApple() async {
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        do {
            _ = try await Clerk.shared.auth.signInWithApple()
        } catch {
            // A cancelled sheet is not a failure and should not shout.
            if !Self.isCancellation(error) { errorMessage = Self.readable(error) }
        }
    }

    private func signInWithGoogle() async {
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        do {
            _ = try await Clerk.shared.auth.signInWithOAuth(provider: .google)
        } catch {
            if !Self.isCancellation(error) { errorMessage = Self.readable(error) }
        }
    }

    /// Dismissing the Apple or Google sheet arrives here as an error. Treating
    /// it as one would put a red message on screen for somebody who simply
    /// changed their mind.
    private static func isCancellation(_ error: Error) -> Bool {
        if let authError = error as? ASAuthorizationError, authError.code == .canceled { return true }
        return (error as NSError).code == NSUserCancelledError
    }

    private static func readable(_ error: Error) -> String {
        let message = error.localizedDescription
        return message.isEmpty ? "That didn't work. Try again." : message
    }
}

/// A password field matching `LabeledField`'s styling.
struct SecureLabeledField: View {
    @Environment(\.theme) private var theme
    let label: String
    let placeholder: String
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.custom(Typeface.sansSemiBold, size: 12))
                .foregroundStyle(theme.scheme.textSecondary)
            SecureField(placeholder, text: $text)
                .font(.custom(Typeface.sansMedium, size: 15))
                .foregroundStyle(theme.scheme.text)
                .textContentType(.password)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(theme.scheme.backgroundSelected)
                .clipShape(RoundedRectangle(cornerRadius: Radius.field, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: Radius.field, style: .continuous)
                        .strokeBorder(theme.scheme.border, lineWidth: 1)
                }
        }
    }
}
