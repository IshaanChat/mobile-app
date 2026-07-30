/**
 * Load curated tips into the database.
 *
 *   npm run tips:import                      # content/tips.json
 *   npm run tips:import -- --dry-run         # validate, write nothing
 *   npm run tips:import -- --archive-missing # make the file authoritative
 *
 * Same contract as the catalog and community importers: upsert by slug,
 * nothing is ever deleted, and --archive-missing is what makes the file the
 * single source of truth.
 *
 * The JSON calls the tab field `where`; the column is `tab`, because WHERE is a
 * SQL reserved word. That mapping happens here and nowhere else.
 *
 * Tip format: see content/tips.json, which documents its own fields in a
 * `_comment` array. Keys starting with `_` are notes to whoever edits the file
 * and are not content.
 */

import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_FILE = 'content/tips.json';
const KINDS = new Set(['know', 'lift']);
const TABS = new Set(['discover', 'grow', 'shop', 'you', 'any']);

interface TipInput {
  id: string;
  kind: string;
  text: string;
  where?: string;
  level?: number;
}

function fail(message: string): never {
  console.error(`\x1b[31m${message}\x1b[0m`);
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => a !== '--');
const archiveMissing = args.includes('--archive-missing');
const dryRun = args.includes('--dry-run');
const file = args.find((a) => !a.startsWith('--')) ?? DEFAULT_FILE;

let doc: any;
try {
  doc = JSON.parse(readFileSync(file, 'utf8'));
} catch (err: any) {
  fail(`Could not read ${file}: ${err.message}`);
}
if (!Array.isArray(doc?.tips)) fail(`${file} must have a "tips" array.`);

const problems: string[] = [];
const seen = new Set<string>();

const tips = (doc.tips as any[]).map((raw, i) => {
  const where = `tip ${i} (${raw.id ?? 'no id'})`;
  if (typeof raw.id !== 'string' || !raw.id.trim()) problems.push(`${where}: missing "id"`);
  if (typeof raw.text !== 'string' || !raw.text.trim()) problems.push(`${where}: missing "text"`);
  if (!KINDS.has(raw.kind)) problems.push(`${where}: kind must be one of ${[...KINDS].join(', ')}`);
  if (raw.where !== undefined && !TABS.has(raw.where)) {
    problems.push(`${where}: where must be one of ${[...TABS].join(', ')}`);
  }
  if (raw.level !== undefined && (!Number.isInteger(raw.level) || raw.level < 1)) {
    problems.push(`${where}: level must be a whole number >= 1`);
  }
  // The bubble clamps to a fixed number of lines and clips silently, which is
  // worse than not having said the thing. Measured ceiling is 90 characters at
  // 375px; 80 is the guidance. Warn rather than fail — the clamp depends on the
  // rendered width, so this is a smell, not a certainty.
  if (typeof raw.text === 'string' && raw.text.length > 90) {
    console.warn(`\x1b[33m  warning: ${where} is ${raw.text.length} chars and will clip\x1b[0m`);
  }
  if (seen.has(raw.id)) problems.push(`${where}: duplicate id "${raw.id}"`);
  seen.add(raw.id);
  return raw as TipInput;
});

if (problems.length > 0) fail(`Not importing — fix these first:\n  ${problems.join('\n  ')}`);

async function run() {
  if (dryRun) {
    const byKind = tips.reduce<Record<string, number>>((acc, t) => {
      acc[t.kind] = (acc[t.kind] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`Validated ${tips.length} tips from ${file}. Nothing written.`);
    for (const [k, n] of Object.entries(byKind)) console.log(`  ${String(n).padStart(4)}  ${k}`);
    return;
  }

  let created = 0;
  let updated = 0;

  for (const tip of tips) {
    const data = {
      kind: tip.kind.trim(),
      text: tip.text.trim(),
      tab: (tip.where ?? 'any').trim(),
      level: tip.level ?? 1,
      status: 'ACTIVE',
    };
    const existing = await prisma.tip.findUnique({ where: { slug: tip.id } });
    if (existing) {
      await prisma.tip.update({ where: { slug: tip.id }, data });
      updated++;
    } else {
      await prisma.tip.create({ data: { slug: tip.id, ...data } });
      created++;
    }
  }

  let archived = 0;
  if (archiveMissing) {
    const result = await prisma.tip.updateMany({
      where: { slug: { notIn: [...seen] }, status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });
    archived = result.count;
  }

  const active = await prisma.tip.count({ where: { status: 'ACTIVE' } });
  console.log(
    `Imported ${tips.length} tips: ${created} created, ${updated} updated` +
      (archiveMissing ? `, ${archived} archived` : '') +
      `. ${active} active.`
  );
}

run()
  .catch((err) => fail(err.message))
  .finally(() => prisma.$disconnect());
