/**
 * Load curated community posts into the Growth feed.
 *
 *   npm run growth:import -- content/communities.json
 *   npm run growth:import -- content/communities.json --archive-missing
 *
 * Same contract as trends:import — upsert by slug, nothing deleted,
 * --archive-missing makes the file the single source of truth.
 *
 * Post format: see content/README.md.
 */

import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PostInput {
  slug: string;
  title: string;
  platform: string;
  kind: string;
  url: string;
  tagline: string;
  audience: string;
  overview: string;
  discussions: string;
  loves: string;
  dislikes: string;
  rules: string;
  approach: string;
  tags: string;
  imageUrl?: string;
  memberCount?: number;
  hotness?: number;
}

function fail(message: string): never {
  console.error(`\x1b[31m${message}\x1b[0m`);
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => a !== '--');
const archiveMissing = args.includes('--archive-missing');
const file = args.find((a) => !a.startsWith('--'));
if (!file) fail('Usage: npm run growth:import -- <file.json> [--archive-missing]');

let parsed: unknown;
try {
  parsed = JSON.parse(readFileSync(file, 'utf8'));
} catch (err: any) {
  fail(`Could not read ${file}: ${err.message}`);
}
if (!Array.isArray(parsed)) fail('The file must contain a JSON array of posts.');

const REQUIRED: (keyof PostInput)[] = ['slug', 'title', 'platform', 'kind', 'url', 'tagline', 'audience', 'overview', 'discussions', 'loves', 'dislikes', 'rules', 'approach', 'tags'];
const KINDS = new Set(['community', 'hashtag', 'marketplace', 'search', 'event']);
const problems: string[] = [];
const seenSlugs = new Set<string>();

const posts = (parsed as any[]).map((raw, i) => {
  for (const key of REQUIRED) {
    if (typeof raw[key] !== 'string' || !raw[key].trim()) {
      problems.push(`post ${i} (${raw.slug ?? 'no slug'}): missing or empty "${key}"`);
    }
  }
  if (raw.kind && !KINDS.has(raw.kind)) {
    problems.push(`post ${i} (${raw.slug}): kind must be one of ${[...KINDS].join(', ')}`);
  }
  if (raw.hotness !== undefined && (typeof raw.hotness !== 'number' || raw.hotness < 0 || raw.hotness > 100)) {
    problems.push(`post ${i} (${raw.slug}): hotness must be a number 0-100`);
  }
  if (seenSlugs.has(raw.slug)) problems.push(`post ${i}: duplicate slug "${raw.slug}"`);
  seenSlugs.add(raw.slug);
  return raw as PostInput;
});

if (problems.length > 0) {
  fail(`Not importing — fix these first:\n  ${problems.join('\n  ')}`);
}

async function run() {
  let created = 0;
  let updated = 0;

  for (const post of posts) {
    const data = {
      title: post.title.trim(),
      platform: post.platform.trim(),
      kind: post.kind.trim(),
      url: post.url.trim(),
      tagline: post.tagline.trim(),
      audience: post.audience.trim(),
      overview: post.overview.trim(),
      discussions: post.discussions.trim(),
      loves: post.loves.trim(),
      dislikes: post.dislikes.trim(),
      rules: post.rules.trim(),
      approach: post.approach.trim(),
      tags: post.tags.trim(),
      imageUrl: post.imageUrl?.trim() || null,
      memberCount: post.memberCount ?? null,
      hotness: post.hotness ?? 50,
      status: 'ACTIVE',
    };
    const existing = await prisma.communityPost.findUnique({ where: { slug: post.slug } });
    if (existing) {
      await prisma.communityPost.update({ where: { slug: post.slug }, data });
      updated++;
    } else {
      await prisma.communityPost.create({ data: { slug: post.slug, ...data } });
      created++;
    }
  }

  let archived = 0;
  if (archiveMissing) {
    const result = await prisma.communityPost.updateMany({
      where: { slug: { notIn: [...seenSlugs] }, status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });
    archived = result.count;
  }

  const active = await prisma.communityPost.count({ where: { status: 'ACTIVE' } });
  console.log(
    `Imported ${posts.length} posts: ${created} created, ${updated} updated` +
      (archiveMissing ? `, ${archived} archived` : '') +
      `. Growth feed now has ${active} active posts.`
  );
}

run()
  .catch((err) => fail(err.message))
  .finally(() => prisma.$disconnect());
