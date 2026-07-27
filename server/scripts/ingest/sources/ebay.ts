// eBay Browse — what things actually sell for.
//
// Docs: https://developer.ebay.com/api-docs/buy/browse/overview.html
//
// eBay was in this pipeline once and was removed, for a reason worth quoting
// back: "its median price is used and mass-produced stock, and feeding that
// into typicalResale for a hand-thrown mug is worse than showing no number at
// all." That was correct. It is also entirely scoped to the maker catalog.
//
// For the reseller lane the same property is the point. Somebody sourcing
// goods to flip IS selling used and mass-produced stock, and wants to know
// what that stock clears for — the objection inverts into the argument. So
// this runs on DROPSHIP and WHOLESALE rows only, and never touches the four
// fifths of the catalog that is things people make.
//
// Why it is here at all: sourcing cost is gated everywhere, because it is the
// only real moat in this business. Retail prices are public, because
// marketplaces want them indexed. Rather than wait on supplier credentials,
// take the public number and let criteria.ts work back to what the thing has
// to cost. And unlike the supplier APIs, eBay's keys are self-serve — you
// create an app and get credentials immediately, with no approval queue.
//
// What it reports: `retailPrice`, never `price`. The distinction is load
// bearing; see the field comment in types.ts.

import type { Adapter, Signal } from '../types';

const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';

// Read lazily, for the same reason the other adapters do: TypeScript hoists
// the emitted requires above every statement, so a module-scope read happens
// before run.ts calls loadEnvFile().
const ID = () => process.env.EBAY_CLIENT_ID ?? '';
const SECRET = () => process.env.EBAY_CLIENT_SECRET ?? '';
/** EBAY_US unless told otherwise; the marketplace decides the currency. */
const MARKET = () => process.env.EBAY_MARKETPLACE ?? 'EBAY_US';

/** Application tokens last two hours; one per run is plenty. */
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
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }).toString(),
  });
  if (!res.ok) throw new Error(`token HTTP ${res.status}`);
  const json: any = await res.json();
  if (!json?.access_token) throw new Error(json?.error_description ?? 'no token');

  // Expire a minute early rather than exactly on time, so a request already
  // in flight cannot land on the far side of the boundary.
  token = { value: json.access_token, expires: Date.now() + (Number(json.expires_in) || 7200) * 1000 - 60_000 };
  return token.value;
}

/**
 * The middle of the range, not the cheapest.
 *
 * The bottom of any eBay search is damaged stock, wrong-item listings and
 * loss leaders. A new seller planning against that number is planning to
 * lose, so the median is the honest figure to hand them.
 */
export function median(ns: number[]): number | undefined {
  const sorted = ns.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!sorted.length) return undefined;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Trim the tails before taking a price.
 *
 * A search for "linen apron" returns $3 dish towels miscategorised and $400
 * designer pieces. Both are real listings and neither is the market. Dropping
 * the outer decile leaves the band a seller would actually compete in.
 */
export function trimmed(ns: number[]): number[] {
  const sorted = ns.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (sorted.length < 10) return sorted;
  const cut = Math.floor(sorted.length / 10);
  return sorted.slice(cut, sorted.length - cut);
}

export const ebay: Adapter = {
  name: 'ebay',
  configured: () => Boolean(ID() && SECRET()),
  missing: () => 'EBAY_CLIENT_ID / EBAY_CLIENT_SECRET (developer.ebay.com — self-serve, no approval queue)',

  async search(keyword: string): Promise<Signal[]> {
    const key = keyword.trim();
    if (!key) return [];

    const url = `${SEARCH_URL}?q=${encodeURIComponent(key)}&limit=50`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        'X-EBAY-C-MARKETPLACE-ID': MARKET(),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: any = await res.json();

    const items: any[] = json?.itemSummaries ?? [];
    if (!items.length) return [];

    const prices = trimmed(items.map((i) => Number(i?.price?.value)));
    const mid = median(prices);
    if (mid === undefined) return [];

    const withImage = items.find((i) => i?.image?.imageUrl);

    // One aggregate signal, not fifty. The question this answers is "what
    // does this kind of thing sell for", which is a property of the market
    // rather than of any one listing — and returning fifty would let a single
    // keyword swamp every other source in combine().
    return [
      {
        source: 'ebay',
        // Stamped over by safeSearch. Named here for the same reason the
        // others are: a search result describes a market, not one product.
        scope: 'category',
        retailPrice: Number(mid.toFixed(2)),
        // eBay reports the full match count, which is the honest competition
        // number — how many sellers a beginner would be listing against.
        listings: Number(json?.total) || items.length,
        url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(key)}`,
        ...(withImage ? { imageUrl: withImage.image.imageUrl } : {}),
      },
    ];
  },
};
