/**
 * Fill in community images from Pexels (free, commercial-use license).
 *
 *   PEXELS_API_KEY=xxxx npm run growth:images -- content/communities.json
 *   PEXELS_API_KEY=xxxx npm run growth:images -- content/communities.json --force
 *
 * For each post WITHOUT an imageUrl, searches Pexels for a landscape photo and
 * writes the URL back into the JSON (plus `imageCredit` for the record). The
 * search term is the post's `imageQuery` if set, else its first tag — so a
 * community whose tag gives a weak image can be steered by adding an
 * `imageQuery` field. Curator-set `imageUrl` values are never overwritten
 * unless you pass --force.
 *
 * Get a free key at https://www.pexels.com/api/ (200 requests/hour is plenty).
 * The file is the single source of truth: run this, review the picks, then
 * `npm run growth:import` to load them.
 */

import { readFileSync, writeFileSync } from 'fs';

const API = 'https://api.pexels.com/v1/search';

interface Post {
  slug: string;
  title: string;
  // Communities carry tags; products rely on imageQuery instead.
  tags?: string;
  imageQuery?: string;
  imageUrl?: string;
  imageCredit?: string;
  [key: string]: unknown;
}

function fail(message: string): never {
  console.error(`\x1b[31m${message}\x1b[0m`);
  process.exit(1);
}

const key = process.env.PEXELS_API_KEY;
if (!key) {
  fail(
    'PEXELS_API_KEY is not set.\n' +
      'Get a free key at https://www.pexels.com/api/, then run:\n' +
      '  PEXELS_API_KEY=your_key npm run growth:images -- content/communities.json'
  );
}

const args = process.argv.slice(2).filter((a) => a !== '--');
const force = args.includes('--force');
const file = args.find((a) => !a.startsWith('--'));
if (!file) fail('Usage: npm run growth:images -- <file.json> [--force]');

let posts: Post[];
try {
  posts = JSON.parse(readFileSync(file, 'utf8'));
} catch (err: any) {
  fail(`Could not read ${file}: ${err.message}`);
}
if (!Array.isArray(posts)) fail('The file must contain a JSON array of posts.');

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pexelsPhoto(query: string) {
  const url = `${API}?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: key! } });
  if (res.status === 429) fail('Pexels rate limit hit — wait an hour or slow down.');
  if (!res.ok) throw new Error(`Pexels ${res.status} for "${query}"`);
  const data = (await res.json()) as {
    photos: { src: { landscape: string }; photographer: string; url: string }[];
  };
  return data.photos[0] ?? null;
}

async function run() {
  let filled = 0;
  let skipped = 0;
  let missed = 0;

  for (const post of posts) {
    if (post.imageUrl && !force) {
      skipped++;
      continue;
    }
    const query = (post.imageQuery || (post.tags || '').split(',')[0] || post.title).trim();
    try {
      const photo = await pexelsPhoto(query);
      if (!photo) {
        console.log(`  \x1b[33mno result\x1b[0m for "${query}" (${post.slug})`);
        missed++;
      } else {
        post.imageUrl = photo.src.landscape;
        post.imageCredit = `${photo.photographer} / Pexels`;
        filled++;
        console.log(`  ✓ ${post.slug} → ${query}`);
      }
    } catch (err: any) {
      console.log(`  \x1b[31m${err.message}\x1b[0m`);
      missed++;
    }
    await delay(300);
  }

  writeFileSync(file, JSON.stringify(posts, null, 2) + '\n', 'utf8');
  console.log(
    `\nDone: ${filled} images added, ${skipped} kept, ${missed} without a match. ` +
      `Review ${file}, then run: npm run growth:import -- ${file}`
  );
}

run().catch((err) => fail(err.message));
