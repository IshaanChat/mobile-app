import SwiftUI

/// Money: what came in, and what is on the shelf.
struct BusinessMoney: View {
    @Environment(\.theme) private var theme
    @Environment(AppState.self) private var app

    @State private var payments: PaymentsPayload?
    @State private var shelf: ProductsPayload?
    @State private var isRecording = false
    @State private var amount = ""
    @State private var note = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if app.activeBusiness == nil {
                ExplorerEmpty(
                    title: "No money yet, and that is fine",
                    body_: "Build a business around something in Discover first. This fills in from your first sale — everything before that is preparation."
                )
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    stats
                    recordCard
                    recentSales
                    shelfCard
                }
                .padding(.top, 12)
            }
        }
        .task { if payments == nil { await load() } }
    }

    private var stats: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            StatCard(
                value: Money.short(payments?.summary.thisMonth ?? 0),
                label: "this month", tint: theme.scheme.customer
            )
            StatCard(
                value: Money.short(payments?.summary.total ?? 0),
                label: "all time", tint: theme.scheme.customer
            )
        }
    }

    private var recordCard: some View {
        PanelCard(title: "Record a sale", icon: .note) {
            if isRecording {
                VStack(alignment: .leading, spacing: 10) {
                    LabeledField(label: "Amount", placeholder: "0.00", text: $amount, keyboard: .decimalPad)
                    LabeledField(label: "What was it?", placeholder: "e.g. two mugs (optional)", text: $note)
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.custom(Typeface.sansMedium, size: 13))
                            .foregroundStyle(theme.scheme.danger)
                    }
                    PrimaryButton(label: isSaving ? "Saving…" : "Record it") {
                        Task { await record() }
                    }
                    .disabled(isSaving)
                }
            } else {
                Button {
                    withAnimation(.easeInOut(duration: 0.18)) { isRecording = true }
                } label: {
                    HStack(spacing: 6) {
                        Icon(name: .plus, size: 16, color: theme.scheme.accent)
                        Text("Somebody paid you")
                            .font(.custom(Typeface.sansSemiBold, size: 14))
                            .foregroundStyle(theme.scheme.accent)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder private var recentSales: some View {
        let sales = Array((payments?.payments ?? []).prefix(10))
        PanelCard(title: "Recent sales", icon: .chart) {
            if sales.isEmpty {
                Text("Nothing yet. The first one feels vaguely illegal — it isn't.")
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(spacing: 0) {
                    ForEach(sales) { payment in
                        HStack(spacing: 9) {
                            VStack(alignment: .leading, spacing: 1) {
                                // Whatever was written, else the product, else
                                // just "Sale" — never a blank row.
                                Text(payment.note ?? payment.product?.name ?? "Sale")
                                    .font(.custom(Typeface.sansMedium, size: 14))
                                    .foregroundStyle(theme.scheme.text)
                                if let contact = payment.contact {
                                    Text(contact.name)
                                        .font(.custom(Typeface.sansMedium, size: 12))
                                        .foregroundStyle(theme.scheme.textSecondary)
                                }
                            }
                            Spacer(minLength: 0)
                            Text(Money.short(payment.amount))
                                .font(.custom(Typeface.sansBold, size: 15))
                                .monospacedDigit()
                                .foregroundStyle(theme.scheme.customer)
                        }
                        .padding(.vertical, 9)
                        if payment.id != sales.last?.id {
                            Rectangle().fill(theme.scheme.border).frame(height: 1)
                        }
                    }
                }
                if let best = payments?.summary.topClient {
                    Text("Best customer: \(best.name), \(Money.short(best.total))")
                        .font(.custom(Typeface.sansMedium, size: 12))
                        .foregroundStyle(theme.scheme.textSecondary)
                        .padding(.top, 4)
                }
            }
        }
    }

    @ViewBuilder private var shelfCard: some View {
        let products = shelf?.products ?? []
        PanelCard(title: "The shelf", icon: .tag) {
            if products.isEmpty {
                Text("Nothing listed yet.")
                    .font(.custom(Typeface.sansMedium, size: 13))
                    .foregroundStyle(theme.scheme.textSecondary)
            } else {
                VStack(spacing: 0) {
                    ForEach(products) { product in
                        HStack(spacing: 9) {
                            Text(product.name)
                                .font(.custom(Typeface.sansMedium, size: 14))
                                .foregroundStyle(theme.scheme.text)
                            Spacer(minLength: 0)
                            VStack(alignment: .trailing, spacing: 1) {
                                if let price = product.price {
                                    Text(Money.short(price))
                                        .font(.custom(Typeface.sansSemiBold, size: 14))
                                        .monospacedDigit()
                                        .foregroundStyle(theme.scheme.text)
                                }
                                // A null stock means "not tracked", which is
                                // not the same as zero — showing 0 would imply
                                // sold out and be a lie.
                                Text(product.stock.map { "\($0) in stock" } ?? "stock not tracked")
                                    .font(.custom(Typeface.sansMedium, size: 12))
                                    .foregroundStyle(theme.scheme.textSecondary)
                            }
                        }
                        .padding(.vertical, 9)
                        if product.id != products.last?.id {
                            Rectangle().fill(theme.scheme.border).frame(height: 1)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Actions

    private func load() async {
        guard let business = app.activeBusiness else { return }
        async let paymentsResult = try? app.store.getPayments(businessId: business.id)
        async let shelfResult = try? app.store.getShelf(businessId: business.id)
        payments = await paymentsResult
        shelf = await shelfResult
    }

    private func record() async {
        guard let business = app.activeBusiness else { return }
        // Accept "12", "12.50", "$12.50" — somebody typing a sale in should not
        // have to think about the format.
        let cleaned = amount.replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: ",", with: "")
            .trimmingCharacters(in: .whitespaces)
        guard let value = Double(cleaned), value > 0 else {
            errorMessage = "How much was it?"
            return
        }

        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        let trimmedNote = note.trimmingCharacters(in: .whitespaces)
        do {
            _ = try await app.store.createPayment(
                CreatePayment(
                    businessId: business.id,
                    amount: value,
                    note: trimmedNote.isEmpty ? nil : trimmedNote
                )
            )
            amount = ""
            note = ""
            withAnimation { isRecording = false }
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
