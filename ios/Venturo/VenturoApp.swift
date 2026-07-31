import ClerkKit
import SwiftUI

@main
struct VenturoApp: App {
    @State private var app: AppState

    init() {
        Clerk.configure(publishableKey: ClerkConfig.publishableKey)
        // The token provider is handed to the API client once, here, and is
        // asked for a fresh token on every request. Nothing else in the app
        // touches auth — screens ask the client, the client asks Clerk.
        _app = State(initialValue: AppState(api: APIClient(tokenProvider: ClerkTokenProvider())))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
                .environment(Clerk.shared)
        }
    }
}
