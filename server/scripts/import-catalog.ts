/**
 * Load the curated Discover catalog into Postgres.
 *
 *   npm run catalog:import
 *   npm run catalog:import -- --archive-missing
 *   npm run catalog:import -- --dry
 *
 * Reads content/niches.json and every content/products/*.json, joins them on
 * nicheSlug, and upserts both into the database. This is the step that was
 * missing: the JSON has always been the source of truth, but nothing carried
 * it into the DB, so the API served an older and much thinner model.
 *
 * Safe to re-run after every ingest, which is the point — a nightly cron is
 * `npm run ingest && npm run catalog:import`. Two rules make that safe:
 *
 *   1. Machine columns (heat, unitsSold, ad*) are written ONLY when the JSON
 *      carries a `signals` block. A product without one means "the file has
 *      nothing to say about this", never "clear what the database knows".
 *   2. heatPrev shifts only when heat actually changed, so importing twice
 *      in a row can't flatten the trending delta to zero.
 *
 * Format: see content/README.md.
 */

// Same one-liner src/index.ts uses. Not needed for the DB URL alone, but the
// script should behave the same way as everything else that reads .env.
try {
  process.loadEnvFile();
} catch {
  /* no .env — fine, the environment may already carry DATABASE_URL */
}

import { readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Resolved from this file, not the cwd. `npm run` happens to set cwd to
// server/, but `tsx scripts/import-catalog.ts` from anywhere else shouldn't
// silently import nothing.
const CONTENT = resolve(__dirname, '..', 'content');

interface NicheInput {
  slug: string;
  name: string;
  domain: string;
  audience: string;
  tags: string;
  imageQuery?: string;
  imageUrl?: string;
  imageCredit?: string;
}

interface SignalsInput {
  heat?: number;
  interest?: number;
  interestTrend?: number;
  liveSourcingUrl?: string;
  liveMerchant?: string;
  unitsSold?: number;
  listings?: number;
  priceLow?: number;
  priceHigh?: number;
  ads?: number;
  adDaysLive?: number;
  adReach?: number;
  adCoverage?: string;
  advertiserName?: string;
  sources?: string[];
  polledAt?: string;
}

interface ResearchInput {
  adUrl?: string;
  advertiser?: string;
  firstSeen?: string;
  lastSeen?: string;
  adCount?: number;
}

interface ProductInput {
  slug: string;
  nicheSlug: string;
  title: string;
  blurb: string;
  sourcingType: string;
  sourceName?: string;
  sourcingUrl?: string;
  sourceCost?: string;
  typicalResale?: string;
  hotness?: number;
  /** 'proven' | 'upside'. Absent on hand-curated products, which aren't tiered. */
  tier?: string;
  imageQuery?: string;
  imageUrl?: string;
  imageCredit?: string;
  signals?: SignalsInput;
  research?: ResearchInput;
}

const SOURCING = new Set(['DROPSHIP', 'WHOLESALE', 'PRINT_ON_DEMAND', 'MATERIALS', 'MAKE_YOUR_OWN']);
const AUDIENCES = new Set(['maker', 'reseller', 'both']);
const TIERS = new Set(['proven', 'upside']);

function fail(message: string): never {
  console.error(`\x1b[31m${message}\x1b[0m`);
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => a !== '--');
const archiveMissing = args.includes('--archive-missing');
const dry = args.includes('--dry');

// ---------------------------------------------------------------- read ----

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err: any) {
    fail(`Could not read ${path}: ${err.message}`);
  }
}

const rawNiches = readJson(join(CONTENT, 'niches.json'));
if (!Array.isArray(rawNiches)) fail('niches.json must contain a JSON array.');

// Underscore-prefixed files are staging, not content — the same convention the
// preview loader and the community importer use. Nothing stages here yet, but
// the omission was a live bug waiting: staged rows carry deliberately empty
// write-ups, and importing them is how 95 blank cards once reached the Grow
// feed. Cheaper to honour the convention everywhere than to remember which
// importer respects it.
const productFiles = readdirSync(join(CONTENT, 'products'))
  .filter((f) => f.endsWith('.json') && !f.startsWith('_'));
