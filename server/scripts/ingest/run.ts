/**
 * Automated trend ingestion.
 *
 *   npm run ingest                            refresh signals on every product
 *   npm run ingest -- --niche ceramics-pottery
 *   npm run ingest -- --discover              find NEW products per niche
 *   npm run ingest -- --discover --limit 3    cap new products per niche
 *   npm run ingest -- --dry                   show what would change, write nothing
 *
 * Pulls demand signals from whichever sources have credentials configured,
 * scores them into a 0–100 heat, and writes into content/products/*.json.
 * Adapters with no key are skipped, so this is useful from the first
 * approval rather than needing all of them.
 *
 * Nothing here scrapes. Every source is an official, documented API.
 */

// Adapters read their credentials lazily, but this still has to happen before
// anything calls configured(). Same one-liner src/index.ts uses.
try {
  process.loadEnvFile();
} catch {
  /* no .env — the environment may already carry the keys */
}

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { buildProduct, cleanTitle, slugify } from './build';
import { combine, saturationOf } from './score';
import { shortlist } from './criteria';
import { safeSearch, type Adapter, type Signal, type SignalScope } from './types';
import { aliexpress } from './sources/aliexpress';
import { etsy } from './sources/etsy';
import { meta } from './sources/meta';
import { wikipedia } from './sources/wikipedia';
import { cj } from './sources/cj';
import { printful } from './sources/printful';
import { ebay } from './sources/ebay';

// Resolved from this file rather than the cwd, which used to mean running
// ingest from anywhere but server/ silently found no products at all.
const DIR = resolve(__dirname, '..', '..', 'content');
const ADAPTERS: Adapter[] = [aliexpress, etsy, cj, meta, wikipedia, printful, ebay];

const args = process.argv.slice(2).filter((a) => a !== '--');
const has = (f: string) => args.includes(f);
const valueOf = (f: string) => {
  const i = args.indexOf(f);
  return i !== -1 ? args[i + 1] : undefined;
};

const DISCOVER = has('--discover');
const DRY = has('--dry');
const ONLY_NICHE = valueOf('--niche');
const PER_NICHE = Number(valueOf('--limit')) || 5;

const fileForDomain = (d: string) =>
  d.toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').replace(/--+/g, '-');
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadNiches(): any[] {
  return JSON.parse(readFileSync(`${DIR}/niches.json`, 'utf8'));
}
function productFiles(): string[] {
  return readdirSync(`${DIR}/products`).filter((f) => f.endsWith('.json'));
}
function readFile(f: string): any[] {
  return JSON.parse(readFileSync(`${DIR}/products/${f}`, 'utf8'));
}
function writeFile(f: string, list: any[]) {
  if (DRY) return;
  writeFileSync(`${DIR}/products/${f}`, JSON.stringify(list, null, 2) + '\n');
}

/** Products the seller buys to resell, versus ones they make themselves. */
const RESELLS = new Set(['DROPSHIP', 'WHOLESALE']);

/**
 * Print-on-demand sits in neither camp: the seller neither buys stock nor
 * makes the item, they upload art onto a blank somebody else fulfils. That
 * makes the supplier's catalog price the single most useful fact about the
 * row, and it is the one number these products had only as a hand-estimate.
 */
const POD = 'PRINT_ON_DEMAND';

/**
 * The supply term already sits in the authored data: sourcingUrl points at
 * something like .../wholesale-pottery-glaze.html. Recovering it is better
 * than guessing, because the curator already decided what this is made from.
 */
