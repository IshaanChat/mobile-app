# Content

This folder is the curator's workspace, and it is the source of truth. These
files are edited by hand, then pushed into your database. The app reads only
the database — it never reads this folder — so **nothing you write here is live
until you sync it**.

## What lives where

| File | Holds | Importer | In the database? |
|---|---|---|---|
| `niches.json` | 48 categories | `catalog:import` | yes — `Niche` |
| `products/*.json` | 886 products | `catalog:import` | yes — `TrendProduct` |
| `communities/*.json` | 166 communities | `growth:import` | yes — `CommunityPost` |
| `tips.json` | 50 tips | `tips:import` | yes — `Tip` |
| `missions.json` | 34 milestones, 5 levels, 5 playbooks | — | **no** |
| `onboarding.json` | the onboarding script | — | **no** |

The last two have no model, no importer and no endpoint. They are read only by
the localhost prototype (`npm run app:preview`). Until that changes, editing
them changes the prototype and nothing else.

## Updating your database

One command does everything, in dependency order — products reference a niche,
so niches load first:

```bash
npm run content:sync
```

Check your edits before they land. This validates every file and writes
nothing:

```bash
npm run content:check
```

Every importer follows the same contract:

- **Upsert by slug.** Re-importing updates in place, so you can polish copy
  freely without creating duplicates.
- **Nothing is ever deleted.** Removing an entry from a file leaves the row
  alone.
- **`--archive-missing` makes the files authoritative.** Anything active in the
  database but absent from the files gets archived. Archived rows leave
  everyone's feed but stay on the shelves of users who saved them.

```bash
npm run growth:import -- --archive-missing
```

## Two conventions worth knowing

**Underscore-prefixed files are staging, not content.** `_discovered.json`
holds verified candidates whose write-ups are deliberately empty, awaiting a
human. Every loader and importer skips them. They did not always: 95 blank
cards once rendered live in the Grow feed, which is what the convention exists
to prevent.

**Empty beats invented.** A missing field is honest; a plausible number nobody
can stand behind is not. That is why some products ship with empty `research`
and `signals` blocks rather than estimates.

## Adding one thing

- **A product** — append to the right file in `products/`. `nicheSlug` must
  match a slug in `niches.json`, or the importer rejects it rather than
  silently dropping the row.
- **A community** — append to the niche file in `communities/`. All fourteen
  text fields are required; the importer names the file and index of anything
  incomplete.
- **A tip** — append to `tips` in `tips.json`. Keep it under ~80 characters:
  the bubble clamps to two lines and clips silently past about 90. The importer
  warns when a tip is too long.

## Card format

```jsonc
{
  "slug": "mushroom-lamps",            // required, stable id — never reuse for a different trend
  "title": "Mushroom lamps",           // required
  "blurb": "Cottagecore lighting is …",// required — why this could take off, your words
  "category": "Home & decor",          // required — shelf label, drives feed variety
  "tags": "lamp, mushroom, cottagecore, decor, lighting",  // required — comma-separated match words
  "imageUrl": "https://…",             // optional but strongly recommended — the feed is visual
  "sourceName": "TikTok",              // optional — where you spotted it
  "sourceUrl": "https://…",            // optional — link worth opening
  "priceRange": "$25–60",              // optional, free text
  "hotness": 80                        // optional 0–100 (default 50) — your call on how hot it is
}
```

Ranking uses three things you control: `tags` (matched against the user's
interests or their business keywords — write them the way sellers talk),
`hotness` (your editorial judgement), and recency (newer imports rank
higher; freshness fades over ~45 days, so bump `hotness` when something old
reheats). Categories are interleaved automatically — don't worry about
ordering the file.

The sample file is placeholder content so the feed renders during
development. Replace it with your own curation and import with
`--archive-missing` to retire the samples.

## Automated ingestion (`npm run ingest`)

Pulls demand signals from official APIs, scores them into a 0–100 `heat`, and
writes straight into `products/*.json`. No manual step.

```bash
npm run ingest                              # refresh signals on every product
npm run ingest -- --niche ceramics-pottery  # one category
npm run ingest -- --discover                # find NEW products per niche
npm run ingest -- --discover --limit 3      # cap new products per niche
npm run ingest -- --dry                     # show changes, write nothing
```

Keys go in `server/.env`. **Every source is optional** — adapters with no key
are skipped, so this works from your first approval:

