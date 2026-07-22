// Clerk configuration for the native app.
//
// Auth is opt-in, mirroring the web client: with no publishable key set the
// app renders straight through and the API treats every call as the shared
// development account (useful for local UI work against a dev server). Set
// EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to require real sign-in.
export const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

export const CLERK_ENABLED = CLERK_PUBLISHABLE_KEY.length > 0;
