/**
 * Push the curated content database into CloudKit's public database.
 *
 * The replacement for `npm run content:sync`. Same contract: `content/*.json`
 * stays the source of truth, edited by hand, and pushing is what makes it live.
 * Content still ships without an App Store release — that property is the whole
 * reason this script exists rather than baking the catalogue into the binary.
 *
 *   npm run cloudkit:push -- --dry-run    what would go, and how much
 *   npm run cloudkit:push                 send it
 *
 * Record names are content slugs, so re-running updates rather than duplicates.
 *
 * Two fields are deliberately not sent. `imageQuery` is the Pexels search term
 * used at ingest time and the app has no use for it, and `criteria` is sourcing
 * metadata that never reaches a screen. The public database quota starts at
 * 100MB and scales with active users, so during beta it is at its floor — the
 * cheapest way to stay inside it is not to ship fields nobody reads.
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { configFromEnv, pushRecords, type CloudKitRecord } from './lib/cloudkit';

const CONTENT = join(process.cwd(), 'content');
const dryRun = process.argv.includes('--dry-run');

function readJson(...parts: string[]): any {
  return JSON.parse(readFileSync(join(CONTENT, ...parts), 'utf8'));
}

/** Underscore-prefixed files are staging, not content. Loaders skip them —
 *  95 blank community cards once rendered live because one did not. */
function contentFiles(dir: string): string[] {
  return readdirSync(join(CONTENT, dir))
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .sort();
}

const records: CloudKitRecord[] = [];

// ---------------------------------------------------------------- niches

for (const niche of readJson('niches.json') as any[]) {
  records.push({
    recordName: niche.slug,
    recordType: 'Niche',
    fields: {
      name: niche.name,
      domain: niche.domain,
      audience: niche.audience,
      label: niche.label,
      imageUrl: niche.imageUrl,
      imageCredit: niche.imageCredit,
      tags: niche.tags,
    },
  });
}

// --------------------------------------------------------------- products

for (const file of contentFiles('products')) {
  for (const product of readJson('products', file) as any[]) {
    const signals = product.signals ?? {};
    records.push({
      recordName: product.slug,
      recordType: 'Product',
      fields: {
        title: product.title,
        blurb: product.blurb,
        nicheSlug: product.nicheSlug,
        sourcingType: product.sourcingType,
        sourceName: product.sourceName,
        // The AliExpress or Printful listing. A URL, not an asset — the image
        // is fetched from its own host at display time.
        sourcingUrl: product.sourcingUrl,
        sourceCost: product.sourceCost,
        sourceCategory: product.sourceCategory,
        typicalResale: product.typicalResale,
        imageUrl: product.imageUrl,
        imageCredit: product.imageCredit,
        // Two scales share this field: curated products carry measured heat
        // (~8-55), sourced ones a criteria-fit score (~78-97). Hot is a
        // percentile of the loaded feed, never a fixed threshold.
        hotness: product.hotness,
        tier: product.tier,

        // Evidence, flattened — CloudKit has no nested records, and the shape
        // is already flat and entirely optional.
        signalHeat: signals.heat,
        signalInterest: signals.interest,
        signalInterestTrend: signals.interestTrend,
        signalUnitsSold: signals.unitsSold,
        signalPriceLow: signals.priceLow,
        signalPriceHigh: signals.priceHigh,
        signalPolledAt: signals.polledAt,
        signalSources: signals.sources,
      },
    });
  }
}

// ------------------------------------------------------------ communities

for (const file of contentFiles('communities')) {
  for (const community of readJson('communities', file) as any[]) {
    records.push({
      recordName: community.slug,
      recordType: 'Community',
      fields: {
        title: community.title,
        tagline: community.tagline,
        platform: community.platform,
        kind: community.kind,
        url: community.url,
        overview: community.overview,
        audience: community.audience,
        loves: community.loves,
        dislikes: community.dislikes,
        approach: community.approach,
        rules: community.rules,
        discussions: community.discussions,
        hotness: community.hotness,
        imageUrl: community.imageUrl,
        imageCredit: community.imageCredit,
        tags: community.tags,
      },
    });
  }
}

// -------------------------------------------------------------------- tips

// The JSON calls the tab field `where`. That rename happens here and nowhere
// else, matching what import-tips.ts did.
for (const tip of readJson('tips.json').tips as any[]) {
  records.push({
    recordName: tip.id,
    recordType: 'Tip',
    fields: {
      kind: tip.kind,
      text: tip.text,
      tab: (tip.where ?? 'any').trim(),
      level: tip.level ?? 1,
    },
  });
}

// ----------------------------------------------------------------- journey

const missions = readJson('missions.json');

for (const level of missions.levels as any[]) {
  records.push({
    recordName: `level-${level.level}`,
    recordType: 'JourneyLevel',
    fields: { level: level.level, name: level.name, title: level.title },
  });
}

for (const milestone of missions.milestones as any[]) {
  records.push({
    recordName: milestone.id,
    recordType: 'Milestone',
    fields: {
      title: milestone.title,
      detail: milestone.detail,
      level: milestone.level,
      tab: milestone.tab,
      trigger: milestone.trigger,
      place: milestone.where,
      xp: milestone.xp,
    },
  });
}

for (const playbook of missions.playbooks as any[]) {
  records.push({
    recordName: playbook.id,
    recordType: 'Playbook',
    fields: { name: playbook.name, blurb: playbook.blurb, steps: playbook.steps },
  });
}

// -------------------------------------------------------------- onboarding

// One record holding the whole script as a string, deliberately. It is a nested
// tree of forks and prompts that no flat record type models well, the app
// already decodes it from JSON, and keeping it whole preserves exactly the
// current workflow: edit the file, push, live.
records.push({
  recordName: 'current',
  recordType: 'OnboardingScript',
  fields: { json: JSON.stringify(readJson('onboarding.json')) },
});

// ------------------------------------------------------------------- run

const counts = records.reduce<Record<string, number>>((acc, r) => {
  acc[r.recordType] = (acc[r.recordType] ?? 0) + 1;
  return acc;
}, {});

const bytes = Buffer.byteLength(JSON.stringify(records), 'utf8');

console.log('Records to push:');
for (const [type, n] of Object.entries(counts).sort()) {
  console.log(`  ${type.padEnd(18)} ${String(n).padStart(4)}`);
}
console.log(`  ${'TOTAL'.padEnd(18)} ${String(records.length).padStart(4)}`);
console.log(`\nPayload: ${(bytes / 1024 / 1024).toFixed(2)} MB against a 100MB floor.\n`);

async function run() {
  if (dryRun) {
    console.log('Dry run — nothing sent.');
    return;
  }

  const config = configFromEnv();
  console.log(`Pushing to ${config.container} (${config.environment})…\n`);

  const { saved, errors } = await pushRecords(config, records, (done, total) => {
    process.stdout.write(`\r  ${done}/${total}`);
  });

  console.log(`\n\nSaved ${saved}/${records.length}.`);
  if (errors.length) {
    console.error(`\n${errors.length} failed:`);
    for (const error of errors.slice(0, 20)) console.error(`  ${error}`);
    if (errors.length > 20) console.error(`  …and ${errors.length - 20} more`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
