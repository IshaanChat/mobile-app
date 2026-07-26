// Wikimedia Pageviews — how many people are reading about this right now.
//
// Docs: https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/
//
// The only source here that needs no credential of any kind: no key, no
// signup, no OAuth. That matters more than it sounds. Every other adapter is
// gated behind an approval that can be slow (AliExpress, Etsy) or refused
// outright (Meta), and until one lands the catalog has no measured evidence
// at all. This one works today, for all 188 products.
//
// It also solves the trending cold start. Every other source reports a level,
// so "is this climbing?" needs two polls a day apart before it can mean
// anything. Pageviews come back as a dated series, so the trend is there in
// the first response.
//
// What it is NOT: evidence anyone bought anything. Reading about macramé and
// buying macramé are different acts, and the scorer weights this accordingly.

import type { Adapter, Signal } from '../types';

const BASE = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article';

// Wikimedia asks for a descriptive User-Agent and blocks clients that send
// nothing useful. This is the etiquette for a free service, and the one thing
// most likely to get us cut off.
const UA = 'SalesMechanic/0.1 (https://github.com/IshaanChat/sales-mechanic; product trend research)';

/** Days per comparison window. Two of these make the trend. */
const WINDOW = 30;
/**
 * The API takes about a day to populate, so the window ends two days back.
 * Reading up to "today" would compare a full window against a half-empty one
 * and report everything as collapsing.
 */
const LAG_DAYS = 2;

const stamp = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
const mean = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0);

/**
 * One entry per title per run. 47 niches back 188 products, so asking
 * per-product would be a fourfold waste of somebody else's free service.
 */
const cache = new Map<string, Signal[]>();

export function resetCache() {
  cache.clear();
}

/**
 * `nudge` widens the window by a day or two on retry. This looks like
 * superstition and isn't: the endpoint returns 404 for a real article on one
 * call and 200 for the identical range on the next, at roughly a coin flip.
 * Verified against `Soap` — 404, 200, 200, 404, 200 across adjacent start
 * dates, with `Pottery` returning 200 throughout on the same ranges. Moving
 * the boundary changes the upstream cache key and shakes it loose.
 */
export function windowFor(now = new Date(), nudge = 0): { start: string; end: string } {
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() - LAG_DAYS);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (WINDOW * 2 - 1) - nudge);
  return { start: stamp(start), end: stamp(end) };
}

interface Item {
  timestamp: string;
  views: number;
}

/**
 * Mean daily views, and how the recent half compares with the one before it.
 * Returned as a ratio: 1.35 means a third more attention than last month.
 */
export function summarise(items: Item[]): { interest: number; interestTrend?: number } {
  const views = items.map((i) => Number(i.views) || 0);
  const interest = Math.round(mean(views));

  // Needs both halves to be genuinely populated. A short series would divide
  // a real number by an accident of how long the article has existed.
  if (views.length < WINDOW * 2 - 4) return { interest };

  const prior = mean(views.slice(0, WINDOW));
  const recent = mean(views.slice(-WINDOW));
  if (prior <= 0) return { interest };

  return { interest, interestTrend: Number((recent / prior).toFixed(3)) };
}

export const wikipedia: Adapter = {
  name: 'wikipedia',
  // No credential exists to be missing.
  configured: () => true,
  missing: () => '',

  async search(title: string): Promise<Signal[]> {
    const key = title.trim();
    if (!key) return [];
    const hit = cache.get(key);
    if (hit) return hit;

    // Wikipedia titles use underscores for spaces, and the rest still needs
    // encoding — "Rock 'n' roll" is a real article.
    const article = encodeURIComponent(key.replace(/\s+/g, '_'));

    // Retried hard, because caching a transient 404 would silently blank a
    // whole niche for the run — the worst kind of failure, since a missing
    // signal is indistinguishable from a subject nobody reads about. At a
    // coin-flip failure rate five attempts leaves about a 3% chance of
    // wrongly giving up. It also rate-limits after roughly twenty rapid
    // requests, so 429 backs off the same way.
    let items: Item[] = [];
    let lastStatus = 0;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { start, end } = windowFor(new Date(), attempt);
      const url = `${BASE}/en.wikipedia/all-access/all-agents/${article}/daily/${start}/${end}`;
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      lastStatus = res.status;

      if (res.ok) {
        const json: any = await res.json();
        items = json?.items ?? [];
        break;
      }
      if (res.status === 429 || res.status === 404) {
        // Linear backoff. The limit is generous once you stop hammering it.
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      throw new Error(`HTTP ${res.status}`);
    }

    if (!items.length) {
      // Three 404s in a row is a title that genuinely isn't an article —
      // worth caching so the run doesn't retry it for every product in the
      // niche, and worth the curator's attention in the run output.
      if (lastStatus === 404) console.warn(`  \x1b[33mwikipedia: no article "${key}"\x1b[0m`);
      cache.set(key, []);
      return [];
    }

    const { interest, interestTrend } = summarise(items);
    const signals: Signal[] = [
      {
        source: 'wikipedia',
        // Stamped over by safeSearch. Pageviews describe a subject, never a
        // listing — nobody reads an article about one seller's mug.
        scope: 'category',
        interest,
        ...(interestTrend !== undefined ? { interestTrend } : {}),
        url: `https://en.wikipedia.org/wiki/${article}`,
      },
    ];
    cache.set(key, signals);
    return signals;
  },
};