| Source | What it gives | Getting a key |
|---|---|---|
| *(none)* | **readership + its trend, for every product** | **nothing to get — Wikimedia needs no key** |
| *(none)* | **real base cost per unit on print-on-demand rows** | **nothing to get — Printful's v1 catalog is open** |
| `EBAY_CLIENT_ID` + `_CLIENT_SECRET` | what reseller goods actually sell for, and how many sellers | developer.ebay.com — **self-serve, keys immediately, no approval queue** |
| `ALIEXPRESS_APP_KEY` + `_APP_SECRET` | units sold, unit cost, image, **commission-paying link** | portals.aliexpress.com — few days |
| `CJ_ACCESS_TOKEN` + `_COMPANY_ID` | real prices and live merchant listings across 15k+ advertisers | cj.com/publisher — free, and product search covers advertisers you haven't joined |
| `ETSY_API_KEY` | handmade listing counts + price band | developers.etsy.com — allow a few days |
| `META_ACCESS_TOKEN` | ad pressure: how many creatives, how long live | facebook.com/ads/library/api — ID check + app review, **not guaranteed** |

Run `npm run ingest` with an empty `.env` and it still works: Wikimedia's
pageview API needs no credential, so every product gets a measured `heat`,
an `interest` figure and a trend before you have signed up for anything.
Each niche carries a `wikiTitle` because no niche name is an article — and a
near-miss title is worse than a missing one, since it returns plausible
single-digit numbers rather than an error.

### Printful — what the blank costs

The second source needing no credential, and the one that answers the question
print-on-demand rows turn on: what does this cost me per unit? Printful's v1
catalog (`/products`) is open — no key, no OAuth, no signup — and publishes a
real price for every variant of 517 blanks.

It runs on `PRINT_ON_DEMAND` rows only, and reports a **price and nothing
else**. Printful is the supplier, not the market: it knows what a Bella+Canvas
3001 costs to make and nothing whatsoever about whether anyone wants yours. It
never sets `unitsSold` or `listings`, so it cannot move `heat` on its own.

Matching a row to a blank is the fiddly part, because rows are named for their
*design* and the catalog is named for the *garment* — "Hometown varsity tees"
has to find a Bella 3001. Two rules do the work, both learned by running it
against the real catalog rather than reasoning about it:

- **A shared product noun is required.** Without it, one shared adjective
  scored a perfect match on the wrong item: "Film-photography print **drops**"
  matched a Men's *Drop* Arm Tank Top, "**Pet**-portrait blankets" matched a
  Knitted Pet Sweater. Confident, entirely wrong costs.
- **Upgrades the row didn't ask for are penalised.** An upsell line carries
  every size the plain one does, so catalog depth picked it — a star-map print
  matched the *framed* poster at $20.35 when the sheet is $5.39. Rows that do
  ask for embroidery still get it.

19 of the 20 POD rows price cleanly. The one that doesn't — "Monthly milestone
outfit sets" — names no blank at all, and gets no number rather than a guess.

Note v2 (`/v2/catalog-*`) is **not** open despite what several guides claim; it
answers `This endpoint requires Oauth authentication!`. Don't "upgrade" the
adapter without a token in hand.

### Working backwards from the selling price

Sourcing cost is the one number nobody publishes. That is not bad luck with
any particular supplier — it is the shape of the whole market. What something
*sells* for is public because marketplaces want it indexed; what it *costs* to
source is the only real moat in this business, so every tool that has it is
reselling gated access. Printful is the exception precisely because it earns
when you sell.

So the criteria run in both directions:

- `assess({ cost, ... })` — the supplier side. Needs a sourcing cost.
- `assessListing({ retail, ... })` — the demand side. Needs no cost at all,
  and instead **states the one the product must hit**: a $34 seller has to be
  sourced under $11.33 to clear 3x, under $6.80 to hit 5x.

The second is arguably the better card anyway. "Source this under $11" is
actionable to a beginner in a way an unverifiable cost figure is not, it
survives suppliers changing their prices, and Discover never blocks waiting on
a credential.

`Signal.retailPrice` is a separate field from `Signal.price` and must stay
that way. They are opposite ends of one trade, and a $34 selling price landing
in `priceLow` reads as a $34 sourcing cost — the criteria would reject it as
unfundable when it is the best news about the product.

### eBay — and why it came back

eBay was in this pipeline once and removed, with the note that "its median
price is used and mass-produced stock, and feeding that into `typicalResale`
for a hand-thrown mug is worse than showing no number at all."

That was right, and entirely scoped to the maker catalog. For the reseller
lane the same property is the argument: somebody flipping goods IS selling
used, mass-produced stock and wants to know what it clears. So eBay runs on
`DROPSHIP` and `WHOLESALE` rows only and never touches the four fifths of the
catalog that is things people make.

