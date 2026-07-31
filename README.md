# Venturo

Walks somebody from "I want to start a business" to their first sale. It finds
them a product worth selling, shows where to source it, shows the communities
where their customers already are, and tracks the journey.

The audience is first-time founders — people who have not done this before and
feel out of their depth. Big companies have sales teams; this is meant to be
the alternative.

> Called **Sales Mechanic** until July 2026. The rename covers display text,
> docs and user-agents — not the Render service name, the bundle identifier,
> the package names or the repo, which are addresses.

**Start here: [HANDOFF.md](HANDOFF.md)** — the project as it actually stands.
This file is only how to run it.

## The four surfaces

| directory | what it is | status |
|---|---|---|
| `server/` | Express API, Prisma/Postgres, the content database, every script | live on Render |
| `ios/` | native SwiftUI client | **what ships** — never yet compiled |
| `server/scripts/preview-app.ts` | the HTML prototype | the design source of truth |
| `mobile/` | Expo / React Native | parked; kept as the API-contract spec |
| `client/` | the original React web app | superseded |

`ios/` is a complete Swift rewrite of `mobile/`. When it and the prototype
disagree, the prototype is right.

## Running it

Node 22. Everything below is from `server/`.

```bash
cd server && npm install
```

`server/.env` is **not in git** and nothing that touches the database works
without it. One required key, `DATABASE_URL` — a [Neon](https://neon.tech)
**direct** connection string, with *Connection pooling* off. `PEXELS_API_KEY`,
`ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET` and `CLERK_SECRET_KEY` are only
needed by the content scripts and by production auth.

```bash
npm run app:preview   # the prototype — http://localhost:4300
npm run dev           # the API — http://localhost:4000
```

The prototype is the fastest way to see the product. It reads the content JSON
directly, holds all its state in `localStorage`, and needs no database.

With no `CLERK_SECRET_KEY` set, the API signs every request in as the same
development account, so there is nothing to configure locally.

For the iOS app, see **[ios/SETUP.md](ios/SETUP.md)** — it needs a Mac, Xcode 26
and a one-time project generation.

### Two things that will catch you

- **`tsx` does not hot-reload.** Restart after every prototype change or you
  are looking at stale code.
- **Windows: stop the dev server before any Prisma migration.** Windows holds a
  lock on the query engine DLL and you get an opaque `EPERM` rename error.

## Testing

```bash
npm test          # 173 unit tests, well under a second
npm run smoke     # 56 endpoint checks; needs `npm run dev` in another terminal
```

`npm run smoke` creates a scratch business, exercises every endpoint including
the sale-and-stock loop and cross-account isolation, then deletes it. Safe to
run against a database with real data.

`npm run verify:deletion` proves account deletion removes everything.

## Content

`server/content/` is the source of truth for everything the feeds show — 886
products, 166 communities, 48 niches, 34 journey milestones, 50 tips — edited
as JSON, then pushed to Postgres with `npm run content:sync`.

Two rules it is built on: **nothing is invented** (an empty field beats a number
nobody can stand behind, which is why many products ship with empty evidence
blocks), and **nothing is scraped** — official APIs and manual research only.

Files prefixed with `_` are staging, not content. Loaders and importers skip
them.

## Docs

- **[HANDOFF.md](HANDOFF.md)** — what the project is, current and maintained
- **[SHIPPING.md](SHIPPING.md)** — Mac mini to App Store review, in order
- **[CLAUDE.md](CLAUDE.md)** — the short version an agent loads automatically
- [ios/SETUP.md](ios/SETUP.md) — the Xcode and dashboard steps
- [PRIVACY.md](PRIVACY.md) — published at `/privacy` on the live API

`ARCHITECTURE.md` and `TODO.md` predate the iOS app and describe `client/`.
