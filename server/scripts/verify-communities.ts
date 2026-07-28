/**
 * Check that a community actually exists, and report what it calls itself.
 *
 *   npm run communities:verify                    check every curated entry
 *   npm run communities:verify -- --add URL...    check candidates, stage the live ones
 *   npm run communities:verify -- --stale         only report problems
 *
 * Written after getting this exactly wrong by hand. Two X communities were
 * about to be dropped from consideration on the strength of news coverage
 * saying the feature had shut down. The URLs returned 200, which contradicted
 * that, and the 200 was waved away as "just the single-page-app shell"
 * without anyone looking at the response. Reading the page took one request
 * and showed live titles, live descriptions and an active sponsor.
 *
 * So the rule this encodes: a status code is not evidence a community exists,
 * and an article is not evidence it does not. The page's own metadata is.
 * Nearly every social platform still renders og: tags server-side for link
 * previews, which is the one thing a JavaScript app must expose to the
 * outside world — and it is enough to confirm a real title and description.
 *
 * This also catches the ordinary rot, which is the commoner problem: of
 * twelve candidate forums checked by hand, three were dead or moved.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const DIR = resolve(__dirname, '..', 'content', 'communities');
const STAGING = `${DIR}/_discovered.json`;

const args = process.argv.slice(2).filter((a) => a !== '--');
const STALE_ONLY = args.includes('--stale');
const ADD = (() => {
  const i = args.indexOf('--add');
  return i === -1 ? [] : args.slice(i + 1).filter((a) => a.startsWith('http'));
})();

/** A browser agent, because several platforms serve bots a stub. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export interface Probe {
  url: string;
  status: number;
  title?: string;
  description?: string;
  /** Live means: responded, and named itself. Not merely 200. */
  live: boolean;
  /** True when no automated check can ever confirm this host. */
  walled?: boolean;
  /** Publicly stated subscriber/member count, where the page gives one. */
  members?: number;
  note?: string;
}

/**
 * Hosts that refuse to identify a page to anyone who is not logged in.
 *
 * These are not broken and never will be "fixed" by retrying. Facebook is the
 * clearest case: www returns HTTP 400 to a logged-out request, and
 * mbasic.facebook.com returns a cheerful 200 whose og:title is literally
 * "Log in or sign up to view". Public group, private group, deleted group —
 * identical response. Reporting them as DEAD trains you to ignore the report,
 * which is worse than not checking at all.
 *
 * Entries on these hosts are verified the only way they can be: by a human
 * who is signed in.
 */
const LOGIN_WALLED = [/(^|\.)facebook\.com$/i, /(^|\.)instagram\.com$/i, /(^|\.)linkedin\.com$/i];

export function isWalled(url: string): boolean {
  try {
    return LOGIN_WALLED.some((re) => re.test(new URL(url).hostname));
  } catch {
    return false;
  }
}

/**
 * Pull an og: or twitter: tag, in either attribute order.
 * Real pages put `property` first; plenty of frameworks put `content` first.
 */
export function meta(html: string, prop: string): string | undefined {
  const a = html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'));
  if (a) return decode(a[1]);
  const b = html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'));
  return b ? decode(b[1]) : undefined;
}

