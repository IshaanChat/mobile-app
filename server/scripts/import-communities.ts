/**
 * Load curated community posts into the Growth feed.
 *
 *   npm run growth:import                            # all of content/communities/
 *   npm run growth:import -- content/communities     # same, explicitly
 *   npm run growth:import -- one-niche.json          # a single file
 *   npm run growth:import -- --archive-missing       # make the folder authoritative
 *
 * Takes a directory or a single file, and defaults to the directory. It used
 * to require one file, which was true when the content was `communities.json`
 * — it is now eleven files under `content/communities/`, so a full load meant
 * eleven invocations.
 *
 * That mattered more than ergonomics. `--archive-missing` archives every slug
 * it did not just see, so running it per-file archived the other ten niches
 * every time. Defaulting to the whole directory makes the dangerous flag safe
 * by making the set it compares against complete.
 *
 * Underscore-prefixed files are staging, not content, and are skipped — the
 * same convention the preview loader uses. `_discovered.json` holds verified
 * candidates whose write-ups are deliberately empty.
 *
 * Post format: see content/README.md.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
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

const DEFAULT_DIR = 'content/communities';

const args = process.argv.slice(2).filter((a) => a !== '--');
const archiveMissing = args.includes('--archive-missing');
// Validate and report without touching the database. Worth having for its own
// sake — the validation is the strict part, and being able to run it against
// hand-edited JSON before pointing anything at a live database is the
// difference between a typo being caught and a typo being deployed.
const dryRun = args.includes('--dry-run');
const target = args.find((a) => !a.startsWith('--')) ?? DEFAULT_DIR;

/** Every content file the target covers. A directory expands; a file is itself. */
function filesFor(path: string): string[] {
  let isDir = false;
  try {
    isDir = statSync(path).isDirectory();
  } catch (err: any) {
    fail(`Could not read ${path}: ${err.message}`);
  }
  if (!isDir) return [path];

  const found = readdirSync(path)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .sort()
    .map((f) => join(path, f));
  if (!found.length) fail(`No importable .json files in ${path} (underscore-prefixed files are staging).`);
  return found;
}

const files = filesFor(target);

// Each file is parsed and validated on its own so an error names the file it
// came from, but they are imported as one set — which is what makes
// --archive-missing safe.
const parsedAll: any[] = [];
for (const f of files) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(f, 'utf8'));
  } catch (err: any) {
    fail(`Could not read ${f}: ${err.message}`);
  }
  if (!Array.isArray(parsed)) fail(`${f} must contain a JSON array of posts.`);
  for (const post of parsed as any[]) parsedAll.push({ ...post, __file: f });
}
const parsed: unknown = parsedAll;

if (archiveMissing && files.length === 1 && statSync(target).isFile()) {
  fail(
    'Refusing to --archive-missing from a single file: it would archive every ' +
      'community not in that one file. Point it at the directory instead.'
  );
}

const REQUIRED: (keyof PostInput)[] = ['slug', 'title', 'platform', 'kind', 'url', 'tagline', 'audience', 'overview', 'discussions', 'loves', 'dislikes', 'rules', 'approach', 'tags'];
const KINDS = new Set(['community', 'hashtag', 'marketplace', 'search', 'event']);
const problems: string[] = [];
const seenSlugs = new Set<string>();

const posts = (parsed as any[]).map((raw, i) => {
  // Errors name the file, not just the index. With eleven files loaded at once
  // "post 7" is not enough to find anything.
  const where = `${raw.__file} post ${i} (${raw.slug ?? 'no slug'})`;
  for (const key of REQUIRED) {
    if (typeof raw[key] !== 'string' || !raw[key].trim()) {
      problems.push(`${where}: missing or empty "${key}"`);
    }
  }
  if (raw.kind && !KINDS.has(raw.kind)) {
    problems.push(`${where}: kind must be one of ${[...KINDS].join(', ')}`);
  }
  if (raw.hotness !== undefined && (typeof raw.hotness !== 'number' || raw.hotness < 0 || raw.hotness > 100)) {
    problems.push(`${where}: hotness must be a number 0-100`);
  }
  // A slug collision across two niche files would silently make one overwrite
  // the other, so this check matters more now than when there was one file.
  if (seenSlugs.has(raw.slug)) problems.push(`${where}: duplicate slug "${raw.slug}"`);
  seenSlugs.add(raw.slug);
  return raw as PostInput;
});

if (problems.length > 0) {
  fail(`Not importing — fix these first:\n  ${problems.join('\n  ')}`);
}

async function run() {
  if (dryRun) {
    const byFile = new Map<string, number>();
    for (const p of posts as any[]) byFile.set(p.__file, (byFile.get(p.__file) ?? 0) + 1);
    console.log(`Validated ${posts.length} posts across ${files.length} file(s). Nothing written.`);
    for (const [f, n] of byFile) console.log(`  ${n.toString().padStart(4)}  ${f}`);
    if (archiveMissing) {
      console.log('\n--archive-missing would archive any ACTIVE slug not in the list above.');
    }
    return;
  }

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
    `Imported ${posts.length} posts from ${files.length} file${files.length === 1 ? '' : 's'}: ` +
      `${created} created, ${updated} updated` +
      (archiveMissing ? `, ${archived} archived` : '') +
      `. Growth feed now has ${active} active posts.`
  );
}

run()
  .catch((err) => fail(err.message))
  .finally(() => prisma.$disconnect());