if (productFiles.length === 0) fail('No product files found in content/products/ (underscore-prefixed files are staging).');

const rawProducts: { file: string; index: number; raw: any }[] = [];
for (const file of productFiles) {
  const parsed = readJson(join(CONTENT, 'products', file));
  if (!Array.isArray(parsed)) fail(`products/${file} must contain a JSON array.`);
  parsed.forEach((raw, index) => rawProducts.push({ file, index, raw }));
}

// ------------------------------------------------------------ validate ----
// Everything is checked before anything is written. A half-imported catalog
// is worse than a failed import, because the feed would serve it.

const problems: string[] = [];

const nicheSlugs = new Set<string>();
const niches = (rawNiches as any[]).map((raw, i) => {
  const where = `niche ${i} (${raw?.slug ?? 'no slug'})`;
  for (const key of ['slug', 'name', 'domain', 'audience', 'tags'] as const) {
    if (typeof raw?.[key] !== 'string' || !raw[key].trim()) {
      problems.push(`${where}: missing or empty "${key}"`);
    }
  }
  if (raw?.audience && !AUDIENCES.has(raw.audience)) {
    problems.push(`${where}: audience must be one of ${[...AUDIENCES].join(', ')}`);
  }
  if (nicheSlugs.has(raw?.slug)) problems.push(`${where}: duplicate slug`);
  nicheSlugs.add(raw?.slug);
  return raw as NicheInput;
});

const productSlugs = new Set<string>();
const products = rawProducts.map(({ file, index, raw }) => {
  const where = `${file}[${index}] (${raw?.slug ?? 'no slug'})`;
  for (const key of ['slug', 'nicheSlug', 'title', 'blurb', 'sourcingType'] as const) {
    if (typeof raw?.[key] !== 'string' || !raw[key].trim()) {
      problems.push(`${where}: missing or empty "${key}"`);
    }
  }
  if (raw?.sourcingType && !SOURCING.has(raw.sourcingType)) {
    problems.push(`${where}: sourcingType must be one of ${[...SOURCING].join(', ')}`);
  }
  if (raw?.hotness !== undefined && (typeof raw.hotness !== 'number' || raw.hotness < 0 || raw.hotness > 100)) {
    problems.push(`${where}: hotness must be a number 0-100`);
  }
  // Validated rather than passed through, because the badge and the feed's top
  // shelf both switch on the exact string. A typo would not error anywhere —
  // it would just quietly stop a product ever being marked high-upside.
  if (raw?.tier !== undefined && !TIERS.has(raw.tier)) {
    problems.push(`${where}: tier must be one of ${[...TIERS].join(', ')}`);
  }
  // A nicheSlug with no niche is a hard error. The prototype silently drops
  // these (`.filter(p => p.niche)`), which hides typos — a product vanishes
  // from the feed and nothing says why.
  if (raw?.nicheSlug && !nicheSlugs.has(raw.nicheSlug)) {
    problems.push(`${where}: nicheSlug "${raw.nicheSlug}" is not in niches.json`);
  }
  // Duplicate slugs across files would make the upsert order decide which
  // one wins, which is a coin flip nobody would notice.
  if (productSlugs.has(raw?.slug)) problems.push(`${where}: duplicate slug (already seen in another file)`);
  productSlugs.add(raw?.slug);
  return raw as ProductInput;
});

if (problems.length > 0) {
  fail(`Not importing — fix these first:\n  ${problems.join('\n  ')}`);
}

// ------------------------------------------------------------- derive -----

/**
 * Both spellings of a word, singular and plural. matchScore compares tokens
 * for exact equality, so without this the onboarding option "Handmade &
 * crafts" scores zero against the "Craft & Fiber Arts" domain — one letter
 * apart, and the user's stated interest counts for nothing. Cheaper and more
 * predictable than a stemmer, and it happens on the tag side so the matcher
 * shared with the Growth feed doesn't change.
 */
