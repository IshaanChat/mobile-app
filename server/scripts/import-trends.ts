/**
 * Load curated trend cards into the Discover feed.
 *
 *   npm run trends:import -- content/trends.sample.json
 *   npm run trends:import -- content/trends.json --archive-missing
 *
 * Upserts by `slug`, so re-importing an edited file updates cards in place.
 * --archive-missing additionally archives every card whose slug is NOT in
 * the file, making the file the single source of truth. Nothing is ever
 * deleted: archived cards stay on the shelves of users who saved them.
 *
 * Card format: see content/README.md.
 */

import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CardInput {
  slug: string;
  title: string;
  blurb: string;
  category: string;
  tags: string;
  imageUrl?: string;
  sourceName?: string;
  sourceUrl?: string;
  priceRange?: string;
  hotness?: number;
}

function fail(message: string): never {
  console.error(`\x1b[31m${message}\x1b[0m`);
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => a !== '--');
const archiveMissing = args.includes('--archive-missing');
const file = args.find((a) => !a.startsWith('--'));
if (!file) fail('Usage: npm run trends:import -- <file.json> [--archive-missing]');

let parsed: unknown;
try {
  parsed = JSON.parse(readFileSync(file, 'utf8'));
} catch (err: any) {
  fail(`Could not read ${file}: ${err.message}`);
}
if (!Array.isArray(parsed)) fail('The file must contain a JSON array of cards.');

const REQUIRED: (keyof CardInput)[] = ['slug', 'title', 'blurb', 'category', 'tags'];
const problems: string[] = [];
const seenSlugs = new Set<string>();

const cards = (parsed as any[]).map((raw, i) => {
  for (const key of REQUIRED) {
    if (typeof raw[key] !== 'string' || !raw[key].trim()) {
      problems.push(`card ${i} (${raw.slug ?? 'no slug'}): missing or empty "${key}"`);
    }
  }
  if (raw.hotness !== undefined && (typeof raw.hotness !== 'number' || raw.hotness < 0 || raw.hotness > 100)) {
    problems.push(`card ${i} (${raw.slug}): hotness must be a number 0-100`);
  }
  if (seenSlugs.has(raw.slug)) problems.push(`card ${i}: duplicate slug "${raw.slug}"`);
  seenSlugs.add(raw.slug);
  return raw as CardInput;
});

if (problems.length > 0) {
  fail(`Not importing — fix these first:\n  ${problems.join('\n  ')}`);
}

async function run() {
  let created = 0;
  let updated = 0;

  for (const card of cards) {
    const data = {
      title: card.title.trim(),
      blurb: card.blurb.trim(),
      category: card.category.trim(),
      tags: card.tags.trim(),
      imageUrl: card.imageUrl?.trim() || null,
      sourceName: card.sourceName?.trim() || null,
      sourceUrl: card.sourceUrl?.trim() || null,
      priceRange: card.priceRange?.trim() || null,
      hotness: card.hotness ?? 50,
      status: 'ACTIVE',
    };
    const existing = await prisma.trendCard.findUnique({ where: { slug: card.slug } });
    if (existing) {
      await prisma.trendCard.update({ where: { slug: card.slug }, data });
      updated++;
    } else {
      await prisma.trendCard.create({ data: { slug: card.slug, ...data } });
      created++;
    }
  }

  let archived = 0;
  if (archiveMissing) {
    const result = await prisma.trendCard.updateMany({
      where: { slug: { notIn: [...seenSlugs] }, status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });
    archived = result.count;
  }

  const active = await prisma.trendCard.count({ where: { status: 'ACTIVE' } });
  console.log(
    `Imported ${cards.length} cards: ${created} created, ${updated} updated` +
      (archiveMissing ? `, ${archived} archived` : '') +
      `. Feed now has ${active} active cards.`
  );
}

run()
  .catch((err) => fail(err.message))
  .finally(() => prisma.$disconnect());
