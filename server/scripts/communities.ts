/**
 * Reddit community discovery and refresh for the Grow feed.
 *
 *   npm run communities                  refresh stats on every Reddit entry
 *   npm run communities -- --discover    find NEW subreddits per niche
 *   npm run communities -- --niche pets  one niche
 *   npm run communities -- --dry         show changes, write nothing
 *   npm run communities -- --min 5000    subscriber floor for discovery
 *
 * Two jobs, deliberately separate.
 *
 * REFRESH is the one that runs forever. It re-polls every subreddit already
 * in content/communities/ and updates the two fields that go stale and that
 * a curator cannot honestly maintain by hand: subscriber count and the
 * posted rules. Nothing else is touched — the voice of each write-up is the
 * curator's and this must never overwrite it.
 *
 * DISCOVER finds candidates and writes them to a staging file. It does NOT
 * write into the curated set, because it cannot: the schema requires
 * audience, overview, loves, dislikes and approach, and not one of those is
 * derivable from an API. Reddit will tell you a subreddit's size and its
 * rules. It will not tell you what wins those people over. Generating that
 * from a sidebar blurb would be inventing the most load-bearing content in
 * the app — the part a beginner actually acts on.
 *
 * So discovery fills what is real, leaves the judgement fields empty, and
 * hands you a list to write up.
 */

try {
  process.loadEnvFile();
} catch {
  /* no .env — the environment may already carry the keys */
}

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  configured, searchSubreddits, aboutSubreddit, subredditRules, topPostTitles, type Subreddit,
} from './ingest/sources/reddit';

const DIR = resolve(__dirname, '..', 'content');
const COMMUNITIES = `${DIR}/communities`;
const STAGING = `${COMMUNITIES}/_discovered.json`;

const args = process.argv.slice(2).filter((a) => a !== '--');
const has = (f: string) => args.includes(f);
const valueOf = (f: string) => {
  const i = args.indexOf(f);
  return i !== -1 ? args[i + 1] : undefined;
};

const DISCOVER = has('--discover');
const DRY = has('--dry');
const ONLY_NICHE = valueOf('--niche');
/** Below this a subreddit is too quiet to be worth sending anyone to. */
const MIN_SUBS = Number(valueOf('--min')) || 3000;
/** Above this it is a default-subscribed megasub where a small seller vanishes. */
const MAX_SUBS = Number(valueOf('--max')) || 3_000_000;
const PER_NICHE = Number(valueOf('--limit')) || 4;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Reddit allows 100 requests a minute for OAuth clients. Stay well under. */
const PACE = 900;

const slugify = (s: string) => 'reddit-' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function communityFiles(): string[] {
  return readdirSync(COMMUNITIES).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
}
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

/** The subreddit name out of a stored url, whatever shape it was written in. */
export function subredditOf(url: string): string | undefined {
  const m = String(url ?? '').match(/reddit\.com\/r\/([A-Za-z0-9_]+)/i);
  return m?.[1];
}

/**
 * Is this a place a small seller can actually use?
 *
 * Size alone is a poor filter in both directions. A 40-subscriber subreddit
 * is a ghost town, and r/funny at 40 million is a firehose nobody will see
 * you in — the useful range is narrower than "big".
 */
export function usable(s: Subreddit): { ok: boolean; why?: string } {
  if (s.over18) return { ok: false, why: 'NSFW' };
  if (s.type !== 'public') return { ok: false, why: `${s.type} — cannot post` };
  if (s.subscribers < MIN_SUBS) return { ok: false, why: `${s.subscribers} subscribers — too quiet` };
  if (s.subscribers > MAX_SUBS) return { ok: false, why: `${s.subscribers.toLocaleString('en-US')} — too big to be seen in` };
  return { ok: true };
}

/**
 * A staged entry: everything Reddit can tell us, and blanks where judgement
 * is required. The blanks are the point — an empty `approach` is a visible
 * to-do, whereas a plausible generated one is a silent fabrication.
 */
function stage(s: Subreddit, rules: string[], titles: string[], nicheSlug: string, tags: string) {
  return {
    slug: slugify(s.name),
    title: `r/${s.name}`,
    platform: 'Reddit',
    kind: 'community',
    url: s.url,
    nicheSlug,
    tags,
    // Their own one-line description of themselves. Left as-is and marked as
    // theirs rather than rewritten into our voice on their behalf.
    tagline: s.publicDescription.slice(0, 160),
    memberCount: s.subscribers,
    // Verbatim from /about/rules. The one field where being wrong gets a user
    // banned rather than ignored, so it is never paraphrased.
    rules: rules.join('\n'),
    // What the room upvoted this year. Evidence of what it talks about, not a
    // summary of it.
    discussions: titles.slice(0, 8).join('\n'),
    // Deliberately empty. No API reports these and guessing them would be
    // inventing exactly the content a beginner acts on.
    audience: '',
    overview: '',
    loves: '',
    dislikes: '',
    approach: '',
    needsWriteUp: ['audience', 'overview', 'loves', 'dislikes', 'approach'],
    discoveredAt: new Date().toISOString().slice(0, 10),
  };
}