function variants(word: string): string[] {
  if (word.endsWith('ies') && word.length > 4) return [word, `${word.slice(0, -3)}y`];
  if (word.endsWith('s') && !word.endsWith('ss')) return [word, word.slice(0, -1)];
  return [word, `${word}s`];
}

/**
 * Products carry no tags of their own, and the ranker needs them. Build them
 * from the niche, splitting the domain into words: matchScore requires every
 * word of a multi-word tag to be present, so "Home & Living" kept whole would
 * never match anyone's interests.
 */
function tagsFor(niche: NicheInput): string {
  const words = [
    ...niche.tags.split(',').map((t) => t.trim().toLowerCase()),
    ...niche.domain.toLowerCase().split(/[^a-z0-9]+/),
    niche.audience,
  ]
    .filter((w) => w.length > 2);
  // Single words get both spellings; multi-word tags are left alone, since
  // they already have to match in full to count for anything.
  const all = words.flatMap((w) => (w.includes(' ') ? [w] : variants(w)));
  return [...new Set(all)].join(', ');
}

function daysBetween(from?: string, to?: string): number | null {
  if (!from) return null;
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 86_400_000);
}

const clampHeat = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Machine columns. Only ever called when the JSON has a `signals` block. */
function signalColumns(s: SignalsInput, currentHeat: number | null) {
  const next = typeof s.heat === 'number' ? clampHeat(s.heat) : null;
  return {
    heat: next,
    // Only move the previous reading when the current one actually changed.
    // Re-running the importer on an unchanged file must leave the trending
    // delta alone rather than collapsing it.
    ...(next !== null && currentHeat !== null && currentHeat !== next
      ? { heatPrev: currentHeat }
      : {}),
    unitsSold: s.unitsSold ?? null,
    listings: s.listings ?? null,
    priceLow: s.priceLow ?? null,
    priceHigh: s.priceHigh ?? null,
    adCount: s.ads ?? null,
    adDaysLive: s.adDaysLive ?? null,
    adReach: s.adReach ?? null,
    adCoverage: s.adCoverage ?? null,
    interest: s.interest ?? null,
    interestTrend: s.interestTrend ?? null,
    liveSourcingUrl: s.liveSourcingUrl ?? null,
    liveMerchant: s.liveMerchant ?? null,
    ...(s.advertiserName ? { adAdvertiser: s.advertiserName, adSource: 'meta' } : {}),
    signalSources: (s.sources ?? []).join(','),
    signalsPolledAt: s.polledAt ? new Date(s.polledAt) : new Date(),
  };
}

/**
 * An ad run logged by hand at the research bench fills exactly the columns
 * Meta would. That equivalence is deliberate: it's what lets the card render
 * identically whether or not Meta ever approves API access.
 */
function researchColumns(r: ResearchInput) {
  const days = daysBetween(r.firstSeen, r.lastSeen);
  return {
    ...(days !== null ? { adDaysLive: days, adSource: 'manual' } : {}),
    ...(r.adCount ? { adCount: Number(r.adCount) } : {}),
    ...(r.adUrl?.trim() ? { adEvidenceUrl: r.adUrl.trim() } : {}),
    ...(r.advertiser?.trim() ? { adAdvertiser: r.advertiser.trim() } : {}),
  };
}

// ---------------------------------------------------------------- run -----