export function decode(s: string): string {
  return s
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Subscriber or member count, where the page states one publicly.
 *
 * Telegram is the only platform in this catalog that volunteers this to a
 * logged-out request — t.me renders "9 969 277 subscribers" straight into the
 * page. That makes it the one source that can fill `memberCount` without a
 * credential or a guess, which matters because the curator was told to leave
 * that field empty rather than estimate it.
 *
 * Note the space-separated grouping: Telegram writes 1 234 567, not 1,234,567.
 */
export function memberCountOf(html: string): number | undefined {
  const m = html.match(/([\d][\d  ,.]*)\s*(?:subscribers|members)/i);
  if (!m) return undefined;
  const n = Number(m[1].replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function titleOf(html: string): string | undefined {
  const tag = decode((html.match(/<title[^>]*>([^<]*)<\/title>/i) ?? [])[1] ?? '');
  return meta(html, 'og:title') ?? meta(html, 'twitter:title') ?? (tag || undefined);
}

/**
 * Reddit is checked through old.reddit.com, and this is not a preference.
 *
 * www.reddit.com serves a logged-out request an interstitial titled "Reddit -
 * Please wait for verification" — with HTTP 200, for every path. A subreddit
 * that does not exist returns exactly the same page as one that does, so this
 * checker cheerfully passed r/thisSubredditDefinitelyDoesNotExist99xy as LIVE.
 * A verifier that confirms invented communities is worse than none, because
 * you would trust it.
 *
 * old.reddit.com has no such wall: a real subreddit returns its actual title,
 * a missing one returns 404. Same content, honest answer.
 */
export function probeUrl(url: string): string {
  try {
    const u = new URL(url);
    if (/(^|\.)reddit\.com$/i.test(u.hostname) && u.hostname !== 'old.reddit.com') {
      u.hostname = 'old.reddit.com';
      return u.toString();
    }
  } catch { /* leave it alone */ }
  return url;
}

export async function probe(url: string, attempt = 0): Promise<Probe> {
  // Short-circuit before spending a request on a host that cannot answer.
  if (isWalled(url)) {
    return { url, status: 0, live: true, walled: true, note: 'login-walled — only a signed-in human can confirm this' };
  }
  try {
    const res = await fetch(probeUrl(url), { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' }, redirect: 'follow' });
    // Rate limiting says something about how fast we asked, not about whether
    // the community exists — so back off and ask again rather than reporting
    // it either way. Surrendering on the first 429 was worse than calling it
    // dead: a sweep of 166 entries throttles partway through, and the report
    // came back with 112 entries marked "check by hand", which is not a
    // report at all.
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
      return probe(url, attempt + 1);
    }
    if (res.status === 429) {
      return { url, status: 429, live: true, walled: true, note: 'still rate-limited after backoff — re-check later' };
    }

    const html = await res.text();
    const title = titleOf(html);
    const description = meta(html, 'og:description') ?? meta(html, 'description');

    // A page that will not name itself is not confirmed, whatever it returned.
    // This is the whole point: 200 alone proved nothing.
    const named = Boolean(title && title.length > 2);

    // A bot challenge is not a dead site. Cloudflare answers 403 with a page
    // titled "Just a moment..."; several real platforms sit behind one. Left
    // as walled rather than dead, because retrying will never change it.
    const challenged = /just a moment|attention required|enable javascript|access denied|forbidden|verifying your connection|checking your browser|please wait/i.test(title ?? '')
      || (res.status === 403 && !named);
    if (challenged) {
      return { url, status: res.status, title, live: true, walled: true, note: 'bot-challenged — reachable in a browser, not by this check' };
    }

    // Search and tag URLs are a legitimate community kind here (#hashtag
    // feeds, YouTube queries) and by their nature name a query rather than a
    // page. Absence of a title says nothing about whether they work.
    const isQuery = /[?&](q|search_query|keyword)=/i.test(url);
    if (res.ok && !named && isQuery) {
      return { url, status: res.status, live: true, walled: true, note: 'search URL — nothing to name, check by hand' };
    }

    const members = memberCountOf(html);
    return {
      url,
      status: res.status,
      title,
      description: description?.slice(0, 180),
      ...(members ? { members } : {}),
      live: res.ok && named,
      note: !res.ok ? `HTTP ${res.status}` : !named ? 'responded but names nothing — cannot confirm' : undefined,
    };
  } catch (err: any) {
    return { url, status: 0, live: false, note: err.message?.slice(0, 60) ?? 'unreachable' };
  }
}

const platformOf = (url: string): string => {
  const h = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  if (h.endsWith('x.com') || h.endsWith('twitter.com')) return 'X';
  if (h.endsWith('reddit.com')) return 'Reddit';
  if (h.endsWith('pinterest.com')) return 'Pinterest';
  if (h.endsWith('instagram.com')) return 'Instagram';
  if (h.endsWith('tiktok.com')) return 'TikTok';
  if (h.endsWith('facebook.com')) return 'Facebook';
  if (h.endsWith('discord.com') || h.endsWith('discord.gg') || h.endsWith('disboard.org')) return 'Discord';
  if (h.endsWith('etsy.com')) return 'Etsy';
  if (h.endsWith('youtube.com')) return 'YouTube';
  if (h === 't.me' || h.endsWith('telegram.org') || h.endsWith('tgstat.com')) return 'Telegram';
  return 'Forum';
};

const slugFor = (url: string, title: string) =>
  (platformOf(url).toLowerCase() + '-' + title.toLowerCase())
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 52);

async function main() {
  const targets: string[] = ADD.length
    ? ADD
    : readdirSync(DIR)
        .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
        .flatMap((f) => JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')))
        .map((c: any) => c.url)
        .filter(Boolean);

  console.log(`\x1b[1mVerifying ${targets.length} communities\x1b[0m\n`);
  const results: Probe[] = [];
  for (const url of targets) {
    const p = await probe(url);
    results.push(p);
    if (!(STALE_ONLY && p.live)) {
      const mark = p.walled ? '\x1b[36mWALL\x1b[0m' : p.live ? '\x1b[32mLIVE\x1b[0m' : '\x1b[31mDEAD\x1b[0m';
      const members = p.members ? `  ${p.members.toLocaleString('en-US')}` : '';
      console.log(`${mark} ${String(p.status).padStart(3)}  ${(p.title ?? p.note ?? '').slice(0, 52).padEnd(54)}${members.padStart(12)}  ${url.slice(0, 52)}`);
    }
    // 400ms provoked Reddit's throttle partway through a 166-entry sweep.
    await new Promise((r) => setTimeout(r, 700));
  }

  const dead = results.filter((r) => !r.live);
  const walled = results.filter((r) => r.walled).length;
  console.log(
    `\n${results.length - dead.length - walled} live` +
      (walled ? `, \x1b[36m${walled} login-walled (check by hand)\x1b[0m` : '') +
      `, \x1b[31m${dead.length} need attention\x1b[0m`
  );

  if (ADD.length) {
    const staged: any[] = existsSync(STAGING) ? JSON.parse(readFileSync(STAGING, 'utf8')) : [];
    const known = new Set(staged.map((s) => s.url));
    let added = 0;
    for (const r of results) {
      if (!r.live || r.walled || known.has(r.url)) continue;
      staged.push({
        slug: slugFor(r.url, r.title!),
        title: r.title!,
        platform: platformOf(r.url),
        kind: 'community',
        url: r.url,
        // Their own words about themselves, quoted rather than rewritten.
        tagline: r.description ?? '',
        // Only ever a number the page stated itself — never an estimate.
        ...(r.members ? { memberCount: r.members } : {}),
        // Blank on purpose — no page metadata reports what wins a room over,
        // and a plausible guess at it is the one thing this catalog will not
        // ship. See communities.ts for the same reasoning.
        audience: '', overview: '', discussions: '', loves: '', dislikes: '', rules: '', approach: '',
        tags: '',
        needsWriteUp: ['audience', 'overview', 'discussions', 'loves', 'dislikes', 'rules', 'approach'],
        verifiedAt: new Date().toISOString().slice(0, 10),
      });
      known.add(r.url);
      added++;
    }
    writeFileSync(STAGING, JSON.stringify(staged, null, 2) + '\n');
    console.log(`\nStaged ${added} new (${staged.length} total) in communities/_discovered.json.`);
  }
}

main().catch((err) => {
  console.error('\x1b[31m' + err.message + '\x1b[0m');
  process.exit(1);
});