async function refresh() {
  let touched = 0, missing = 0;
  for (const f of communityFiles()) {
    const path = `${COMMUNITIES}/${f}`;
    const list = readJson(path);
    let changed = false;

    for (const c of list) {
      if (c.platform !== 'Reddit') continue;
      const name = subredditOf(c.url);
      if (!name) continue;
      try {
        const s = await aboutSubreddit(name);
        await delay(PACE);
        if (!s) { console.log(`  \x1b[33m? r/${name} — not found\x1b[0m`); missing++; continue; }

        const before = c.memberCount;
        c.memberCount = s.subscribers;

        // Rules are refreshed only when the curator has not written their own.
        // Overwriting a hand-written rules block with a bare list of rule
        // names would lose real editing work to a routine stats job.
        if (!String(c.rules ?? '').trim()) {
          const rules = await subredditRules(name);
          await delay(PACE);
          if (rules.length) c.rules = rules.join('\n');
        }

        changed = true;
        touched++;
        const move = before ? ` (was ${Number(before).toLocaleString('en-US')})` : '';
        console.log(`  \x1b[32m✓\x1b[0m r/${name} — ${s.subscribers.toLocaleString('en-US')} members${move}`);
      } catch (err: any) {
        console.log(`  \x1b[31mx r/${name} — ${err.message}\x1b[0m`);
      }
    }
    if (changed && !DRY) writeFileSync(path, JSON.stringify(list, null, 2) + '\n');
  }
  console.log(`\n${DRY ? 'Would update' : 'Updated'} ${touched} communities.` + (missing ? ` ${missing} not found.` : ''));
}

async function discover() {
  const niches = readJson(`${DIR}/niches.json`).filter((n: any) => !ONLY_NICHE || n.slug === ONLY_NICHE);
  if (!niches.length) { console.error('No niche matched ' + ONLY_NICHE); process.exit(1); }

  // Everything already curated OR already staged, so a re-run does not
  // re-propose the same subreddits every time.
  const known = new Set<string>();
  for (const f of communityFiles()) {
    for (const c of readJson(`${COMMUNITIES}/${f}`)) {
      const n = subredditOf(c.url);
      if (n) known.add(n.toLowerCase());
    }
  }
  const staged: any[] = existsSync(STAGING) ? readJson(STAGING) : [];
  for (const c of staged) {
    const n = subredditOf(c.url);
    if (n) known.add(n.toLowerCase());
  }

  let added = 0;
  for (const niche of niches) {
    const seed = String(niche.tags ?? '').split(',')[0].trim() || niche.name;
    console.log(`\n\x1b[1m${niche.name}\x1b[0m  (${seed})`);
    let found: Subreddit[] = [];
    try {
      found = await searchSubreddits(seed, 25);
      await delay(PACE);
    } catch (err: any) {
      console.log(`  \x1b[31mx search failed — ${err.message}\x1b[0m`);
      continue;
    }

    let kept = 0;
    for (const s of found) {
      if (kept >= PER_NICHE) break;
      if (known.has(s.name.toLowerCase())) continue;
      const check = usable(s);
      if (!check.ok) { console.log(`  \x1b[90m· r/${s.name} — ${check.why}\x1b[0m`); continue; }

      try {
        const rules = await subredditRules(s.name);
        await delay(PACE);
        const titles = await topPostTitles(s.name);
        await delay(PACE);
        staged.push(stage(s, rules, titles, niche.slug, niche.tags ?? ''));
        known.add(s.name.toLowerCase());
        kept++; added++;
        console.log(`  \x1b[32m+\x1b[0m r/${s.name} — ${s.subscribers.toLocaleString('en-US')} members, ${rules.length} rules`);
      } catch (err: any) {
        console.log(`  \x1b[31mx r/${s.name} — ${err.message}\x1b[0m`);
      }
    }
  }

  if (!DRY) writeFileSync(STAGING, JSON.stringify(staged, null, 2) + '\n');
  console.log(
    `\n${DRY ? 'Would stage' : 'Staged'} ${added} new communities (${staged.length} total) in communities/_discovered.json.\n` +
      `Each needs audience, overview, loves, dislikes and approach written before it can move into the feed —\n` +
      `Reddit reports size and rules, it does not report what wins a room over.`
  );
}

async function main() {
  if (!configured()) {
    console.error(
      '\x1b[31mNo Reddit credentials.\x1b[0m\n' +
        'Create a "script" app at https://www.reddit.com/prefs/apps (free, instant), then set\n' +
        'REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in server/.env.\n' +
        'Optionally REDDIT_USER_AGENT — Reddit rate-limits generic agents hard.'
    );
    process.exit(1);
  }
  console.log(`\x1b[1mCommunities\x1b[0m — ${DISCOVER ? 'discovering' : 'refreshing stats'}` +
    (ONLY_NICHE ? ` · niche ${ONLY_NICHE}` : '') + (DRY ? ' · dry run' : ''));
  if (DISCOVER) await discover();
  else await refresh();
}

main().catch((err) => {
  console.error('\x1b[31m' + err.message + '\x1b[0m');
  process.exit(1);
});
