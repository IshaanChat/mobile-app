// Meta Ad Library — the ad-pressure axis, and the only ad source here that
// is an official, documented API rather than a scraper.
//
// Docs: https://developers.facebook.com/docs/graph-api/reference/ads_archive/
//
// COVERAGE, and it shapes everything downstream: `ad_reached_countries` is
// required, and outside the EU only political and social-issue ads are
// returned. Commercial coverage is therefore EU-reaching ads — the DSA
// repository. That is a systematic bias, not merely less data: what shows up
// is what EU-targeting advertisers are pushing. Every signal is stamped
// `adCoverage: 'EU'` so the card can say so rather than implying the world.
//
// ACCESS is a real gate. The token needs identity verification and app
// review, and Meta's stated categories are political research, academic
// research and journalism — product research for sellers is none of those.
// Approval is not assured, so nothing here is on the critical path: with no
// token the adapter reports unconfigured and the research bench fills the
// same columns by hand.
//
// RATE LIMIT is ~200 calls/hour and pagination counts, hence the per-run
// budget in run.ts rather than trusting a delay between calls.

import type { Adapter, Signal } from '../types';

const GRAPH = 'https://graph.facebook.com/v21.0/ads_archive';

// `impressions` and `spend` are political-only. Requesting them makes the
// whole call fail for commercial queries, which is a confusing way to find
// out, so they are deliberately absent.
const FIELDS = [
  'id',
  'page_id',
  'page_name',
  'ad_delivery_start_time',
  'ad_delivery_stop_time',
  'ad_creative_bodies',
  'ad_creative_link_titles',
  'ad_creative_link_captions',
  'ad_snapshot_url',
  'eu_total_reach',
].join(',');

const token = () => process.env.META_ACCESS_TOKEN ?? '';
const countries = () => (process.env.META_COUNTRIES ?? 'DE,FR,NL,IE,ES,IT').split(',');

interface MetaAd {
  page_name?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_captions?: string[];
  ad_snapshot_url?: string;
  eu_total_reach?: number;
}

export function daysBetween(from?: string, to?: string): number {
  if (!from) return 0;
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000);
}

/**
 * Only count an ad whose creative actually contains every word of the
 * keyword. Meta's own relevance matching is loose enough that "mug" returns a
 * slice of the entire inventory, and an ad count built on that is a number
 * with no meaning attached to it. Same all-words rule the ranker uses.
 */
export function matchesKeyword(ad: MetaAd, keyword: string): boolean {
  const words = keyword.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return false;
  const text = [
    ...(ad.ad_creative_bodies ?? []),
    ...(ad.ad_creative_link_titles ?? []),
  ]
    .join(' ')
    .toLowerCase();
  if (!text.trim()) return false;
  return words.every((w) => text.includes(w));
}

/**
 * One aggregate signal, not one per ad — the same shape Etsy returns. An ad
 * is a creative, and there is no join key from a creative back to a catalog
 * product, so the honest claim is about the keyword's market: "this much
 * money is being spent pushing this phrase right now". The advertiser and
 * the snapshot go along as links a human can open and judge; nothing from
 * the creative is ever written into product copy.
 */
export function toSignals(ads: MetaAd[], keyword: string): Signal[] {
  const matched = ads.filter((a) => matchesKeyword(a, keyword));
  if (!matched.length) return [];

  const runs = matched.map((a) => daysBetween(a.ad_delivery_start_time, a.ad_delivery_stop_time));
  const longest = Math.max(...runs);
  const best = matched[runs.indexOf(longest)];

  const reach = matched
    .map((a) => Number(a.eu_total_reach))
    .filter((n) => Number.isFinite(n) && n > 0)
    .reduce((a, b) => a + b, 0);

  return [
    {
      source: 'meta',
      scope: 'category',
      ads: matched.length,
      adDaysLive: longest,
      ...(reach > 0 ? { adReach: reach } : {}),
      adCoverage: 'EU',
      ...(best.page_name ? { advertiserName: best.page_name } : {}),
      ...(best.ad_creative_link_captions?.[0]
        ? { advertiserDomain: best.ad_creative_link_captions[0] }
        : {}),
      ...(best.ad_snapshot_url ? { url: best.ad_snapshot_url } : {}),
    },
  ];
}

export const meta: Adapter = {
  name: 'meta',
  configured: () => Boolean(token()),
  missing: () =>
    'META_ACCESS_TOKEN (facebook.com/ads/library/api — ID verification + app review, approval not guaranteed)',

  async search(keyword: string): Promise<Signal[]> {
    const params = new URLSearchParams({
      access_token: token(),
      search_terms: keyword.slice(0, 100), // hard limit in the API
      ad_reached_countries: JSON.stringify(countries()),
      ad_active_status: 'ALL',
      ad_type: 'ALL',
      fields: FIELDS,
      limit: '50',
    });

    const res = await fetch(`${GRAPH}?${params}`);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // 613 is the rate limit. Worth naming, because the fix is to wait or
      // lower META_CALLS_PER_RUN, not to go looking for a bug.
      throw new Error(`HTTP ${res.status}${body.includes('613') ? ' (rate limited)' : ''}`);
    }
    const json: any = await res.json();
    return toSignals(json?.data ?? [], keyword);
  },
};
