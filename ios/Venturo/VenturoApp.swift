import SwiftUI

/// The app entry point.
///
/// Auth is not wired yet. Until Clerk is added, the client sends no token and
/// every `/api` call returns 401 against production — which is correct, not
/// broken: the server refuses to boot without `CLERK_SECRET_KEY`, so there is
/// no unauthenticated path to fall back on and nothing to accidentally leave
/// open.
///
/// To see real data before Clerk lands, run the API locally with the key unset
/// and point `baseURL` at it. That is the only configuration where the server
/// accepts an unauthenticated request, and it only ever runs on a laptop.
@main
struct VenturoApp: App {
    @State private var app: AppState

    init() {
        _app = State(initialValue: AppState(api: APIClient()))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
        }
    }
}