async function run() {
  if (dry) console.log('\x1b[33m--dry: validating and reporting, writing nothing.\x1b[0m');

  const nicheIdBySlug: Record<string, string> = {};
  let nichesWritten = 0;

  for (const n of niches) {
    const data = {
      name: n.name.trim(),
      domain: n.domain.trim(),
      audience: n.audience.trim(),
      tags: n.tags.trim(),
      imageQuery: n.imageQuery?.trim() || null,
      imageUrl: n.imageUrl?.trim() || null,
      imageCredit: n.imageCredit?.trim() || null,
      status: 'ACTIVE',
    };
    if (dry) {
      nicheIdBySlug[n.slug] = 'dry-run';
      continue;
    }
    const row = await prisma.niche.upsert({
      where: { slug: n.slug },
      create: { slug: n.slug, ...data },
      update: data,
    });
    nicheIdBySlug[n.slug] = row.id;
    nichesWritten++;
  }

  const nicheBySlug: Record<string, NicheInput> = {};
  for (const n of niches) nicheBySlug[n.slug] = n;

  let created = 0;
  let updated = 0;
  let withSignals = 0;

  for (const p of products) {
    const niche = nicheBySlug[p.nicheSlug];
    const editorial = {
      title: p.title.trim(),
      blurb: p.blurb.trim(),
      // The ranker's diversity key. Domain, not niche — 47 niches would make
      // the penalty almost never fire, and the feed sections are domains.
      category: niche.domain.trim(),
      tags: tagsFor(niche),
      nicheId: nicheIdBySlug[p.nicheSlug],
      sourcingType: p.sourcingType.trim(),
      sourceName: p.sourceName?.trim() || null,
      sourcingUrl: p.sourcingUrl?.trim() || null,
      sourceCost: p.sourceCost?.trim() || null,
      typicalResale: p.typicalResale?.trim() || null,
      imageQuery: p.imageQuery?.trim() || null,
      imageUrl: p.imageUrl?.trim() || null,
      imageCredit: p.imageCredit?.trim() || null,
      // The curator's number. Ingest writes `heat`; these never collide.
      hotness: p.hotness ?? 50,
      // Null, not 'proven', when absent — the hand-curated products are not
      // tiered, and saying they were proven would be inventing an assessment.
      tier: p.tier?.trim() || null,
      status: 'ACTIVE',
      origin: 'CATALOG',
    };

    if (dry) {
      if (p.signals) withSignals++;
      continue;
    }

    const existing = await prisma.trendProduct.findUnique({
      where: { slug: p.slug },
      select: { id: true, heat: true },
    });

    const machine = p.signals ? signalColumns(p.signals, existing?.heat ?? null) : {};
    const research = p.research ? researchColumns(p.research) : {};
    if (p.signals) withSignals++;

    await prisma.trendProduct.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, ...editorial, ...machine, ...research },
      update: { ...editorial, ...machine, ...research },
    });
    if (existing) updated++;
    else created++;
  }

  let archived = 0;
  if (archiveMissing && !dry) {
    // Scoped to catalog rows. LEGACY rows predate this importer and INGEST
    // rows were discovered rather than authored — neither is "missing from
    // the JSON" in any meaningful sense.
    const result = await prisma.trendProduct.updateMany({
      where: { slug: { notIn: [...productSlugs] }, status: 'ACTIVE', origin: 'CATALOG' },
      data: { status: 'ARCHIVED' },
    });
    archived = result.count;

    // Niches are archived, never deleted: TrendProduct.nicheId is SetNull,
    // so deleting one would quietly orphan every product under it.
    await prisma.niche.updateMany({
      where: { slug: { notIn: [...nicheSlugs] }, status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });
  }

  if (dry) {
    console.log(
      `Would import ${niches.length} niches and ${products.length} products ` +
        `(${withSignals} carrying measured signals).`
    );
    return;
  }

  const active = await prisma.trendProduct.count({
    where: { status: 'ACTIVE', origin: 'CATALOG' },
  });
  console.log(
    `Imported ${nichesWritten} niches and ${products.length} products: ` +
      `${created} created, ${updated} updated` +
      (archiveMissing ? `, ${archived} archived` : '') +
      `. ${withSignals} carry measured signals. ` +
      `Discover now has ${active} active products.`
  );
}

run()
  .catch((err) => fail(err.message))
  .finally(() => prisma.$disconnect());
