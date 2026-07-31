# Venturo — where things stand

A description of the project as it actually is, for picking up cold. Nothing
here is a plan or an instruction; it is a map.

*(Note: `README.md` and `ARCHITECTURE.md` still describe the older React web
client — Home / Clients / Sales / Missions tabs. That app still exists in
`client/` but is no longer where the work happens. This file is the current
one.)*

Two companions to this file: **`SHIPPING.md`** is the ordered runbook from a
fresh Mac to a submitted app, and **`CLAUDE.md`** is the short version an agent
loads automatically.

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

## The four codebases

Knowing which is which saves the most time of anything in this file.

| directory | what it is | status |
|---|---|---|
| `server/` | Express API, Prisma/Postgres, the content database, and every script | live, deployed to Render |
| `ios/` | **native SwiftUI app** | the shipping client, ~7,000 lines, never compiled — see below |
| `server/scripts/preview-app.ts` | the HTML prototype | the design source of truth |
| `mobile/` | the Expo/React Native app | parked. Kept as the written spec for the API contract; neither built nor shipped |
| `client/` | the original React web app | superseded. A *feature* reference — which screens and endpoints exist — never a design reference |

When the iOS app and the prototype disagree, **the prototype is right**. When
the prototype and `client/` disagree, the prototype is right. `client/` silently
reproduces the old product's structure if you follow it.

## The prototype

```bash
cd ~/sales-mechanic/server && npm run app:preview     # http://localhost:4300
```

One TypeScript file — `server/scripts/preview-app.ts`, ~2,730 lines — serving a
self-contained page that reads the content JSON. It renders in seconds, which
is the whole point: you react to a real thing rather than to a description.

Two things about that file worth knowing before editing it:

- Roughly 1,700 of its lines sit **inside a single template literal** (the
  whole client: HTML, CSS and browser JS). A backtick anywhere in there —
  including inside a code comment — ends the string and breaks the build.
  `tsc --noEmit` does **not** catch it, because TypeScript does not parse
  inside template literals. Only starting the server does.
- `tsx` does not hot-reload. Any change needs the server restarted or you are
  looking at stale code.

## The iOS app

Built 30–31 July, in `ios/Venturo/` — 21 Swift files, ~7,000 lines, SwiftUI,
minimum deployment iOS 17. It is a port of the prototype, not a new design.

**Nothing here has ever been compiled.** There is no `.xcodeproj` in the repo,
because a hand-written `project.pbxproj` is not worth the risk — Xcode has to
generate it once, on a Mac. Everything around it is already in place. Expect
the first build to surface ordinary compile errors that no amount of reading
would have caught.

`ios/SETUP.md` is the list of steps that can only be done in Xcode or a
dashboard: creating the project, adding the Clerk SDK (`ClerkKit` only,
requires **Xcode 26 / Swift 6.2**), registering the seven fonts, the app icon,
the Sign in with Apple entitlement, and the Clerk dashboard's *Native
applications* entry — that last one fails **silently** and is the usual cause
of Sign in with Apple hanging.

What is in it:

- `DesignSystem/` — `Theme.swift` (palette, type ramp, spacing), `Icon.swift`
  and `SVGPath.swift` (the icon set, ported by parsing the SVG paths rather
  than retyping them).
- `Networking/APIClient.swift` — all 20 endpoints. `ClerkAuth.swift` for auth.
- `Screens/` — onboarding, sign-in, the four tabs, the Journey sheet, the
  commit sheet (an explorer turning a product into a business), and
  `Celebration.swift` (the win, the level-up, the nudge).
- `Models/AppState.swift` — the app's five states: loading, error, onboarding,
  explorer, active.

Conventions that will bite if ignored: colour comes from
`@Environment(\.theme)` and never from a literal — the accent is deliberately
two different purples, because the light one measures 1.64:1 on the light
background. Type comes from `TextStyle` and never pairs a custom family with
`.fontWeight()`; each weight is a separately registered family.

Four API shapes that will crash a naive Swift client are documented in
`ios/README.md` — fractional-second dates, `GET /profile` returning literal
`null` with a 200, the 204-empty unsave, and Clerk tokens expiring in ~60s.