It reports the **trimmed median**, not the cheapest listing. The bottom of any
eBay search is damaged stock, miscategorised items and loss leaders; the outer
decile goes before the median is taken. Its match count is the honest
competition figure — how many sellers a beginner would be listing against.

Three sources, down from five. Reddit mentions and YouTube views were dropped:
both were capped so low by the scorer that they rarely moved a result, and each
was another OAuth flow to keep alive. eBay went too — its median price is
used and mass-produced stock, and feeding that into `typicalResale` for a
hand-thrown mug is worse than showing no number at all. Etsy is the right
marketplace for a catalog that is four-fifths things you make.

`--discover` needs AliExpress specifically, since it's the only source that
returns actual products to create entries from.

**Scope is the thing to understand.** For anything you make, AliExpress is
being asked about *materials* — the keyword comes from `sourcingUrl`, so for
hand-thrown mugs it searches pottery glaze. Glaze volume is not mug demand, so
supply-scoped signals contribute their price and nothing else. Only a search
where the keyword *is* the sellable product can report units sold.

Scoring weights units sold highest, then ad pressure, and **subtracts** for a
crowded market. Ad evidence is capped below sales evidence: Meta's commercial
data covers EU-reaching ads only, so it is a leading indicator, not a mirror.
An ad still running after three weeks counts for much more than ten launched
last week — one is a business paying daily, the other is a test.

```jsonc
"signals": {
  "heat": 78,               // machine-measured; never overwrites your hotness
  "unitsSold": 2400, "listings": 90,
  "priceLow": 4.20, "priceHigh": 6.10,
  "ads": 3, "adDaysLive": 79, "adReach": 443000, "adCoverage": "EU",
  "advertiserName": "Verdant Home",
  "sources": ["aliexpress","etsy","meta"],
  "polledAt": "2026-07-26"
}
```

`hotness` is yours and ingest no longer touches it — it used to overwrite the
field in place, which lost your judgement for good. Both are kept so the feed
can prefer measured `heat` where it exists and still fall back to you.

Discover shows it: a "2.4k sold" chip on the card and a demand breakdown
inside. Saturation is derived from listing counts rather than hand-set. If
Meta access never comes through, the research bench fills the same ad fields
by hand and the card renders identically — see the `research` block below.

**Why not TikTok or Shopify data?** Neither offers an API for it. Shopify's
cross-store sales data is private to each merchant; the tools that show it
crawl `/products.json` and poll inventory. TikTok ad data has no public API
either. Both routes mean scraping — fragile, against terms, and a poor bet for
an app going through App Store review. If you want ad data automated, license
it from a provider that sells API access; it drops in as another adapter.

## Manual research bench (`npm run research`)

The bench at <http://localhost:4400> is for finding products that are
*provably* selling, rather than ones that sound good.

The method: an ad still running after weeks is one somebody is paying for
daily and hasn't switched off. That's harder evidence than view counts,
which spike by accident.

