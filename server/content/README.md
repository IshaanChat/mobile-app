# Discover feed content

This folder is the curator's workspace. The Discover feed shows exactly what
you load here — the app ranks and personalizes it, but **you decide what
exists**: what the trend is, where you sourced it, and how it's described.

## Workflow

1. Edit a JSON file of cards (start from `trends.sample.json`).
2. Load it:

```bash
npm run trends:import -- content/trends.sample.json
```

Re-importing the same file updates cards in place (matched by `slug`), so you
can polish copy freely. Add `--archive-missing` to also archive every card
*not* in the file — that makes your JSON the single source of truth:

```bash
npm run trends:import -- content/trends.json --archive-missing
```

Archived cards leave everyone's feed but stay on the shelves of users who
saved them.

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
| `ALIEXPRESS_APP_KEY` + `_APP_SECRET` | units sold, unit cost, image, **commission-paying link** | portals.aliexpress.com — few days |
| `ETSY_API_KEY` | handmade listing counts + price band | developers.etsy.com — instant |
| `EBAY_CLIENT_ID` + `_CLIENT_SECRET` | competing listings, price band | developer.ebay.com — instant |
| `REDDIT_CLIENT_ID` + `_CLIENT_SECRET` | community mentions | reddit.com/prefs/apps — instant |
| `YOUTUBE_API_KEY` | review-video views | console.cloud.google.com — instant |

`--discover` needs AliExpress specifically, since it's the only source that
returns actual products to create entries from.

Scoring weights units sold highest and chatter lowest, and **subtracts** for a
crowded market. A product evidenced only by chatter is capped well below one
with real sales — you can suggest from talk, you can't confirm.

```jsonc
"signals": {
  "heat": 78,               // drives ranking; replaces hand-set hotness
  "unitsSold": 2400, "listings": 90, "views": 1900000, "mentions": 47,
  "priceLow": 4.20, "priceHigh": 6.10,
  "sources": ["aliexpress","ebay","youtube"],
  "polledAt": "2026-07-26"
}
```

Discover shows it: a "▲ 2.4k sold" chip on the card and a demand breakdown
inside. Saturation is derived from listing counts rather than hand-set.

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
