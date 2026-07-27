/**
 * Bulk product sourcing from AliExpress dropshipper feeds.
 *
 *   npm run sourcing                      pull the default feed, write picks
 *   npm run sourcing -- --dry             show what would land, write nothing
 *   npm run sourcing -- --feeds           list the feeds this app can read
 *   npm run sourcing -- --feed "NAME"     pull a specific feed
 *   npm run sourcing -- --pages 6         go deeper (50 products per page)
 *   npm run sourcing -- --limit 40        cap how many picks are written
 *
 * The pipeline is: pull a curated feed → judge every product against
 * criteria.ts → write the survivors into content/products/discovered.json.
 *
 * Nothing here assigns a niche. Every pick lands in `sourced-unsorted`, a
 * real niche that exists only as a parking bay, because import-catalog.ts
 * treats an unknown nicheSlug as a hard error and the prototype dereferences
 * the joined niche without checking. Sorting these into the 47 real niches is
 * a separate curation pass — and one worth doing with the products in front
 * of you rather than guessing a category map up front.
 */

try {
  process.loadEnvFile();
} catch {
  /* no .env — the environment may already carry the keys */
}

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { configured, feeds, fetchFeed, type FeedProduct } from './ingest/sources/aliexpress-ds';
import { shortlist, UPSIDE_SCORE, type Assessment } from './ingest/criteria';

const DIR = resolve(__dirname, '..', 'content');
const OUT = `${DIR}/products/discovered.json`;
/** Full sales coverage and genuinely cheap stock — measured, see README. */
const DEFAULT_FEED = 'AEB_Droplo_BestsellersItems_20241016';
const PARKING_NICHE = 'sourced-unsorted';

const args = process.argv.slice(2).filter((a) => a !== '--');
const has = (f: string) => args.includes(f);
const valueOf = (f: string) => {
  const i = args.indexOf(f);
  return i !== -1 ? args[i + 1] : undefined;
};

const DRY = has('--dry');
const LIST = has('--feeds');
const PAGES = Number(valueOf('--pages')) || 3;
const LIMIT = Number(valueOf('--limit')) || 30;
/** Borderline picks are excluded by default — see PASS_SCORE in criteria.ts. */
const INCLUDE_BORDERLINE = has('--include-borderline');

/**
 * The feeds worth drawing from, ranked by `--screen` across all 124.
 *
 * Feed size is not yield and picking by product count was a mistake. The
 * three largest pools returned 3–4 passes per page; the best feed here
 * returns 27 of 47, nine times better, and is not in the top forty by size.
 * Category- and price-banded pools beat general "bestseller" ones outright,
 * because a $0–10 clothing band has already done half the criteria's job.
 *
 * The traps, for anyone tempted to add by name: "AEB_US Local Items" and the
 * other LocalStock pools are US-warehouse stock at a $50–80 median cost, and
 * score zero. Re-run `npm run sourcing -- --screen 124` rather than guessing.
 */
const AUTO_FEEDS = [
  // Deliberately weighted away from clothing. The highest-yielding feeds are
  // the two clothing pools, and pulling by yield alone produced a catalog
  // that was 60% shirts and dresses — a strictly worse Discover feed than a
  // smaller, stranger one, because 300 near-identical t-shirts give a
  // beginner nothing to choose between. Yield is not the only axis.
  'AEB_SHOPLAZZA_Toys&Hobbies_$10~20_20241118',
  'toys_ZA topsellers_ 20240423',
  'computer&office_ZA topsellers_ 20240423',
  'consumer electronics_ZA topsellers_ 20240423',
  'home_ZA topsellers_ 20240423',
  'home appliances_ZA topsellers_ 20240423',
  'DS_Home&Kitchen_bestsellers',
  'tool_ZA topsellers_ 20240423',
  'DS_Jewelry&Watch 10$+',
  'DS_Mother&Kids 10$+',
  'AEB_SHOPLAZZA_Mother&Kids_$10~30_20241115',
  'Sports_ZA topsellers_ 20240423',
  'USA_beauty&health_topsellers',
  'DS_HairRemoval&Lights&Tools 10$+',
  'AEB_ PhoneAccessories_EG',
  'AEB_SHOPLAZZA_Luggage&Bags_$0~10_20241115',
  'light_ZA topsellers_ 20240423',
  'AEB_US_Lighting_TopSellers',
  'DS_Christmas-Decor',
  'DS_Winter-must-haves',
  'DS_CyberMondayEssentials',
  'AEB_SurpriseBox_TechKidsWomen_20241024',
  'Security_ZA topsellers_ 20240423',
  // Two clothing feeds kept rather than none — the category belongs in the
  // catalog, it just should not be the catalog.
  'AEB_SHOPLAZZA_WomenClothing_$10~30_20241115',
  'AEB_SHOPLAZZA_MenClothing_$10~30_20241115',
];

