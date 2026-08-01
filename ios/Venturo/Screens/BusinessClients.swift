import SwiftUI

/// Clients: everyone you have spoken to, strongest relationship first.
///
/// That ordering is the whole point of the pane. A list sorted by when somebody
/// was added tells you about your filing; sorted by strength it tells you who
/// your business actually rests on.
struct BusinessClients: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app

    @State private var contacts: [Contact]?
    @State private var isAdding = false
    @State private var newName = ""
    @State private var newSource = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if app.activeBusiness == nil {
                ExplorerEmpty(
                    title: "No book yet",
                    body_: "Open a product in Discover and build a business around it. Your client book opens with it."
                )
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    addButton
                    if isAdding { addForm }
                    if let contacts {
                        if contacts.isEmpty { emptyState } else { statusCounts; list(contacts) }
                    } else {
                        ProgressView().tint(theme.scheme.accent)
                            .frame(maxWidth: .infinity).padding(.vertical, 40)
                    }
                }
                .padding(.top, 12)
            }
        }
        .task { if contacts == nil { await load() } }
    }

    private var addButton: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.18)) { isAdding.toggle() }
        } label: {
            HStack(spacing: 6) {
                Icon(name: isAdding ? .x : .plus, size: 16, color: theme.scheme.accent)
                Text(isAdding ? "Cancel" : "New client")
                    .font(.custom(Typeface.sansSemiBold, size: 14))
                    .foregroundStyle(theme.scheme.accent)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .background(theme.scheme.accentSoft, in: Capsule())
        }
        .buttonStyle(.plain)
    }

    private var addForm: some View {
        VStack(alignment: .leading, spacing: 10) {
            LabeledField(label: "Name", placeholder: "Who are they?", text: $newName)
            LabeledField(
                label: "Where did you find them?",
                placeholder: "A link, or leave blank if in person",
                text: $newSource
            )
            if let errorMessage {
                Text(errorMessage)
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.danger)
            }
            PrimaryButton(label: isSaving ? "Adding…" : "Add to my book") {
                Task { await add() }
            }
            .disabled(isSaving || newName.trimmingCharacters(in: .whitespaces).isEmpty)
            .opacity(newName.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)
        }
        .padding(14)
        .background(theme.scheme.backgroundElement)
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                .strokeBorder(theme.scheme.border, lineWidth: 1)
        }
    }

    private var emptyState: some View {
        Text("Nobody in the book yet. Add the first person who showed interest — not just the ones who bought.")
            .font(.custom(Typeface.sansMedium, size: 14))
            .foregroundStyle(theme.scheme.textSecondary)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 40)
    }

    private var statusCounts: some View {
        HStack(spacing: 8) {
            ForEach([ContactStatus.prospect, .engaged, .customer], id: \.self) { status in
                let count = (contacts ?? []).filter { $0.status == status.rawValue }.count
                HStack(spacing: 6) {
                    StatusDot(status: status.rawValue)
                    Text("\(count) \(status.label.lowercased())")
                        .font(.custom(Typeface.sansMedium, size: 12))
                        .foregroundStyle(theme.scheme.textSecondary)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(theme.scheme.backgroundSelected, in: Capsule())
            }
            Spacer(minLength: 0)
        }
    }

    private func list(_ contacts: [Contact]) -> some View {
        VStack(spacing: 10) {
            ForEach(contacts.sorted { $0.relationshipStrength > $1.relationshipStrength }) { contact in
                contactRow(contact)
            }
        }
    }

    private func contactRow(_ contact: Contact) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 9) {
                StatusDot(status: contact.status)
                VStack(alignment: .leading, spacing: 1) {
                    Text(contact.name)
                        .font(.custom(Typeface.sansSemiBold, size: 15))
                        .foregroundStyle(theme.scheme.text)
                    Text("\(ContactStatus(contact.status)?.label ?? "New lead") · \(Elapsed.quietLabel(contact.lastInteractionAt))")
                        .font(.custom(Typeface.sansMedium, size: 12))
                        .foregroundStyle(theme.scheme.textSecondary)
                }
                Spacer(minLength: 0)
                if contact.relationshipStrength > 0 {
                    Text("\(Int(contact.relationshipStrength.rounded()))")
                        .font(.custom(Typeface.sansBold, size: 15))
                        .monospacedDigit()
                        .foregroundStyle(theme.scheme.accent)
                }
            }
            Button {
                Task { await logTouch(contact) }
            } label: {
                Text("Log a touch")
                    .font(.custom(Typeface.sansSemiBold, size: 13))
                    .foregroundStyle(theme.scheme.text)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(theme.scheme.backgroundSelected, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(theme.scheme.backgroundElement)
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                .strokeBorder(theme.scheme.border, lineWidth: 1)
        }
        .cardElevation(theme)
    }

    // MARK: - Actions

    private func load() async {
        guard let business = app.activeBusiness else { return }
        contacts = (try? await app.store.getGraph(businessId: business.id))?.contacts ?? []
    }

    private func add() async {
        guard let business = app.activeBusiness else { return }
        let name = newName.trimmingCharacters(in: .whitespaces)
        let source = newSource.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }

        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        // The server needs one of sourceUrl or noLinkKind — every contact
        // belongs to a channel, and the channel has to come from somewhere.
        // A blank link means you met them in person, which is a real answer.
        let body = source.isEmpty
            ? CreateContact.inPerson(businessId: business.id, name: name)
            : CreateContact.fromLink(businessId: business.id, name: name, url: source)

        do {
            _ = try await app.store.createContact(body)
            newName = ""
            newSource = ""
            withAnimation { isAdding = false }
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func logTouch(_ contact: Contact) async {
        // The business type tunes the scoring weights, so it has to travel with
        // the interaction — a service business and a product seller read the
        // same touch differently.
        _ = try? await app.store.logInteraction(
            contactId: contact.id,
            type: "MESSAGE",
            businessType: app.activeBusiness?.businessType
        )
        await load()
    }
}

/// A labelled text field, matching the prototype's field styling.
struct LabeledField: View {
    @Environment(\.theme) private var theme
    let label: String
    let placeholder: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.custom(Typeface.sansSemiBold, size: 12))
                .foregroundStyle(theme.scheme.textSecondary)
            TextField(placeholder, text: $text)
                .font(.custom(Typeface.sansMedium, size: 15))
                .foregroundStyle(theme.scheme.text)
                .keyboardType(keyboard)
                .autocorrectionDisabled()
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