The Clerk publishable key in `ClerkAuth.swift` is a **development instance**
(`pk_test_…`). It must not ship, and a production instance is a different key
*and a different user pool*.

## The three data tiers

They are separate and easy to confuse.

1. **`server/content/*.json`** — the curated content database, source of truth
   for everything the feeds show. Edited as JSON, then pushed to Postgres by
   the `*:import` scripts (`npm run content:sync` runs all four).
2. **Postgres (Neon)** via Prisma — the real database, 15 models, 4 migrations.
   Needs `DATABASE_URL` (Neon's direct, non-pooled URL) in `server/.env`.
3. **localStorage** — the prototype only. All prototype state (contacts, sales,
   journey progress, bookmarks) lives in the browser under `sm_app` and never
   touches the database. There is a "Reset everything" button in You → Settings.

## What is in the content database

| | count | where |
|---|---|---|
| Niches | 48 | `content/niches.json` |
| Products | **886** | `content/products/*.json` |
| — hand-curated | 188 | the 10 category files |
| — sourced from AliExpress | 698 | `content/products/discovered.json` |
| Communities | **166** | `content/communities/*.json` |
| Staged communities | 95 | `content/communities/_discovered.json` |
| Milestones | 34 across 5 levels | `content/missions.json` |
| Playbooks | 5 | same file |
| Tips | 50 | `content/tips.json` |

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

`content/tips.json` is also the **voice reference**. The app's own copy —
subtitles, empty states, toasts, milestone titles, onboarding questions,
celebrations — is written in that register: plain, short, second person, dry
humour that undercuts rather than cheerleads, warmth stated flatly. The product
and community write-ups are research and stay factual.

## The tooling

All run from `server/`.

| command | port | what it is |
|---|---|---|
| `npm run app:preview` | 4300 | the prototype — the design surface |
| `npm run dev` | 4000 | the actual Express API |
| `npm run sourcing` | — | pull AliExpress feeds → score → write products |
| `npm run communities` | — | Reddit discovery + stats refresh |
| `npm run communities:verify` | — | check every community URL still resolves |
| `npm run growth:images` | — | fill community images from Pexels |
| `npm run ingest` | — | demand signals for existing products |
| `npm run content:sync` | — | catalog + communities + tips + journey → Postgres |
| `npm run content:check` | — | the same, dry-run |
| `npm run verify:deletion` | — | proves account deletion removes everything |
| `npm run research` | 4400 | manual bench for hand-logged ad research |
| `npm run niches:preview` | 4200 | review niche/product content |
| `npm run growth:preview` | 4100 | review community content |
| `npm test` / `npm run smoke` | — | 173 unit tests (12 files) / 56 API checks |

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
  `oauth.reddit.com`. Verification must use `old.reddit.com`, which 404s
  honestly — `www.reddit.com` serves logged-out requests an identical HTTP 200
  interstitial for real and non-existent subreddits.
- **eBay** — adapter written, keys self-serve with no approval queue. Not
  configured.
- **Etsy, Meta, CJ** — adapters exist, unconfigured. Every adapter fails soft.
- **X** — API is paywalled with no free read tier. X Communities themselves are
  alive and usable as content.

## The shape of the product

Four tabs plus Journey, which is a top-bar button opening a bottom sheet. Same
in the prototype and in the iOS app.

- **Discover** — the front door, and for an explorer their whole home screen.
  886 product cards grouped into shelves. Filter chips: Seller · Maker · Saved.
  Bookmarking removes a product from the browsing feed and moves it to Saved,
  so the feed shrinks as you triage. Cards carry `Hot` (top fifth by heat) and
  `High upside` badges; carrying both puts a card in its own top group.
  Sections are ordered with Sourced first.
- **Grow** — 166 community profiles. Ordering is: matched to your niche, then
  trend/research surfaces (Pinterest Trends, cottage food law), then the rest.
- **Business** — Overview · Clients · Money · Saved.
- **You** — Profile · Socials · Settings, plus account export and deletion.
- **Journey** — 34 milestones across 5 sequentially-gated levels, plus 5
  playbooks below. Completing one shows a celebration with the points gained;
  the next-step prompt follows 3.5s later, after that has cleared.

An **explorer** is someone with a profile but no business. They leave explorer
mode by committing to a product from Discover, which opens the commit sheet and
creates the business.

Card image shapes are chosen from the image host, because host determines
aspect ratio and a `sourceName` can be edited: AliExpress/Printful → 5:4,
curated Pexels → 1200:627, community → 4:3.

## Known-open, not yet addressed

- **The iOS app has never been compiled.** No `.xcodeproj`; everything in
  `ios/SETUP.md` is still to do, on a Mac with Xcode 26.
- **Heat is two different scales in one field.** Curated products carry
  machine-measured heat (8–55, largely Wikipedia readership); sourced products
  carry a criteria-fit score (78–97). They share `signals.heat`. Consequences:
  no curated product can ever earn the `Hot` badge, and the reseller heat floor
  of 40 cuts 75% of curated reseller rows while being inert on sourced ones.
- **698 sourced products are unsorted**, sitting in `sourced-unsorted`.
- **`tier` never leaves the content files.** 698 sourced products carry
  `tier` (528 `proven`, 170 `upside`), and the prototype's `High upside` badge
  and its strongest feed shelf — cards that are Hot *and* upside — are built on
  it. The field is in neither `schema.prisma` nor `toDiscoverProduct`, so the
  iOS app cannot see it and orders Discover on heat alone. Closing it is a
  schema field, an importer line, a serializer line, a Swift badge, and a
  migration — which means a Render deploy.
- **95 staged communities have blank write-ups** and are invisible until written.
- **The Clerk key is a development instance.** Different key *and* different
  user pool in production, so switch early enough to test it.
- **The support page is written but not deployed**, and still carries a
  placeholder email. App Store Connect requires a Support URL. Deploying it
  means pushing `origin`.
- **~20 dead exports** in `criteria.ts`, `printful.ts` and `ebay.ts` — helpers
  exported "for testability" that nothing imports. `npx knip` lists them.
- **`preview-app.ts` at ~2,730 lines**, most of it inside one template literal.
- Comment density in `scripts/ingest/` runs 30–50%, well above the 10.6%
  repo-wide average.
- `README.md` and `ARCHITECTURE.md` are still about `client/`.

## Git and deploy

Two remotes on one working tree, 88 commits, `main`:

| remote | repo | state |
|---|---|---|
| `github-mobile` | `IshaanChat/mobile-app` | **current** — everything is pushed here |
| `origin` | `IshaanChat/sales-mechanic` | 2 commits behind, deploys to Render |

The naming is inverted and confusing: the repo named after the project is the
deploy remote, not the working one. `origin` was 54 commits behind for a while
and has since been caught up to within two — the phone cannot see new backend
content until `origin` is deployed, which is what forces the catch-up.

**The standing rule still holds: do not push `origin` / trigger a Render deploy
without an explicit go-ahead.** Pushing to `github-mobile` is free.

## Standing constraints

- No scraping. Official APIs and manual research only. (AliExpress was probed
  directly: one request succeeds, then every response is their
  `_____tmd_____/punish` anti-bot endpoint — served as HTTP 200, so a naive
  scraper records success and stores garbage.)
- Don't invent data. Empty fields beat numbers nobody can stand behind — which
  is why 188 products still ship with empty `research`/`signals` blocks and why
  staged communities have blank write-ups.
- Images free-licence only (Pexels), except supplier listing images on sourced
  products, which arrive with the affiliate arrangement. Photographers are
  credited.
- Type: Fraunces for single moments, Plus Jakarta Sans for anything repeated.
- Palette: warm artisan — blush cream `#fbf4f0`, dusty rose `#c2647e`; dark mode
  charcoal + gold `#e3a82b`. In the iOS app the accent is `#6E4EAB` light /
  `#D0B8F0` dark.
- Free Render tier cold-starts in ~30s. Any client needs a timeout well above
  60s and waking-up copy.
