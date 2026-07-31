import SwiftUI

/// Turning a product you liked into a business.
///
/// This is the step that was missing. An explorer — somebody with a profile and
/// no business — is the *primary* new-user path, and until now there was no way
/// out of it: `createBusiness` was reachable only from the "I already have a
/// business" branch of onboarding, while the You tab promised that committing
/// to a product in Discover would set one up. It said so and it could not.
///
/// Deliberately one question. The niche comes from the product, the description
/// is seeded from it, and everything else can be edited later in You. Asking
/// somebody to fill a form at the moment they first feel like doing this is how
/// you lose them — the point is to get them across the line, not to collect
/// data.
struct CommitSheet: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss

    let product: DiscoverProduct

    @State private var name = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    @FocusState private var nameFocused: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Name it, and it exists")
                        .font(.custom(Typeface.display, size: 28))
                        .tracking(-0.5)
                        .foregroundStyle(theme.scheme.text)
                        .fixedSize(horizontal: false, vertical: true)

                    Text("A name you can say out loud without wincing. It doesn't have to be clever, and you can change it later.")
                        .font(.custom(Typeface.sansMedium, size: 15))
                        .lineSpacing(5)
                        .foregroundStyle(theme.scheme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 8)

                    TextField("Your business name", text: $name)
                        .focused($nameFocused)
                        .font(.custom(Typeface.sansMedium, size: 18))
                        .foregroundStyle(theme.scheme.text)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 13)
                        .background(theme.scheme.backgroundElement)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .strokeBorder(theme.scheme.border, lineWidth: 1)
                        }
                        .padding(.top, 22)

                    // What they are committing to, restated. The tap happened on
                    // a card that has since been covered by this sheet, and
                    // "which one was that again?" is a bad thing to wonder at
                    // the moment you are naming a company.
                    seeded.padding(.top, 16)

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.custom(Typeface.sansMedium, size: 13))
                            .foregroundStyle(theme.scheme.danger)
                            .padding(.top, 12)
                    }

                    PrimaryButton(label: isSaving ? "Setting it up…" : "Start my business") {
                        Task { await commit() }
                    }
                    .disabled(isSaving || trimmedName.isEmpty)
                    .opacity(trimmedName.isEmpty ? 0.5 : 1)
                    .padding(.top, 20)

                    Text("Nothing is locked in. You can rename it, change what you sell, or start another one.")
                        .font(.custom(Typeface.sansMedium, size: 12))
                        .foregroundStyle(theme.scheme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 12)
                }
                .padding(.horizontal, 24)
                .padding(.top, 12)
                .padding(.bottom, 32)
            }
            .background(theme.scheme.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Not yet") { dismiss() }
                        .font(.custom(Typeface.sansSemiBold, size: 14))
                        .foregroundStyle(theme.scheme.textSecondary)
                }
            }
        }
        .onAppear { nameFocused = true }
    }

    private var seeded: some View {
        MiniBlock {
            HStack(alignment: .top, spacing: 12) {
                if let raw = product.imageUrl, let url = URL(string: raw) {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image { image.resizable().scaledToFill() }
                        else { theme.scheme.accentSoft }
                    }
                    .frame(width: 48, height: 48)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("BUILT AROUND")
                        .font(.custom(Typeface.sansBold, size: 10))
                        .tracking(0.8)
                        .foregroundStyle(theme.scheme.textSecondary)
                    Text(product.title)
                        .font(.custom(Typeface.sansSemiBold, size: 14))
                        .foregroundStyle(theme.scheme.text)
                        .lineLimit(2)
                    if let niche = product.niche {
                        Text(niche.name)
                            .font(.custom(Typeface.sansMedium, size: 12))
                            .foregroundStyle(theme.scheme.textSecondary)
                    }
                }
                Spacer(minLength: 0)
            }
        }
    }

    private var trimmedName: String {
        name.trimmingCharacters(in: .whitespaces)
    }

    private func commit() async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let business = try await app.api.createBusiness(
                CreateBusiness(
                    name: trimmedName,
                    // Seeded from the product rather than asked for. Both are
                    // required by the server and both are editable in You, so
                    // a second and third question here would buy nothing.
                    niche: product.niche?.name ?? product.category,
                    description: product.blurb,
                    businessType: nil
                )
            )
            // Flips the app from explorer to active. Grow, Clients, Money and
            // the rest of Journey all open up on this one call.
            app.businessCreated(business)
            dismiss()
        } catch let error as APIError {
            errorMessage = error.message
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