/**
 * Most picks allowed from any one AliExpress category.
 *
 * Diversity has to be enforced at selection, not hoped for at the feed level.
 * Even across 25 varied feeds the commodity categories flood the shortlist,
 * because there are simply more cheap t-shirts in the world than cheap
 * anything-else.
 */
const CATEGORY_CAP = Number(valueOf('--cap')) || 25;

const FEEDS: string[] = (() => {
  const explicit = args.reduce<string[]>((acc, a, i) => (a === '--feed' && args[i + 1] ? [...acc, args[i + 1]] : acc), []);
  if (explicit.length) return explicit;
  return has('--auto') ? AUTO_FEEDS : [DEFAULT_FEED];
})();

const slugify = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 52);

/**
 * Supplier titles are keyword soup: "2024 New Hot Sale Ceramic Mug, 350ml,
 * Free Shipping | Gift". Take the first clause and strip the SEO furniture.
 */
export function cleanTitle(raw: string): string {
  const tidy = (s: string) =>
    s.replace(/\b(20\d\d|new|hot ?sale|free shipping|dropshipping|wholesale|for)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

  const first = tidy(raw.split(/[,|(\/]/)[0]);
  // Taking the first clause alone assumes the product name leads. Plenty of
  // supplier titles lead with a spec instead — "800L, Garden Hose Reel..." or
  // "1PC, Bluetooth Speaker..." — and that produced catalog entries literally
  // titled "800L" and "1PC", which are unusable as titles and worse as slugs.
  // Anything too short to be a name means the split cut in the wrong place.
  if (first.length >= 15) return first.slice(0, 70);
  const whole = tidy(raw.replace(/[|\/]/g, ' '));
  return (whole.length > first.length ? whole : first).slice(0, 70);
}

/**
 * The card's copy, written from the numbers rather than the seller's blurb.
 * Nothing is pasted from AliExpress — their listing text is theirs, and it is
 * keyword soup regardless.
 */
export function describe(p: FeedProduct, a: Assessment): string {
  const bits: string[] = [];
  if (p.unitsSold) bits.push(`${p.unitsSold.toLocaleString('en-US')} sold recently`);
  bits.push(`sourcing at $${p.cost.toFixed(2)}`);
  if (a.retail) bits.push(`with comparable listings around $${a.retail.low.toFixed(0)}–${a.retail.high.toFixed(0)}`);
  return bits.join(', ') + '.';
}

export function toEntry(p: FeedProduct, a: Assessment) {
  const title = cleanTitle(p.title);
  return {
    slug: slugify(title) || `ae-${p.productId}`,
    nicheSlug: PARKING_NICHE,
    title,
    blurb: describe(p, a),
    sourcingType: 'DROPSHIP',
    sourceName: 'AliExpress',
    sourcingUrl: p.url,
    sourceCost: `$${p.cost.toFixed(2)}`,
    typicalResale: a.retail ? `$${a.retail.low.toFixed(0)}–${a.retail.high.toFixed(0)}` : '',
    hotness: a.score,
    imageQuery: title,
    imageUrl: p.imageUrl ?? '',
    imageCredit: p.imageUrl ? 'AliExpress listing' : '',
    // Kept so the niche pass has something to sort on later, and so a human
    // can see what AliExpress thinks this is without opening the link.
    sourceCategory: [p.categoryTop, p.categorySub].filter(Boolean).join(' / '),
    signals: {
      heat: a.score,
      ...(p.unitsSold ? { unitsSold: p.unitsSold } : {}),
      priceLow: p.cost,
      priceHigh: p.cost,
      sources: ['aliexpress'],
      polledAt: new Date().toISOString().slice(0, 10),
    },
    tier: a.tier ?? 'proven',
    criteria: { score: a.score, verdict: a.verdict, tier: a.tier, reasons: a.reasons },
  };
}

/**
 * Sample every feed and report what it is actually worth.
 *
 * Feed names promise very little — "AEB_US Local Items" sounds like the
 * obvious pick and yields almost nothing, because it is US-warehouse stock
 * priced for fast shipping rather than resale. One page each is enough to
 * separate the pools worth a deep pull from the ones that are all margin-dead
 * stock or carry no sales figures at all.
 */
async function screenFeeds() {
  const all = (await feeds()).sort((a, b) => b.productCount - a.productCount);
  const top = all.slice(0, Number(valueOf('--screen')) || 40);
  console.log(`\x1b[1mScreening ${top.length} of ${all.length} feeds\x1b[0m (one page each)\n`);
  console.log('pass  n   medCost  withSales  feed');

  const results: { name: string; pass: number; n: number }[] = [];
  for (const f of top) {
    try {
      const got = await fetchFeed(f.name, { pages: 1 });
      if (!got.length) { console.log(`   -   0        -          -  ${f.name}`); continue; }
      const costs = got.map((p) => p.cost).sort((a, b) => a - b);
      const withSales = got.filter((p) => p.unitsSold).length;
      const passed = shortlist(got.map((p, rank) => ({ ...p, rank })))
        .filter((r) => r.assessment.verdict === 'pass').length;
      results.push({ name: f.name, pass: passed, n: got.length });
      const flag = passed >= 4 ? '\x1b[32m' : passed >= 2 ? '' : '\x1b[90m';
      console.log(
        `${flag}${String(passed).padStart(4)}\x1b[0m ${String(got.length).padStart(3)}  ` +
          `$${costs[Math.floor(costs.length / 2)].toFixed(2).padStart(7)}  ` +
          `${String(withSales).padStart(6)}/${String(got.length).padEnd(3)}  ${f.name}`
      );
    } catch (e: any) {
      console.log(`   \x1b[31mx\x1b[0m                          ${f.name} — ${e.message.slice(0, 40)}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  const good = results.filter((r) => r.pass >= 3).sort((a, b) => b.pass - a.pass);
  console.log(`\n\x1b[1m${good.length} feeds worth pulling deeply:\x1b[0m`);
  good.forEach((g) => console.log(`  ${String(g.pass).padStart(2)}/${g.n}  ${g.name}`));
  console.log(`\nPull them:\n  npm run sourcing -- --pages 20 ${good.slice(0, 8).map((g) => `--feed "${g.name}"`).join(' ')}`);
}

async function listFeeds() {
  const all = await feeds();
  all.sort((a, b) => b.productCount - a.productCount);
  console.log(`\x1b[1m${all.length} feeds available\x1b[0m\n`);
  for (const f of all.slice(0, 40)) {
    console.log(`  ${String(f.productCount).padStart(7).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}  ${f.name}`);
  }
  console.log(`\nPull one with:  npm run sourcing -- --feed "${all[0]?.name}"`);
}

async function main() {
  if (!configured()) {
    console.error(
      '\x1b[31mNo AliExpress credentials.\x1b[0m\n' +
        'Set ALIEXPRESS_APP_KEY and ALIEXPRESS_APP_SECRET in server/.env.'
    );
    process.exit(1);
  }

  if (LIST) return listFeeds();
  if (has("--screen")) return screenFeeds();

  console.log(`\x1b[1mSourcing\x1b[0m — ${FEEDS.length} feed(s)` + (DRY ? ' · dry run' : ''));

  const products: FeedProduct[] = [];
  const seen = new Set<string>();
  for (const feed of FEEDS) {
    console.log(`\n  \x1b[1m${feed}\x1b[0m`);
    const got = await fetchFeed(feed, {
      pages: PAGES,
      onPage: (page, n) => console.log(`    \x1b[90mpage ${page}: ${n}\x1b[0m`),
    });
    // Feeds overlap — the Shoplazza pools share a lot of stock — so dedupe
    // across them as well as within them, or the same product is scored
    // twice and written twice under near-identical slugs.
    for (const p of got) {
      if (p.productId && seen.has(p.productId)) continue;
      seen.add(p.productId);
      products.push(p);
    }
  }
  if (!products.length) {
    console.error(`\n\x1b[31mNo products returned. Run --feeds to see valid names.\x1b[0m`);
    process.exit(1);
  }

  // Position in the feed is passed through as the crowding proxy — the same
  // reasoning as the paged search: the front of any supplier list is where
  // every other seller is already looking.
  const scored = shortlist(
    products.map((p, rank) => ({ ...p, unitsSold: p.unitsSold, cost: p.cost, rank }))
  );
  // Both shelves: proven picks, plus the high-upside tier that scores lower
  // because it is early rather than because it is weak.
  const tiered = scored.filter((r) => r.assessment.tier);
  const proven = tiered.filter((r) => r.assessment.tier === 'proven');
  const upside = tiered.filter((r) => r.assessment.tier === 'upside');

  // Round-robin between the tiers, capped per category.
  //
  // This said "interleave" while actually concatenating `[...proven,
  // ...upside]`, and the two are not the same under a cap: proven picks
  // filled every category quota before a single upside pick was considered,
  // so a run that scored 142 of them wrote exactly zero. A starved tier is
  // worse than no tier, because the feed looks like it has one.
  //
  // Three proven to one upside. The catalog should lead with settled demand
  // and salt the early bets through it, not split evenly — most people want
  // the safe pick and the upside row is the interesting exception.
  const perCategory: Record<string, number> = {};
  const ranked: typeof tiered = [];
  const queues = { proven: [...proven], upside: [...upside] };
  const order: ('proven' | 'upside')[] = ['proven', 'proven', 'proven', 'upside'];
  for (let i = 0; queues.proven.length || queues.upside.length; i++) {
    let which = order[i % order.length];
    if (!queues[which].length) which = which === 'proven' ? 'upside' : 'proven';
    const r = queues[which].shift();
    if (!r) continue;
    const cat = (r.candidate as any).categorySub || (r.candidate as any).categoryTop || '?';
    if ((perCategory[cat] ?? 0) >= CATEGORY_CAP) continue;
    perCategory[cat] = (perCategory[cat] ?? 0) + 1;
    ranked.push(r);
  }

  console.log(
    `
${products.length} pulled · [32m${proven.length} proven[0m` +
      ` · [36m${upside.length} high upside[0m` +
      ` · ${ranked.length} after the per-category cap of ${CATEGORY_CAP}, writing ${Math.min(LIMIT, ranked.length)}`
  );

  const picks = ranked.slice(0, LIMIT);
  console.log('\n\x1b[1mfit  cost     sold   category             product\x1b[0m');
  for (const { candidate, assessment } of picks) {
    console.log(
      `${String(assessment.score).padStart(3)}  $${candidate.cost.toFixed(2).padEnd(7)} ` +
        `${String(candidate.unitsSold ?? '-').padStart(5)}  ` +
        `${String(candidate.categorySub ?? '').slice(0, 19).padEnd(20)} ${cleanTitle(candidate.title).slice(0, 44)}`
    );
  }

  if (DRY) {
    console.log('\n\x1b[33mDry run — nothing written.\x1b[0m');
    return;
  }

  // Merged by slug rather than replaced, so re-running a feed refreshes what
  // it finds without discarding picks from a different feed.
  const existing: any[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];

  // Drop anything the CURRENT bar would no longer accept. Without this,
  // tightening the criteria only affects new picks and the file keeps
  // whatever an older, looser threshold happened to let through — so the
  // catalog silently stops meaning one consistent thing.
  const bar = UPSIDE_SCORE;
  const kept = existing.filter((e) => Number(e?.criteria?.score ?? e?.hotness ?? 0) >= bar);
  const pruned = existing.length - kept.length;
  if (pruned) console.log(`\x1b[90mPruned ${pruned} earlier pick(s) below the current bar of ${bar}.\x1b[0m`);

  const bySlug = new Map(kept.map((e) => [e.slug, e]));
  let added = 0;
  for (const { candidate, assessment } of picks) {
    const entry = toEntry(candidate, assessment);
    if (!bySlug.has(entry.slug)) added++;
    bySlug.set(entry.slug, entry);
  }
  const merged = [...bySlug.values()];
  writeFileSync(OUT, JSON.stringify(merged, null, 2) + '\n');

  console.log(
    `\n\x1b[32mWrote ${merged.length} products\x1b[0m (${added} new) to content/products/discovered.json` +
      `\nAll parked in the "${PARKING_NICHE}" niche — sort them into real niches when you review.`
  );
}

main().catch((err) => {
  console.error('\x1b[31m' + err.message + '\x1b[0m');
  process.exit(1);
});
