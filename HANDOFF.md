# Venturo — where things stand

A description of the project as it actually is, for picking up cold. Nothing
here is a plan or an instruction; it is a map.

*(Note: `README.md` and `ARCHITECTURE.md` still describe the older React web
client — Home / Clients / Sales / Missions tabs. That app still exists in
`client/` but is no longer where the work happens. This file is the current
one.)*

---

## What the app is

Venturo walks somebody from "I want to start a business" to their first sale.
It finds them a product worth selling, shows where to source it, shows the
communities where their customers already are, and tracks the journey.

It was called Sales Mechanic until recently. The rename covers display text,
docs and API user-agents. It deliberately does **not** cover the Render service
name, the EAS slug, the iOS bundle identifier, the package names or the repo
and directory names — those are addresses, and changing them breaks live
things. `render.yaml` still reads `sales-mechanic-api`, which is the actual
host both `.env` files point at.

## Where the work happens

The design surface is a localhost HTML prototype, not the Expo app:

```bash
cd ~/sales-mechanic/server && npm run app:preview     # http://localhost:4300
```

One TypeScript file — `server/scripts/preview-app.ts`, ~2,540 lines — serving a
self-contained page that reads the content JSON. It renders in seconds.

Two things about that file worth knowing before editing it:

- Roughly 1,700 of its lines sit **inside a single template literal** (the
  whole client: HTML, CSS and browser JS). A backtick anywhere in there —
  including inside a code comment — ends the string and breaks the build.
  `tsc --noEmit` does **not** catch it, because TypeScript does not parse
  inside template literals. Only starting the server does.
- `tsx` does not hot-reload. Any change needs the server restarted or you are
  looking at stale code.

## The three data tiers

They are separate and easy to confuse.

1. **`server/content/*.json`** — the curated content database, source of truth
   for everything the feeds show. Edited as JSON, then pushed to Postgres by
   the `*:import` scripts.