1. Browse [TikTok Creative Center → Top Ads](https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en)
   or the [Meta Ad Library](https://www.facebook.com/ads/library/), filtered
   to your categories. Note the advertiser and when the ad first appeared.
2. Find the same product on AliExpress (image search works well) and take
   the unit cost.
3. Log both in the bench. It writes a product entry with a `research`
   record into the right `products/` file.

```jsonc
"research": {
  "adPlatform": "TikTok",
  "adUrl": "https://…",          // the ad itself
  "advertiser": "shop name",
  "storeUrl": "https://…",       // who's running it
  "firstSeen": "2026-06-01",     // days-running is computed from these
  "lastSeen": "2026-07-25",
  "adCount": 9,                  // several creatives = real budget
  "engagement": "3.2M views",
  "saturation": "low|medium|high",
  "trend": "rising|steady|fading",
  "sourceCandidates": [ { "supplier": "AliExpress", "url": "…",
                          "unitCost": "$4.20", "moq": 1, "shipDays": "12–20" } ],
  "checkedAt": "2026-07-26",     // set automatically; cards flag stale ones
  "notes": ""
}
```

Products with a research record show it in Discover — a "▲ 54 days live"
chip on the card, and the full case when it expands.

**Nothing is scraped.** Those platforms' terms forbid automated collection
and their anti-bot would break it anyway. The bench assumes you looked
yourself; it just makes recording it fast. Write your own description too —
never paste theirs.

## Growth posts (`communities/*.json`)

The Growth feed uses the same workflow with `npm run growth:import`, one
file per category (`content/communities/home-living.json`, `general.json`
for cross-niche places, and so on — mirroring `content/products/`). Each
post reads as a PROFILE of the community — descriptive sections that fill
the post, with the how-to-approach guidance as a side element at the end:

```jsonc
{
  "slug": "reddit-pottery",         // required, stable id
  "title": "r/Pottery",             // required
  "platform": "Reddit",             // required — drives feed diversity + card styling
  "kind": "community",              // required — community | hashtag | marketplace | search | event
  "url": "https://…",               // required — the Explore link
  "tagline": "One line for the card.",              // required
  "audience": "Who a business finds there.",        // required — its own section
  "overview": "What this place is.\n\nBlank lines separate paragraphs.",  // required
  "discussions": "One topic per line\nWhat people talk about",            // required
  "loves": "What wins buyers over\nOne per line",                         // required
  "dislikes": "What turns them off\nOne per line",                        // required
  "rules": "Community rules / platform norms that limit you\nOne per line", // required
  "approach": "The end-of-post side element: how to actually show up.",   // required
  "tags": "pottery, ceramics, clay",// required — matched against business niche/keywords
  "imageUrl": "https://…",          // optional — hero image
  "memberCount": 250000,            // optional — real numbers only; enricher fills later
  "hotness": 70                     // optional 0–100 editorial priority (default 50)
}
```

`communities.json` currently holds AI-drafted write-ups of the proven
curated community set — **review and edit them; they carry the product's
voice.** Only put real numbers in `memberCount` (leave it out rather than
guess); a later enricher job fills stats from sanctioned APIs.

### Reddit discovery and refresh (`npm run communities`)

```bash
npm run communities                  # refresh member counts + rules on every Reddit entry
npm run communities -- --discover    # find NEW subreddits, one pass per niche
npm run communities -- --niche pets  # one niche
npm run communities -- --dry         # show changes, write nothing
```

Needs `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` — create a **script** app at
<https://www.reddit.com/prefs/apps>. Free, instant, no review queue. Set
`REDDIT_USER_AGENT` too; Reddit rate-limits generic agents hard.

**Reddit only, and that is a finding rather than a shortcut.** Checked live:
the anonymous `/r/x/about.json` endpoints now return 403, so everything goes
through `oauth.reddit.com`. Of the other eight platforms in this feed, none
will tell you about a community you do not own — X withdrew its free tier and
now charges per post read with full-archive search at Enterprise pricing;
Instagram's Graph API covers only accounts you administer; TikTok has no
discovery API; Discord only sees servers your bot has joined. Reddit carries
this feed because it is the only one that can.

**Refresh** is the job that runs forever. It updates the two things that go
stale and that nobody can maintain by hand — `memberCount` and `rules` — and
touches nothing else. Rules are only written when you have not written your
own, so a stats job can never overwrite real editing.

**Discover** writes to `communities/_discovered.json`, never into the curated
files, and it leaves `audience`, `overview`, `loves`, `dislikes` and
`approach` **empty on purpose**. Reddit reports how big a room is and what its
posted rules are. It does not report what wins that room over, and generating
those five fields from a sidebar blurb would be inventing the most
load-bearing content in the app — the part a beginner actually acts on. An
empty `approach` is a visible to-do; a plausible generated one is a silent
fabrication.

What it does fill is real: subscriber count, the verbatim posted rules, and
the top post titles of the year as evidence of what the place discusses.
Rules matter more than they look — getting them wrong is the one content
error that gets a user *banned* rather than ignored.

The usability filter is narrower than "big": NSFW and non-public subreddits
are dropped outright (you cannot post in a restricted sub), under 3,000
subscribers is a ghost town, and over 3,000,000 is a default-subscribed
firehose where a small seller is invisible. Tune with `--min` / `--max`.

### Community images (Pexels)

Cards show a photo. Rather than hand-pick 24 of them, let the enricher pull
free, commercial-use images from Pexels:

```bash
PEXELS_API_KEY=your_key npm run growth:images -- content/communities.json
```

Get a free key at <https://www.pexels.com/api/>. For each post *without* an
`imageUrl`, it searches Pexels and writes the URL back into the JSON (plus
`imageCredit`). The search term is the post's `imageQuery` if you set one,
otherwise its first tag — so if the auto-pick is weak (business niches
photograph cheesy), add `"imageQuery": "cozy pottery studio"` to steer it.
Your own `imageUrl` is never overwritten unless you pass `--force`.

Flow: `growth:images` (fill photos) → eyeball the picks → `growth:import`
(load to the feed). The image is decorative mood, not a photo of the actual
community.