function supplyTerm(p: any): string {
  const fromUrl = String(p.sourcingUrl ?? '')
    .replace(/^.*\/(?:w\/)?(?:wholesale-)?/, '')
    .replace(/\.html?.*$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return fromUrl || p.imageQuery || p.title;
}

/**
 * Which adapter gets which keyword, and — crucially — what its answer is
 * about. For something the seller makes, AliExpress is being asked about
 * materials, so its volume is priced but never counted as demand.
 */
function planFor(p: any, niche?: any): { adapter: Adapter; keyword: string; scope: SignalScope }[] {
  const resells = RESELLS.has(p.sourcingType);
  return [
    // Only POD rows. The match floor would reject a potter's mug anyway, but
    // asking at all would spend a call per product to be told no 188 times.
    ...(p.sourcingType === POD
      ? [{ adapter: printful, keyword: p.title, scope: 'supply' as SignalScope }]
      : []),
    // Only reseller rows. eBay was dropped from this pipeline once because
    // its used, mass-produced stock made a poor comparison for a hand-thrown
    // mug — which was right, and is precisely why it belongs here: a flipper
    // IS selling used mass-produced stock and wants to know what it clears.
    ...(resells ? [{ adapter: ebay, keyword: p.title, scope: 'category' as SignalScope }] : []),
    { adapter: aliexpress, keyword: resells ? p.title : supplyTerm(p), scope: resells ? 'product' : 'supply' },
    // Etsy always measures the market the seller actually sells into.
    { adapter: etsy, keyword: p.title, scope: 'category' },
    { adapter: meta, keyword: p.imageQuery || p.title, scope: 'category' },
    // A merchant catalog prices the thing being sold for resale rows, and
    // the materials for the rest — same split as AliExpress. Either way it
    // reports a price and a live listing, never a sale.
    { adapter: cj, keyword: resells ? p.title : supplyTerm(p), scope: resells ? 'product' : 'supply' },
    // Readership is a property of the subject, not the listing, so it is
    // asked once per niche. `wikiTitle` exists because "Ceramics & pottery"
    // is not an article and "Pottery" is — and a near-miss title returns
    // plausible-looking single-digit numbers rather than an error, so the
    // curator names it explicitly.
    { adapter: wikipedia, keyword: niche?.wikiTitle || niche?.name || '', scope: 'category' },
  ];
}

// Meta allows roughly 200 calls an hour and counts pagination against it.
// Blowing that throttles the token for everything, so the run spends a fixed
// budget and then stops asking — a nightly cron covers the catalog over a
// couple of nights instead of failing halfway through one.
const META_BUDGET = Number(process.env.META_CALLS_PER_RUN) || 150;
// CJ's published limits could not be confirmed from public docs, so it gets
// the same treatment until a live token shows what the real numbers are.
// Erring high rather than low: a budget that never binds costs nothing.
const CJ_BUDGET = Number(process.env.CJ_CALLS_PER_RUN) || 400;
const budgets: Record<string, number> = { meta: META_BUDGET, cj: CJ_BUDGET };
const used: Record<string, number> = {};
const warned = new Set<string>();

async function gather(
  plan: { adapter: Adapter; keyword: string; scope: SignalScope }[],
  live: Adapter[]
): Promise<Signal[]> {
  const out: Signal[] = [];
  for (const step of plan) {
    if (!live.includes(step.adapter)) continue;
    const budget = budgets[step.adapter.name];
    if (budget !== undefined) {
      const spent = used[step.adapter.name] ?? 0;
      if (spent >= budget) {
        if (!warned.has(step.adapter.name)) {
          console.log(
            `  \x1b[33m${step.adapter.name} budget of ${budget} calls spent — skipping it for the rest of this run.\x1b[0m`
          );
          warned.add(step.adapter.name);
        }
        continue;
      }
      used[step.adapter.name] = spent + 1;
    }
    out.push(...(await safeSearch(step.adapter, step.keyword, step.scope)));
    await delay(250); // stay well inside every rate limit
  }
  return out;
}

async function refresh(live: Adapter[]) {
  const niches = loadNiches();
  const nicheBySlug: Record<string, any> = {};
  for (const n of niches) nicheBySlug[n.slug] = n;

  let touched = 0;
  for (const f of productFiles()) {
    const list = readFile(f);
    let changed = false;
    for (const p of list) {
      if (ONLY_NICHE && p.nicheSlug !== ONLY_NICHE) continue;
      const signals = combine(await gather(planFor(p, nicheBySlug[p.nicheSlug]), live));
      if (!signals.sources.length) {
        console.log(`  \x1b[90m· ${p.title} — nothing reported\x1b[0m`);
        continue;
      }
      // Only `signals` is written. `hotness` is the curator's number and this
      // used to overwrite it in place, which lost it for good — and with it
      // any way to ask whether the machine actually beats the human.
      p.signals = signals;
      changed = true;
      touched++;
      console.log(
        `  \x1b[32m✓\x1b[0m ${p.title} — heat ${signals.heat}` +
          (signals.unitsSold ? ` · ${signals.unitsSold.toLocaleString('en-US')} sold` : '') +
          (signals.listings !== undefined ? ` · ${saturationOf(signals)} saturation` : '')
      );
    }
    if (changed) writeFile(f, list);
  }
  console.log(`\n${DRY ? 'Would update' : 'Updated'} ${touched} products.`);
}

async function discover(live: Adapter[]) {
  if (!aliexpress.configured()) {
    console.error(
      '\x1b[31mDiscovery needs AliExpress — it is the only source that returns actual products.\x1b[0m\n' +
        'Set ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET, or run without --discover to refresh what you have.'
    );
    process.exit(1);
  }
  const niches = loadNiches().filter((n) => !ONLY_NICHE || n.slug === ONLY_NICHE);
  if (!niches.length) { console.error('No niche matched ' + ONLY_NICHE); process.exit(1); }

  let added = 0;
  for (const niche of niches) {
    const file = fileForDomain(niche.domain) + '.json';
    const list = readFile(file);
    const seen = new Set(list.map((p: any) => p.slug));
    const keyword = niche.tags.split(',')[0].trim() || niche.name;

    console.log(`\n\x1b[1m${niche.name}\x1b[0m  (${keyword})`);
    // Discovery asks AliExpress for actual listings, so each hit IS the
    // product — the one place 'product' scope is honest for a raw search.
    const found = await safeSearch(aliexpress, keyword, 'product');

    // Ranked on the criteria, not on volume. Sorting by unitsSold descending
    // — which is what this did — put the single most contested listing on the
    // page in first place every time, because "most sold" and "most competed
    // for" are the same fact stated twice. Position in the results is passed
    // through as the crowding proxy; it is just the array index, and the
    // supplier already sorted the page by volume for us.
    const ranked = shortlist(
      found
        .filter((s) => s.productTitle)
        .map((s, rank) => ({ ...s, cost: s.price, rank }))
    );

    for (const { candidate: hit, assessment } of ranked.slice(0, PER_NICHE)) {
      const slug = slugify(cleanTitle(hit.productTitle ?? ''));
      if (!slug || seen.has(slug)) continue;

      // Corroborate this specific product across the other sources. They
      // describe the market around it, not the listing itself.
      const title = cleanTitle(hit.productTitle ?? '');
      const others = live
        .filter((a) => a.name !== 'aliexpress')
        .map((adapter) => ({ adapter, keyword: title, scope: 'category' as const }));
      const signals = combine([hit, ...(await gather(others, live))]);
      const product = buildProduct(hit, niche.slug, signals);

      list.push(product);
      seen.add(slug);
      added++;
      console.log(
        `  \x1b[32m+\x1b[0m ${product.title} — fit ${assessment.score}` +
          (assessment.verdict === 'borderline' ? ' \x1b[33m(borderline)\x1b[0m' : '') +
          ` · heat ${signals.heat}` +
          (signals.unitsSold ? ` · ${signals.unitsSold.toLocaleString('en-US')} sold` : '')
      );
      // The reason it was picked, so a run can be argued with rather than
      // just trusted — the whole point of scoring against stated criteria.
      for (const r of assessment.reasons) console.log(`      \x1b[90m${r}\x1b[0m`);
    }
    writeFile(file, list);
  }
  console.log(`\n${DRY ? 'Would add' : 'Added'} ${added} products.`);
}

async function main() {
  const live = ADAPTERS.filter((a) => a.configured());
  const skipped = ADAPTERS.filter((a) => !a.configured());

  console.log(`\x1b[1mIngest\x1b[0m — ${DISCOVER ? 'discovering new products' : 'refreshing signals'}` +
    (ONLY_NICHE ? ` · niche ${ONLY_NICHE}` : '') + (DRY ? ' · dry run' : ''));
  console.log('Sources: ' + (live.length ? live.map((a) => a.name).join(', ') : 'none'));
  for (const a of skipped) console.log(`  \x1b[90mskipping ${a.name} — needs ${a.missing()}\x1b[0m`);

  if (!live.length) {
    console.error(
      '\n\x1b[31mNo sources configured, so there is nothing to ingest.\x1b[0m\n' +
        'Add at least one key to server/.env. Etsy is the quickest to get and\n' +
        'unlocks saturation for the handmade half of the catalog; AliExpress is\n' +
        'the one that matters, since it is the only source returning real\n' +
        'products, costs and a sourcing link.'
    );
    process.exit(1);
  }
  console.log('');

  if (DISCOVER) await discover(live);
  else await refresh(live);
}

main().catch((err) => {
  console.error('\x1b[31m' + err.message + '\x1b[0m');
  process.exit(1);
});
