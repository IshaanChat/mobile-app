// Reddit — the one community platform with an API worth building on.
//
// Docs: https://www.reddit.com/dev/api/
//
// Why only Reddit, when the Grow feed spans nine platforms: it is the only
// one that will tell you about a community without charging for it. Checked
// live rather than assumed —
//
//   X/Twitter  The free tier was withdrawn for new developers. Since Feb 2026
//              the default is pay-per-use at $0.005 per post read with no
//              free allowance, and full-archive search is Enterprise only at
//              $42k/month. Discovering communities there is not a technical
//              problem, it is a budget one.
//   Instagram  Business/Creator accounts you own, via Graph. Nothing about
//              hashtags or other people's communities.
//   TikTok     No public API for discovery.
//   Discord    Only servers your bot is already in.
//
// So Reddit carries this, and it carries it well: 53 of the 86 curated
// communities are already subreddits, and the API returns subscriber counts
// and the actual posted rules — two fields the curator was told to leave
// empty rather than guess at.
//
// Note the anonymous JSON endpoints are gone. www.reddit.com/r/x/about.json
// answered 403 on every call; everything now goes through oauth.reddit.com
// with an app token. The credentials are free and self-serve — create a
// "script" app at reddit.com/prefs/apps and you have them in two minutes.

import type { Adapter, Signal } from '../types';

const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const API = 'https://oauth.reddit.com';

const ID = () => process.env.REDDIT_CLIENT_ID ?? '';
const SECRET = () => process.env.REDDIT_CLIENT_SECRET ?? '';

/**
 * Reddit is strict about this and will rate-limit a generic agent hard. The
 * documented format is platform:id:version (by /u/username).
 */
const UA = process.env.REDDIT_USER_AGENT
  ?? 'node:sales-mechanic:0.1 (community research)';

export const configured = () => Boolean(ID() && SECRET());

let token: { value: string; expires: number } | null = null;

export function resetToken() {
  token = null;
}

async function accessToken(): Promise<string> {
  if (token && Date.now() < token.expires) return token.value;
  const basic = Buffer.from(`${ID()}:${SECRET()}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
  });
  if (!res.ok) throw new Error(`token HTTP ${res.status}`);
  const json: any = await res.json();
  if (!json?.access_token) throw new Error(json?.error ?? 'no token');
  // A minute early, so a request already in flight cannot land past expiry.
  token = { value: json.access_token, expires: Date.now() + (Number(json.expires_in) || 3600) * 1000 - 60_000 };
  return token.value;
}

async function get(path: string): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${await accessToken()}`, 'User-Agent': UA },
  });
  if (res.status === 429) throw new Error('rate limited');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface Subreddit {
  name: string;
  title: string;
  url: string;
  subscribers: number;
  activeUsers?: number;
  /** The sidebar blurb, in the community's own words. */
  publicDescription: string;
  over18: boolean;
  /** Restricted and private subs cannot be posted in, so they are dead ends. */
  type: string;
  createdUtc?: number;
}

export function toSubreddit(raw: any): Subreddit | undefined {
  const d = raw?.data ?? raw;
  if (!d?.display_name) return undefined;
  return {
    name: d.display_name,
    title: d.title ?? d.display_name,
    url: `https://www.reddit.com/r/${d.display_name}/`,
    subscribers: Number(d.subscribers) || 0,
    activeUsers: Number(d.accounts_active) || undefined,
    publicDescription: String(d.public_description ?? '').trim(),
    over18: Boolean(d.over18),
    type: String(d.subreddit_type ?? 'public'),
    createdUtc: Number(d.created_utc) || undefined,
  };
}

/** Search subreddits by keyword. The discovery half. */
export async function searchSubreddits(query: string, limit = 25): Promise<Subreddit[]> {
  const json = await get(`/subreddits/search?q=${encodeURIComponent(query)}&limit=${limit}&include_over_18=off`);
  const children: any[] = json?.data?.children ?? [];
  return children.map(toSubreddit).filter((s): s is Subreddit => Boolean(s));
}

/** Full metadata for one subreddit. */
export async function aboutSubreddit(name: string): Promise<Subreddit | undefined> {
  const json = await get(`/r/${encodeURIComponent(name)}/about`);
  return toSubreddit(json);
}

/**
 * The posted rules, verbatim.
 *
 * The single most valuable thing this API returns for the Grow feed. The
 * schema has a `rules` field that the curator was explicitly told to fill by
 * hand, and getting it wrong is expensive in a way most content errors are
 * not — telling someone to post their shop link somewhere that bans self
 * promotion gets them banned, not ignored.
 */
export async function subredditRules(name: string): Promise<string[]> {
  const json = await get(`/r/${encodeURIComponent(name)}/about/rules`);
  const rules: any[] = json?.rules ?? [];
  return rules
    .map((r) => String(r?.short_name ?? '').trim())
    .filter(Boolean);
}

/**
 * What the place actually talks about, taken from its top posts of the year.
 *
 * Titles rather than a summary, because a summary would be invention. These
 * are what the community upvoted, which is the closest honest answer to "what
 * do they discuss" that an API can give.
 */
export async function topPostTitles(name: string, limit = 12): Promise<string[]> {
  const json = await get(`/r/${encodeURIComponent(name)}/top?t=year&limit=${limit}`);
  const children: any[] = json?.data?.children ?? [];
  return children
    .map((c) => String(c?.data?.title ?? '').trim())
    .filter(Boolean);
}

/**
 * Adapter shape, so subreddit size can feed the ingest scorer like any other
 * source. Community size is audience reach, never evidence of a sale — it
 * reports `listings` (how crowded the room is) and nothing else.
 */
export const reddit: Adapter = {
  name: 'reddit',
  configured,
  missing: () => 'REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET (reddit.com/prefs/apps — free, script app, instant)',

  async search(keyword: string): Promise<Signal[]> {
    const subs = await searchSubreddits(keyword, 10);
    if (!subs.length) return [];
    const best = subs.reduce((a, b) => (b.subscribers > a.subscribers ? b : a));
    return [
      {
        source: 'reddit',
        scope: 'category',
        productTitle: best.name,
        url: best.url,
      },
    ];
  },
};
