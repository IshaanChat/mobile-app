# Sales Mechanic

A relationship-first sales and marketing app for solo sellers and first-time
founders — people running Etsy shops, home businesses, coaching practices.

Big companies have sales teams. This is meant to be the alternative: a coach
that tells you who needs a follow-up, where to find people who'd love what you
make, and what to do next — structured as missions you complete rather than a
spreadsheet you maintain.

> Status: working prototype, local-first, single user. Not yet deployed and
> has no authentication — see [TODO.md](TODO.md) for the path to shipping.

## What it does

- **Home** — a command centre: network pulse, money, stock, who's going quiet,
  recent activity, strongest relationships.
- **Clients** — a client book scored by relationship strength (recency,
  frequency, value). Paste someone's profile or shop link and the channel they
  came from is detected automatically.
- **Sales** — product catalog with optional stock tracking, plus payments.
  Recording a sale against a product decrements inventory automatically.
- **Discover** — finds real communities where a business's customers already
  gather. Uses a self-hosted LLM if one is configured, otherwise a curated
  built-in engine. Never scrapes anything.
- **Missions & Wisdom** — daily, weekly, monthly and one-time missions that
  teach how to grow a business, across a 100-level mastery ladder.
- **My Business** — profile, business details, socials, and settings.

## Stack

| | |
|---|---|
| Client | React 18, TypeScript, Vite |
| Server | Express 4, TypeScript, run with tsx |
| Database | SQLite via Prisma |
| Tests | vitest (unit), a Node script (smoke) |

No UI framework or component library — styling is plain CSS with custom
properties and two themes.

## Running it

Requires Node 20+ (developed on 24).

```bash
# 1. Server
cd server
npm install
cp .env.example .env          # then edit if you like
npx prisma migrate deploy     # creates prisma/dev.db
npm run dev                   # http://localhost:4000

# 2. Client, in a second terminal
cd client
npm install
npm run dev                   # http://localhost:5173
```

Open http://localhost:5173. On first run you'll be walked through creating a
profile and a business.

The Vite dev server proxies `/api` to port 4000, so the client is always
talking to the local server.

### Windows gotcha

Prisma cannot regenerate its client while the dev server is running — Windows
holds a lock on the query engine DLL and you'll get an `EPERM` rename error.
**Stop the server before running any migration**, then restart it.

## Testing

```bash
cd server
npm test          # unit tests: scoring profiles, mission period keys, levels
npm run smoke     # end-to-end: needs `npm run dev` running in another terminal
```

`npm run smoke` creates a scratch business named "SMOKE TEST — safe to
delete", exercises every endpoint including the full sale-and-stock loop, and
deletes it again. It is safe to run against a database with real data.

## Connecting your own AI (optional)

Discover works out of the box with a built-in recommendation engine. To get
recommendations tailored to a specific business, point it at any
OpenAI-compatible server you run yourself — Ollama, LM Studio, vLLM,
llama.cpp.

Easiest: **My Business → Settings → Your AI**, fill in the server URL and
model name, and press *Test connection*. Those values are stored in the
database and take precedence over the environment.

Alternatively set them in `server/.env`:

```
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5:7b
LLM_API_KEY=            # only if your server requires one
```

If the model is unreachable or returns something unparseable, Discover falls
back to the built-in engine rather than failing.

## Project layout

```
client/src/
  components/     one or more components per feature area
  api/client.ts   the single typed API surface
  types/          shared types
server/src/
  core/           event bus, HTTP error handling
  routes/         one file per feature
  modules/        cross-cutting subscribers (analytics)
  discover/       recommendation engines
  missions/       mission definitions and the Wisdom curve
  scoring.ts      relationship scoring profiles
server/prisma/    schema and migrations
```

Feature areas are deliberately decoupled: they talk to each other only through
the HTTP API and an internal event bus, never by importing each other's
internals. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Data and privacy

Everything lives in `server/prisma/dev.db` on your own machine. Nothing is
sent anywhere — including the analytics, which are recorded locally so the app
can show you your own history. If you configure an LLM, business context is
sent to whichever server you point at, which is why self-hosting is the
default assumption.

`dev.db` and `.env` are git-ignored. Do not commit them.

## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — module boundaries and the event bus
- [TODO.md](TODO.md) — the plan for hardening and shipping
