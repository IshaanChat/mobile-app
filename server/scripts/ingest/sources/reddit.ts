// Reddit API — how much a thing is actually being talked about, and where.
//
// Weakest of the signals on its own (talk is cheap), but it earns its place
// twice: it catches things before they show up in sales data, and the
// subreddits it names feed straight into the Growth side of the app.
//
// Docs: https://www.reddit.com/dev/api  — free, script-type app, OAuth
// client credentials. Rate limited to ~60 req/min, which is ample.

import type { Adapter, Signal } from '../types';

const ID = process.env.REDDIT_CLIENT_ID ?? '';
const SECRET = process.env.REDDIT_CLIENT_SECRET ?? '';
const UA = process.env.REDDIT_USER_AGENT ?? 'sales-mechanic/0.1 (trend ingest)';

let cachedToken: { value: string; expires: number } | null = null;

async function token(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.value;
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
      Authorization: 'Basic ' + Buffer.from(`${ID}:${SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
  });
  if (!res.ok) throw new Error(`auth HTTP ${res.status}`);
  const json: any = await res.json();
  cachedToken = { value: json.access_token, expires: Date.now() + (json.expires_in - 60) * 1000 };
  return cachedToken.value;
}

export const reddit: Adapter = {
  name: 'reddit',
  configured: () => Boolean(ID && SECRET),
  missing: () => 'REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET (reddit.com/prefs/apps — instant)',

  async search(keyword: string): Promise<Signal[]> {
    const url =
      'https://oauth.reddit.com/search?limit=50&sort=new&t=month&restrict_sr=false' +
      `&q=${encodeURIComponent(keyword)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${await token()}`, 'User-Agent': UA },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: any = await res.json();

    const posts: any[] = json?.data?.children ?? [];
    if (!posts.length) return [];

    // Comments matter more than posts — one thread with 200 replies is a
    // stronger signal than twenty ignored posts.
    const engagement = posts.reduce(
      (a, p) => a + (Number(p?.data?.num_comments) || 0) + (Number(p?.data?.score) || 0) / 10,
      0
    );

    return [
      {
        source: 'reddit',
        mentions: Math.round(posts.length + engagement / 20),
        url: `https://www.reddit.com/search/?q=${encodeURIComponent(keyword)}&sort=new`,
      },
    ];
  },
};