2. **Postgres (Neon)** via Prisma — the real database, 15 models, 4 migrations.
   Needs `DATABASE_URL` (Neon's direct, non-pooled URL) in `server/.env`.
3. **localStorage** — the prototype only. All prototype state (contacts, sales,
   journey progress, bookmarks) lives in the browser under `sm_app` and never
   touches the database. There is a "Reset everything" button in You → Settings.

## What is in the content database

| | count | where |
|---|---|---|
| Niches | 48 | `content/niches.json` |
| Products | **874** | `content/products/*.json` |
| — hand-curated | 176 | the 10 category files |
| — sourced from AliExpress | 698 | `content/products/discovered.json` |
| Communities | **166** | `content/communities/*.json` |
| Staged communities | 95 | `content/communities/_discovered.json` |
| Missions | 34 | `content/missions.json` |
| Playbooks | 5 | same file |

**Underscore-prefixed files are staging, not content.** `_discovered.json`
holds verified community candidates whose `audience`, `overview`, `loves`,
`dislikes` and `approach` are deliberately empty — they need writing by hand.
Both the preview loader and the importers skip `_`-prefixed files. They did not
always: 95 blank cards were rendering live in the Grow feed until that was
fixed.

The 698 sourced products all sit in a placeholder niche, `sourced-unsorted`.
They have not been sorted into the 48 real niches. That matters more than
"categorisation" suggests — criteria fit and Venturo fit are different axes,
and the criteria have no concept of what the app is for. A gun holster scores
excellently and does not belong.

## The tooling

All run from `server/`.

| command | port | what it is |
|---|---|---|
| `npm run app:preview` | 4300 | the prototype — the main surface |
| `npm run sourcing` | — | pull AliExpress feeds → score → write products |
| `npm run communities` | — | Reddit discovery + stats refresh |
| `npm run communities:verify` | — | check every community URL still resolves |
| `npm run growth:images` | — | fill community images from Pexels |
| `npm run ingest` | — | demand signals for existing products |
| `npm run research` | 4400 | manual bench for hand-logged ad research |
| `npm run niches:preview` | 4200 | review niche/product content |
| `npm run growth:preview` | 4100 | review community content |
| `npm run dev` | 4000 | the actual Express API |
| `npm test` / `npm run smoke` | — | 173 unit tests / 55 API checks |

## API access — what actually works

This took real time to establish; the short version:

- **AliExpress** — credentials are in `.env` and valid. The **`aliexpress.ds.*`
  (dropshipper) family works**. The **`aliexpress.affiliate.*` family is
  permanently denied** to this app: every affiliate method returns "App does
  not have permission", including with a `tracking_id` supplied. The permission
  set is the gate, not the parameters, so chasing a tracking ID achieves
  nothing. `sourcing.ts` uses `ds.recommend.feed.get`; the older
  `ingest/sources/aliexpress.ts` still targets the affiliate API and cannot work.
- **Printful** — v1 catalog is fully open, no key at all. v2 requires OAuth
  despite what several guides claim.
- **Pexels** — key is in `.env`, working.
- **Reddit** — needs a free self-serve "script" app at reddit.com/prefs/apps.
  Not configured. Anonymous JSON endpoints now 403; everything goes through
  `oauth.reddit.com`.
- **eBay** — adapter written, keys self-serve with no approval queue. Not
  configured.
- **Etsy, Meta, CJ** — adapters exist, unconfigured. Every adapter fails soft.

## The prototype's shape

Four tabs plus Journey, which is a top-bar button opening a bottom sheet.

- **Discover** — 874 product cards. Filter chips: Seller · Maker · Saved.
  Bookmarking removes a product from the browsing feed and moves it to Saved,
  so the feed shrinks as you triage. Cards carry `Hot` (top fifth by heat) and
  `High upside` badges; carrying both puts a card in its own top group.
  Sections are ordered with Sourced first.
- **Grow** — 166 community profiles. Ordering is: matched to your niche, then
  trend/research surfaces (Pinterest Trends, cottage food law), then the rest.
- **Business** — Overview · Clients · Money · Saved.
- **You** — Profile · Socials · Settings.
- **Journey** — 34 milestones across 5 sequentially-gated levels, plus 5
  playbooks below. Completing one shows a celebration with the points gained;
  the next-step prompt follows 3.5s later, after that has cleared.

Card image shapes are chosen from the image host, because host determines
aspect ratio and a `sourceName` can be edited: AliExpress/Printful → 5:4,
curated Pexels → 1200:627, community → 4:3.

## Known-open, not yet addressed

- **Heat is two different scales in one field.** Curated products carry
  machine-measured heat (8–55, largely Wikipedia readership); sourced products
  carry a criteria-fit score (78–97). They share `signals.heat`. Consequences:
  no curated product can ever earn the `Hot` badge, and the reseller heat floor
  of 40 cuts 75% of curated reseller rows while being inert on sourced ones.
- **~20 dead exports** in `criteria.ts`, `printful.ts` and `ebay.ts` — helpers
  exported "for testability" that nothing imports. `npx knip` lists them.
- **`preview-app.ts` at 2,540 lines**, most of it inside one template literal.
- **`origin` is 54 commits behind** — see below.
- Comment density in `scripts/ingest/` runs 30–50%, well above the 10.6%
  repo-wide average.

## Git and deploy

Two remotes on one working tree:

| remote | repo | state |
|---|---|---|
| `github-mobile` | `IshaanChat/mobile-app` | **current** — all work is here |
| `origin` | `IshaanChat/sales-mechanic` | 54 commits behind, deploys to Render |

The naming is inverted and confusing: the repo named after the project is the
stale one. `origin` is the Render deploy remote and has a standing rule against
pushing without an explicit go-ahead. Catching it up would be a 54-commit jump
including four Prisma migrations.

## Standing constraints

- No scraping. Official APIs and manual research only. (AliExpress was probed
  directly: one request succeeds, then every response is their
  `_____tmd_____/punish` anti-bot endpoint — served as HTTP 200, so a naive
  scraper records success and stores garbage.)
- Don't invent data. Empty fields beat numbers nobody can stand behind — which
  is why 188 products still ship with empty `research`/`signals` blocks and why
  staged communities have blank write-ups.
- Images free-licence only (Pexels), except supplier listing images on sourced
  products, which arrive with the affiliate arrangement.
- Type: Fraunces for single moments, Plus Jakarta Sans for anything repeated.
- Palette: warm artisan — blush cream `#fbf4f0`, dusty rose `#c2647e`; dark mode
  charcoal + gold `#e3a82b`.
