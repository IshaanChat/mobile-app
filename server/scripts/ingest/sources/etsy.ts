// Etsy Open API v3 — the marketplace the handmade half of the audience
// actually sells on, which makes it a better fit here than a generic
// marketplace. Gives listing counts (saturation) and price spread.
//
// Docs: https://developers.etsy.com/documentation/reference
// A keystring alone is enough for public listing search — no OAuth dance
// needed for this endpoint.

import type { Adapter, Signal } from '../types';

const KEY = process.env.ETSY_API_KEY ?? '';

export const etsy: Adapter = {
  name: 'etsy',
  configured: () => Boolean(KEY),
  missing: () => 'ETSY_API_KEY (developers.etsy.com — instant)',

  async search(keyword: string): Promise<Signal[]> {
    const url =
      'https://openapi.etsy.com/v3/application/listings/active' +
      `?keywords=${encodeURIComponent(keyword)}&limit=25&sort_on=score`;
    const res = await fetch(url, { headers: { 'x-api-key': KEY } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: any = await res.json();

    const results: any[] = json?.results ?? [];
    if (!results.length) return [];

    // One aggregate signal: how crowded the category is, and what it sells for.
    const prices = results
      .map((r) => Number(r?.price?.amount) / Number(r?.price?.divisor || 100))
      .filter((n) => Number.isFinite(n) && n > 0);
    const median = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)];

    return [
      {
        source: 'etsy',
        productTitle: results[0]?.title,
        listings: Number(json?.count) || results.length,
        price: median,
        url: `https://www.etsy.com/search?q=${encodeURIComponent(keyword)}`,
      },
    ];
  },
};
