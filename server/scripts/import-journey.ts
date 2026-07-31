/**
 * Load the journey — levels, milestones and playbooks — into the database.
 *
 *   npm run journey:import
 *   npm run journey:import -- --dry-run
 *
 * Source: content/missions.json, the same file the localhost prototype reads.
 * Until now nothing imported it, so the five-level journey existed only in the
 * prototype and /api/missions served a different, older model.
 *
 * Same contract as the other importers: upsert by slug, nothing deleted, and
 * everything validated before anything is written.
 *
 * Milestones are NOT deleted when they disappear from the file. A completion
 * references a slug, and removing the row it points at would silently erase
 * somebody's progress. Orphans are reported instead so the decision stays a
 * human one.
 */

import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FILE = 'content/missions.json';
const WHERE = new Set(['in-app', 'outside']);

interface LevelInput {
  level: number;
  name: string;
  title: string;
}

interface MilestoneInput {
  id: string;
  level: number;
  title: string;
  detail: string;
  where: string;
  trigger?: string;
  tab?: string;
  xp?: number;
}

interface PlaybookInput {
  id: string;
  name: string;
  blurb: string;
  steps: string[];
}

function fail(message: string): never {
  console.error(`\x1b[31m${message}\x1b[0m`);
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');

let doc: any;
try {
  doc = JSON.parse(readFileSync(FILE, 'utf8'));
} catch (err: any) {
  fail(`Could not read ${FILE}: ${err.message}`);
}

const levels: LevelInput[] = doc.levels ?? [];
const milestones: MilestoneInput[] = doc.milestones ?? [];
const playbooks: PlaybookInput[] = doc.playbooks ?? [];

// ---------------------------------------------------------------- validate --

const problems: string[] = [];
const levelNumbers = new Set<number>();

for (const [i, l] of levels.entries()) {
  if (!Number.isInteger(l.level)) problems.push(`level ${i}: level must be a whole number`);
  if (!l.name?.trim()) problems.push(`level ${i}: missing name`);
  if (!l.title?.trim()) problems.push(`level ${i}: missing title`);
  if (levelNumbers.has(l.level)) problems.push(`level ${l.level}: duplicate`);
  levelNumbers.add(l.level);
}

// Levels gate sequentially, so a gap would make everything past it
// permanently unreachable — level 4 can never unlock if level 3 does not exist.
const sorted = [...levelNumbers].sort((a, b) => a - b);
for (let i = 0; i < sorted.length; i++) {
  if (sorted[i] !== i + 1) {
    problems.push(
      `levels must run 1..n with no gaps (found ${sorted.join(', ')}) — ` +
        'a gap makes every level past it unreachable, since each unlocks the next'
    );
    break;
  }
}

const slugs = new Set<string>();
const perLevel = new Map<number, number>();

for (const [i, m] of milestones.entries()) {
  const where = `milestone ${i} (${m.id ?? 'no id'})`;
  if (!m.id?.trim()) problems.push(`${where}: missing id`);
  if (!m.title?.trim()) problems.push(`${where}: missing title`);
  if (!m.detail?.trim()) problems.push(`${where}: missing detail`);
  if (!WHERE.has(m.where)) problems.push(`${where}: where must be "in-app" or "outside"`);
  if (!levelNumbers.has(m.level)) problems.push(`${where}: level ${m.level} does not exist`);
  if (m.where === 'in-app' && !m.trigger?.trim()) {
    problems.push(`${where}: in-app milestones need a trigger, or nothing can ever complete them`);
  }
  if (m.xp !== undefined && (!Number.isInteger(m.xp) || m.xp < 0)) {
    problems.push(`${where}: xp must be a whole number >= 0`);
  }
  if (slugs.has(m.id)) problems.push(`${where}: duplicate id "${m.id}"`);
  slugs.add(m.id);
  perLevel.set(m.level, (perLevel.get(m.level) ?? 0) + 1);
}

// A level with no milestones completes the instant it unlocks, which silently
// skips it and makes the level count a lie.
for (const n of levelNumbers) {
  if (!perLevel.get(n)) problems.push(`level ${n} has no milestones — it would auto-complete`);
}

const playbookSlugs = new Set<string>();
for (const [i, p] of playbooks.entries()) {
  const where = `playbook ${i} (${p.id ?? 'no id'})`;
  if (!p.id?.trim()) problems.push(`${where}: missing id`);
  if (!p.name?.trim()) problems.push(`${where}: missing name`);
  if (!Array.isArray(p.steps) || p.steps.length === 0) problems.push(`${where}: needs steps`);
  for (const step of p.steps ?? []) {
    if (!slugs.has(step)) problems.push(`${where}: step "${step}" is not a milestone id`);
  }
  if (playbookSlugs.has(p.id)) problems.push(`${where}: duplicate id`);
  playbookSlugs.add(p.id);
}

if (problems.length) fail(`Not importing — fix these first:\n  ${problems.join('\n  ')}`);

// ------------------------------------------------------------------- write --

async function run() {
  if (dryRun) {
    console.log(`Validated ${levels.length} levels, ${milestones.length} milestones, ${playbooks.length} playbooks. Nothing written.`);
    for (const l of [...levels].sort((a, b) => a.level - b.level)) {
      console.log(`  L${l.level} ${l.name.padEnd(10)} ${String(perLevel.get(l.level) ?? 0).padStart(2)} milestones — ${l.title}`);
    }
    const outside = milestones.filter((m) => m.where === 'outside').length;
    console.log(`  ${milestones.length - outside} in-app, ${outside} outside the app`);
    return;
  }

  const levelIdByNumber = new Map<number, string>();
  for (const l of levels) {
    const row = await prisma.journeyLevel.upsert({
      where: { level: l.level },
      update: { name: l.name.trim(), title: l.title.trim() },
      create: { level: l.level, name: l.name.trim(), title: l.title.trim() },
    });
    levelIdByNumber.set(l.level, row.id);
  }

  // Position is the file's own order. It is what the journey is read in, and
  // sorting alphabetically or by id would scramble a deliberate sequence.
  const positionInLevel = new Map<number, number>();
  let created = 0;
  let updated = 0;

  for (const m of milestones) {
    const position = positionInLevel.get(m.level) ?? 0;
    positionInLevel.set(m.level, position + 1);

    const data = {
      title: m.title.trim(),
      detail: m.detail.trim(),
      where: m.where,
      trigger: m.trigger?.trim() || null,
      tab: m.tab?.trim() || null,
      xp: m.xp ?? 10,
      position,
      levelId: levelIdByNumber.get(m.level)!,
    };

    const existing = await prisma.milestone.findUnique({ where: { slug: m.id } });
    if (existing) {
      await prisma.milestone.update({ where: { slug: m.id }, data });
      updated++;
    } else {
      await prisma.milestone.create({ data: { slug: m.id, ...data } });
      created++;
    }
  }

  for (const [i, p] of playbooks.entries()) {
    const data = {
      name: p.name.trim(),
      blurb: p.blurb?.trim() ?? '',
      steps: p.steps.join(','),
      position: i,
    };
    await prisma.playbook.upsert({
      where: { slug: p.id },
      update: data,
      create: { slug: p.id, ...data },
    });
  }

  // Milestones in the database that the file no longer mentions.
  //
  // Reported, never deleted: completions reference a slug, so removing the row
  // would erase progress somebody earned. Whether an old step should disappear
  // is an editorial decision, not something an importer should make silently.
  const orphans = await prisma.milestone.findMany({
    where: { slug: { notIn: [...slugs] } },
    select: { slug: true },
  });

  console.log(
    `Imported ${levels.length} levels, ${milestones.length} milestones ` +
      `(${created} created, ${updated} updated), ${playbooks.length} playbooks.`
  );
  if (orphans.length) {
    console.log(
      `\n\x1b[33m${orphans.length} milestone(s) in the database are no longer in ${FILE}:\x1b[0m`
    );
    orphans.forEach((o) => console.log(`  ${o.slug}`));
    console.log('Left in place — completions point at these slugs. Remove by hand if intended.');
  }
}

run()
  .catch((err) => fail(err.message))
  .finally(() => prisma.$disconnect());
