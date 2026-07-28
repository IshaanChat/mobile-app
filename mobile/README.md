# Venturo — iOS app (Expo)

The native client. Product decisions and the build plan live in
[DESIGN.md](DESIGN.md) — read that first; it is the spec.

## Running it

```bash
npm install
cp .env.example .env   # defaults hit the deployed Render API with real sign-in
npx expo start
```

Scan the QR code with the Expo Go app on an iPhone (same Wi-Fi), or press
`i` for the iOS simulator (macOS only).

Two useful configurations in `.env`:

- **Against production** (default): `EXPO_PUBLIC_API_URL` pointing at Render
  plus the Clerk publishable key. Real sign-in, real data. The free-tier API
  sleeps when idle — the first request can take ~1 minute.
- **Against a local server**: set `EXPO_PUBLIC_API_URL=http://<your LAN IP>:4000`
  (a phone cannot reach `localhost`) and leave the Clerk key empty. With no
  key the app skips sign-in and the API treats you as the development
  account — same dev mode as the web client.

## Layout

```
src/app/            expo-router routes
  _layout.tsx       providers: Clerk (optional) → token bridge → app data
  sign-in.tsx       Google SSO + email/password (Clerk)
  onboarding.tsx    the Hinge-style flow with the have/new fork
  (tabs)/           Home, Discover, Create, Growth, Business
src/api/client.ts   typed API surface (ported from client/src)
src/types/          shared types (ported verbatim from client/src)
src/state/          app-data context: onboarding/explorer/active modes
src/lib/            auth bridges, device prefs (AsyncStorage)
```

## Checks

```bash
npx tsc --noEmit                  # types
npx expo export --platform ios    # metro bundle — catches broken imports
```
