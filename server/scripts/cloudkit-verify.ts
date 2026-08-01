/**
 * Reads the public database back and checks it against the content files.
 *
 *   npm run cloudkit:verify
 *
 * The counterpart to `cloudkit:push`. A push reporting "saved" only means
 * CloudKit accepted the writes; this proves the records are queryable, which is
 * a different thing and the one the app depends on. A record type whose
 * `___recordID` is not QUERYABLE stores fine and lists as empty.
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { configFromEnv, queryRecords } from './lib/cloudkit';
import { SCHEMA } from './lib/cloudkit-schema';

const CONTENT = join(process.cwd(), 'content');

function readJson(...parts: string[]): any {
  return JSON.parse(readFileSync(join(CONTENT, ...parts), 'utf8'));
}

function countIn(dir: string): number {
  return readdirSync(join(CONTENT, dir))
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .reduce((n, f) => n + (readJson(dir, f) as any[]).length, 0);
}

const missions = readJson('missions.json');

const expected: Record<string, number> = {
  Niche: (readJson('niches.json') as any[]).length,
  Product: countIn('products'),
  Community: countIn('communities'),
  Tip: (readJson('tips.json').tips as any[]).length,
  JourneyLevel: missions.levels.length,
  Milestone: missions.milestones.length,
  Playbook: missions.playbooks.length,
  OnboardingScript: 1,
};

async function run() {
  const config = configFromEnv();
  console.log(`Reading ${config.container} (${config.environment})\n`);

  let bad = 0;
  for (const recordType of Object.keys(SCHEMA)) {
    const records = await queryRecords(config, recordType);
    const want = expected[recordType] ?? 0;
    const ok = records.length === want;
    if (!ok) bad += 1;
    console.log(
      `  ${ok ? '✓' : '✗'} ${recordType.padEnd(18)} ${String(records.length).padStart(4)} / ${want}`
    );
  }

  // Spot-check one product end to end. Counts matching proves delivery; this
  // proves the fields survived, which is what a screen actually needs.
  const products = await queryRecords(config, 'Product');
  const sample = products.find((p) => p.fields.sourcingUrl?.value);
  if (sample) {
    console.log(`\nSample — ${sample.recordName}`);
    for (const key of ['title', 'nicheSlug', 'hotness', 'tier', 'sourcingUrl', 'imageUrl']) {
      const value = String(sample.fields[key]?.value ?? '—');
      console.log(`  ${key.padEnd(13)} ${value.slice(0, 68)}`);
    }
  } else {
    console.log('\nNo product carried a sourcingUrl — the AliExpress links did not survive.');
    bad += 1;
  }

  console.log(bad === 0 ? '\nAll record types match the content files.' : `\n${bad} mismatched.`);
  if (bad > 0) process.exit(1);
}

run().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
