import SwiftUI

/// Export and account deletion.
///
/// Both are App Store requirements rather than niceties — guideline 5.1.1(v)
/// requires an account-deletion path *inside* the app, not an email address to
/// write to — so they live in plain sight in Settings rather than behind a
/// support link.
struct AccountSection: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app

    @State private var exportedFile: URL?
    @State private var isExporting = false
    @State private var showDeleteConfirm = false
    @State private var isDeleting = false
    @State private var errorMessage: String?

    var body: some View {
        PanelCard(title: "Your data", icon: .lock) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Everything Venturo holds about you is yours to take or to destroy.")
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                Button { Task { await export() } } label: {
                    HStack(spacing: 6) {
                        Icon(name: .out, size: 16, color: theme.scheme.text)
                        Text(isExporting ? "Preparing…" : "Export my data")
                            .font(.custom(Typeface.sansSemiBold, size: 14))
                            .foregroundStyle(theme.scheme.text)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(theme.scheme.backgroundSelected, in: RoundedRectangle(cornerRadius: Radius.inset, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(isExporting)

                Button { showDeleteConfirm = true } label: {
                    Text(isDeleting ? "Deleting…" : "Delete my account")
                        .font(.custom(Typeface.sansSemiBold, size: 14))
                        .foregroundStyle(theme.scheme.danger)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(theme.scheme.danger.opacity(0.10), in: RoundedRectangle(cornerRadius: Radius.inset, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(isDeleting)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.custom(Typeface.sansMedium, size: 13))
                        .foregroundStyle(theme.scheme.danger)
                }
            }
        }
        .sheet(item: $exportedFile) { url in
            ShareSheet(items: [url])
        }
        // Deliberately blunt about what happens, and no "are you sure?" that
        // pretends to be reversible. There is no grace period and no archived
        // copy, so the confirmation should say exactly that.
        .alert("Delete your account?", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Delete everything", role: .destructive) { Task { await deleteAccount() } }
        } message: {
            Text("This removes your profile, businesses, clients, sales, products and progress, and your login. It happens immediately and cannot be undone.")
        }
    }

    private func export() async {
        isExporting = true
        errorMessage = nil
        defer { isExporting = false }
        do {
            let data = try await app.api.exportAccount()
            let name = "venturo-export-\(Self.stamp()).json"
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
            try data.write(to: url, options: .atomic)
            exportedFile = url
        } catch let error as APIError {
            errorMessage = error.message
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteAccount() async {
        isDeleting = true
        errorMessage = nil
        defer { isDeleting = false }
        do {
            try await app.api.deleteAccount()
            // Local state goes too. The server rows are gone, so anything still
            // cached here would be a ghost of an account that no longer exists.
            app.signedOut()
        } catch let error as APIError {
            errorMessage = error.message
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private static func stamp() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }
}

/// `sheet(item:)` needs Identifiable, and `URL` is not.
extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}

/// The system share sheet, so an export can go to Files, Mail, anywhere.
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
