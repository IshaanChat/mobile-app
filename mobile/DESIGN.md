# Venturo — Mobile Design & Decisions

The iOS app is not a port of the web client's *design* — it ports the web
client's *features* into a different product shape. The web client is the
feature reference; this document is the design reference. Decisions here are
settled; don't re-litigate them per session.

## The feel

Closer to Instagram than a productivity app. Visual cards and feeds, not
tables and forms. Five bottom tabs, no labels:

| Tab | Icon idea | What it is |
|---|---|---|
| Home | house | The feed: network pulse, money, who's going quiet, activity — as scrollable cards. Stories-style missions row on top. |
| Discover | compass | **Free, for everyone.** A feed of product sources with viral potential — what you could sell, where it's blowing up. The hook *and* the tutorial. |
| Create (+) | plus | Quick actions: log a sale, add a client, log an interaction. |
| Growth | chart | **$5/month.** Finding online communities and customers to sell to — the web app's Discover engine lives here, behind the paywall. |
| Business | person | Profile, business settings, switcher, theme, sign out. |

## Onboarding (Hinge-feel)

Full-screen, one question at a time, big type, progress dots. Early in the
flow comes the fork that shapes everything:

- **"I already run a business"** → collect business basics (name, niche,
  what you sell, type) → profile + business created → land on Home.
- **"I'm trying to start one"** → collect interests (chips) → profile only,
  no business → land on **Discover** (explorer mode).

## Explorer mode (the new-founder path)

Browse-first: a profile with **no business** is a first-class state.

- Explorers live in Discover. They can browse everything free.
- Leveling up is gated on finding their product: a **starter mission funnel**
  (browse Discover → save ideas → commit to one → set up the business →
  first sale) guides them step by step. Completing "set up the business"
  creates the Business record, and the full app unlocks.
- v1: the starter funnel is client-side (fixed steps). The server's mission
  system stays business-scoped and untouched.

App state model everywhere: `no profile → onboarding`, `profile, no business
→ explorer`, `business exists → active`.

## Paywall (v1)

Growth is fully built but locked: a polished upgrade screen, no live billing.
Testers get unlocked manually during validation. Real billing (Stripe web
checkout vs Apple IAP) is decided *after* demand is proven. Do not add
StoreKit or Stripe SDKs yet.

## Discover content (v1)

Served by a **new server endpoint** (`/api/trends`, name TBD) following the
existing discover/ engine pattern: self-hosted LLM when configured, curated
builtin fallback otherwise. Personalized by the onboarding fork + interests
(explorers) or business type (owners). Server-side so the algorithm iterates
without app-store releases.

## Stack decisions

- **Expo SDK 56** (React 19, RN 0.85), TypeScript, expo-router. Started on
  SDK 57, but the App Store build of Expo Go for 57 was still in Apple's
  review queue, so a physical iPhone with the latest Expo Go couldn't run it.
  Downgraded to 56 for on-device testing. Revisit 57 once its Expo Go ships
  (or when we move to a dev/EAS build, which doesn't depend on Expo Go).
- **Auth: `@clerk/expo` v4** (peer `expo >=54 <58` — verified). Same Clerk
  instance as web; token cache via `expo-secure-store`. Like the web client,
  auth is opt-in: no `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` = dev mode against a
  local server.
- **Classic `Tabs` from expo-router**, not `unstable-native-tabs` — don't
  ship on an API that names itself unstable.
- API layer and types are ported nearly verbatim from `client/src`
  (`src/api/client.ts`, `src/types/index.ts`). Base URL from
  `EXPO_PUBLIC_API_URL`, default = the deployed Render API.
- Device prefs (active business, cooling-off days, interests) in
  AsyncStorage, mirroring the web's localStorage module.

## Build order

1. ✅ Scaffold, deps, ported data layer
2. Shell: tabs, theme, auth gate, Hinge onboarding with the fork
3. `/api/trends` endpoint (server) + Discover feed UI
4. Home feed + Create quick-log + Clients/Sales ports
5. Missions as stories row + starter funnel for explorers
6. Growth tab + lock screen
7. EAS build, TestFlight
