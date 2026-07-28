# Venturo — Architecture

A relationship-first sales & marketing app for solo founders. Local-first:
one user, their machine, their data.

## Stack

- **Client**: React 18 + TypeScript + Vite (`client/`)
- **Server**: Express + TypeScript (`server/`), run with tsx
- **Database**: SQLite via Prisma (`server/prisma/schema.prisma`)

## Design principle: decoupled aspects

Each aspect of the product is a **feature module** that can be developed and
replaced independently. Modules communicate through two seams only:

1. **HTTP API** — the client talks to features via `/api/<feature>` routes.
2. **Event bus** (`server/src/core/events.ts`) — when something meaningful
   happens, a feature *publishes* an event. Modules that care *subscribe*.
   Features never import each other's internals.

```
client/src/components/<Feature>*.tsx      UI per aspect
client/src/api/client.ts                  single typed API surface
client/src/types/index.ts                 shared client types

server/src/core/auth.ts                   identity + ownership checks
server/src/core/events.ts                 typed pub/sub bus (the seam)
server/src/modules/analytics/             subscriber: persists AppEvents
server/src/routes/<feature>.ts            HTTP surface per aspect
server/src/discover/                      recommendation engines (LLM + builtin)
server/src/missions/                      mission definitions + level curve
server/src/scoring.ts                     relationship scoring profiles
```

## The aspects

| Aspect | Server | Client | Notes |
|---|---|---|---|
| Identity | `routes/profile.ts` | Onboarding, BusinessTab | user profile (required + optional fields) |
| Businesses | `routes/business.ts` | BusinessTab | multi-business; type, avenues, targeting |
| Clients (CRM) | `routes/contacts.ts`, `scoring.ts` | ContactsTab, ContactPanel, AddContactModal | URL→channel detection; type-aware scoring |
| Channels | `routes/channels.ts` | (derived; filter UI) | auto-created from pasted links |
| Activity | `routes/interactions.ts` | ActivityTab | feed inside Clients tab |
| Discover | `routes/discover.ts`, `discover/` | DiscoverTab | self-hosted LLM w/ builtin fallback |
| Missions | `routes/missions.ts`, `missions/` | MissionsSidebar, MissionsPage | cadences (daily/weekly/monthly/once), Wisdom, 100 levels |
| Finances | `routes/payments.ts` | FinancesTab | manual payments + insights |
| Socials | `routes/socials.ts` | BusinessTab section | per-platform links, feed Discover |
| Settings | `routes/settings.ts` | BusinessTab sections | LLM connection (DB-stored), theme, thresholds |
| Analytics | `modules/analytics/` | (none yet) | subscribes to bus, writes `AppEvent` |
| Starter Toolkit | (static content) | StarterToolkit | what-to-sell explorer for new founders |

## Event bus contract

Publish with `emitEvent(type, { businessId?, payload? })`. Current event
types are enumerated in `core/events.ts` (`AppEventType`). Adding a new
consumer = one `onEvent(handler)` call at startup; no existing code changes.

Events currently emitted: profile.created/updated, business.created/updated/
deleted, contact.created, contact.status_changed, interaction.logged,
payment.recorded, mission.completed, discover.generated, socials.saved.

All events are persisted locally to the `AppEvent` table by the analytics
module — inspect via `GET /api/analytics?businessId=`.

## Accounts and data isolation

Every row that matters hangs off a `User`. `Business.userId` is the root of
ownership; contacts, channels, products, payments and interactions are
reached through their business.

`core/auth.ts` has two modes, chosen by whether `CLERK_SECRET_KEY` is set:

- **dev** — no auth provider required. The caller is identified by an
  `x-dev-user` header (default `dev`), and the `User` row is created on
  demand. Local development needs no keys, and the smoke test uses this to
  simulate two accounts.
- **prod** — verifies a Clerk session token from `Authorization: Bearer`.

Routes never branch on the mode; they read `req.userId`. Swapping auth
providers is a one-file change.

**Rules for any new route:**

1. Call `assertOwnsBusiness(req.userId, businessId)` before touching
   anything scoped to a business. It throws a 404 — deliberately, so the
   API never confirms an id exists to someone who guessed it.
2. For child resources, scope through the parent rather than trusting an
   id: `where: { id, business: { userId: req.userId } }`.
3. Add an isolation case to `scripts/smoke.mjs`. The suite already proves a
   second account is refused on every existing path.

## Personalization by business type

`Business.businessType` ∈ PRODUCT_SALES | SERVICE | KNOWLEDGE | OTHER.

- **Scoring** (`scoring.ts`): per-type weight profiles. Products lean on
  value+frequency; services lean on recency with a slower decay (long
  cycles); knowledge leans on frequency (trust through repeated touches).
- **Discover**: the type is described to the self-hosted LLM, and tilts the
  builtin engine's token matching toward type-appropriate communities.

## Conventions

- SQLite has no enums — enum-like fields are validated strings; allowed
  values are documented in the schema and enforced in routes.
- Migrations require the dev server stopped (Windows locks the query engine
  DLL).
- "XP" is called **Wisdom** in all user-facing copy; the API keeps `xp`
  field names for stability.
- Repeatable missions key completions on `periodKey` (daily `YYYY-MM-DD`,
  weekly `YYYY-Www`, monthly `YYYY-MM`, one-time `once`).
