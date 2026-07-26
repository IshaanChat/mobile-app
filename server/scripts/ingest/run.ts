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

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { buildProduct, cleanTitle, slugify } from './build';
import { combine, saturationOf } from './score';
import { safeSearch, type Adapter, type Signal } from './types';
import { aliexpress } from './sources/aliexpress';
import { etsy } from './sources/etsy';
import { ebay } from './sources/ebay';
import { reddit } from './sources/reddit';
import { youtube } from './sources/youtube';

const DIR = 'content';
const ADAPTERS: Adapter[] = [aliexpress, etsy, ebay, reddit, youtube];

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

async function gather(keyword: string, live: Adapter[]): Promise<Signal[]> {
  const out: Signal[] = [];
  for (const a of live) {
    out.push(...(await safeSearch(a, keyword)));
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
      const keyword = p.imageQuery || p.title;
      const signals = combine(await gather(keyword, live));
      if (!signals.sources.length) {
        console.log(`  \x1b[90m· ${p.title} — nothing reported\x1b[0m`);
        continue;
      }
      p.signals = signals;
      p.hotness = signals.heat;
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
    const found = await safeSearch(aliexpress, keyword);
    const top = found
      .filter((s) => s.productTitle && (s.unitsSold ?? 0) > 0)
      .sort((a, b) => (b.unitsSold ?? 0) - (a.unitsSold ?? 0))
      .slice(0, PER_NICHE);

    for (const hit of top) {
      const slug = slugify(cleanTitle(hit.productTitle ?? ''));
      if (!slug || seen.has(slug)) continue;

      // Corroborate this specific product across the other sources.
      const others = live.filter((a) => a.name !== 'aliexpress');
      const signals = combine([hit, ...(await gather(cleanTitle(hit.productTitle ?? ''), others))]);
      const product = buildProduct(hit, niche.slug, signals);

      list.push(product);
      seen.add(slug);
      added++;
      console.log(
        `  \x1b[32m+\x1b[0m ${product.title} — heat ${signals.heat}` +
          (signals.unitsSold ? ` · ${signals.unitsSold.toLocaleString('en-US')} sold` : '')
      );
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
        'Add at least one key to server/.env — eBay, Reddit and YouTube are all instant approvals.'
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
