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

## Growth posts (`communities.json`)

The Growth feed uses the same workflow with `npm run growth:import`. Each
post is a community written up blog-post deep:

```jsonc
{
  "slug": "reddit-pottery",         // required, stable id
  "title": "r/Pottery",             // required
  "platform": "Reddit",             // required — drives feed diversity + card styling
  "kind": "community",              // required — community | hashtag | marketplace | search | event
  "url": "https://…",               // required — the Explore link
  "tagline": "One line for the card.",              // required
  "audience": "Who a business finds there.",        // required — shown as its own section
  "body": "The coached write-up.\n\nBlank lines separate paragraphs.", // required
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
