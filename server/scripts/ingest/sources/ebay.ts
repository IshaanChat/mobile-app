// eBay Browse API — competing listings and the price band buyers actually
// see. Sold-item history lives behind the restricted Marketplace Insights
// API, so this contributes saturation and pricing rather than sales.
//
// Docs: https://developer.ebay.com/api-docs/buy/browse/overview.html
// Free developer account, no sales threshold. Client-credentials OAuth.

import type { Adapter, Signal } from '../types';

const ID = process.env.EBAY_CLIENT_ID ?? '';
const SECRET = process.env.EBAY_CLIENT_SECRET ?? '';
const MARKET = process.env.EBAY_MARKETPLACE ?? 'EBAY_US';

let cachedToken: { value: string; expires: number } | null = null;

async function token(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.value;
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${ID}:${SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }).toString(),
  });
  if (!res.ok) throw new Error(`auth HTTP ${res.status}`);
  const json: any = await res.json();
  cachedToken = { value: json.access_token, expires: Date.now() + (json.expires_in - 60) * 1000 };
  return cachedToken.value;
}

export const ebay: Adapter = {
  name: 'ebay',
  configured: () => Boolean(ID && SECRET),
  missing: () => 'EBAY_CLIENT_ID / EBAY_CLIENT_SECRET (developer.ebay.com — instant)',

  async search(keyword: string): Promise<Signal[]> {
    const res = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(keyword)}&limit=25`,
      {
        headers: {
          Authorization: `Bearer ${await token()}`,
          'X-EBAY-C-MARKETPLACE-ID': MARKET,
        },
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: any = await res.json();

    const items: any[] = json?.itemSummaries ?? [];
    const prices = items
      .map((i) => Number(i?.price?.value))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);

    return [
      {
        source: 'ebay',
        productTitle: items[0]?.title,
        listings: Number(json?.total) || items.length,
        price: prices.length ? prices[Math.floor(prices.length / 2)] : undefined,
        url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}`,
      },
    ];
  },
};
