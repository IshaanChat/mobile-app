// YouTube Data API — interest, measured by how much people are watching
// other people talk about a product. Not purchase intent, but a genuine
// leading indicator: review videos appear before a product peaks.
//
// Docs: https://developers.google.com/youtube/v3/docs/search/list
// Free daily quota via Google Cloud console. Each search costs 100 units of
// the 10,000/day allowance, so a full run over ~50 keywords is comfortable.

import type { Adapter, Signal } from '../types';

const KEY = process.env.YOUTUBE_API_KEY ?? '';

export const youtube: Adapter = {
  name: 'youtube',
  configured: () => Boolean(KEY),
  missing: () => 'YOUTUBE_API_KEY (console.cloud.google.com — instant)',

  async search(keyword: string): Promise<Signal[]> {
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const searchUrl =
      'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10' +
      `&publishedAfter=${since}&q=${encodeURIComponent(keyword + ' review')}&key=${KEY}`;
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: any = await res.json();
    if (json.error) throw new Error(json.error.message);

    const ids = (json.items ?? []).map((i: any) => i?.id?.videoId).filter(Boolean);
    if (!ids.length) return [];

    // The search endpoint doesn't return view counts — a second call does.
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(',')}&key=${KEY}`
    );
    if (!statsRes.ok) throw new Error(`stats HTTP ${statsRes.status}`);
    const stats: any = await statsRes.json();

    const views = (stats.items ?? []).reduce(
      (a: number, v: any) => a + (Number(v?.statistics?.viewCount) || 0),
      0
    );

    return [
      {
        source: 'youtube',
        views,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword + ' review')}`,
      },
    ];
  },
};
