// CJ Affiliate (Commission Junction) — real merchant listings, real prices.
//
// Docs: https://developers.cj.com/  ·  GraphQL at ads.api.cj.com/query
//
// The best credential-to-value ratio available: one free publisher account
// gets a Personal Access Token covering product feeds from 15,000+
// advertisers, and product search returns advertisers you have NOT joined.
// Merchant approval gates commission, not reading — so the catalog is
// useful from the moment the account exists, and the money comes later.
//
// What it is: a catalog. Prices, images, merchants, live links.
// What it is NOT: a sales figure. CJ knows what is listed, never what sold.
// `unitsSold` is deliberately never set here no matter the scope, because
// the difference between "somebody sells this" and "somebody bought this"
// is the whole basis of the ranking.
//
// The published rate limits could not be confirmed from public docs, so
// this shares the per-run budget guard Meta uses until a live token shows
// what the real numbers are.

import type { Adapter, Signal } from '../types';

const ENDPOINT = 'https://ads.api.cj.com/query';

const token = () => process.env.CJ_ACCESS_TOKEN ?? '';
const companyId = () => process.env.CJ_COMPANY_ID ?? '';

/**
 * `shoppingProducts` is the feed that spans advertisers you haven't joined,
 * which is what makes this useful before any merchant has approved you.
 */
const QUERY = `
  query Search($companyId: ID!, $keyword: String!, $limit: Int!) {
    shoppingProducts(companyId: $companyId, keyword: $keyword, limit: $limit) {
      totalCount
      resultList {
        title
        price { amount currency }
        imageLink
        link
        advertiserName
        brand
      }
    }
  }
`;

interface CjProduct {
  title?: string;
  price?: { amount?: number | string; currency?: string };
  imageLink?: string;
  link?: string;
  advertiserName?: string;
  brand?: string;
}

/**
 * The median, not the mean. Merchant feeds routinely carry a bulk lot or a
 * single accessory next to the real product, and one $900 outlier would drag
 * a mean far enough to make the cost→resale line on the card a lie.
 */
export function medianPrice(products: CjProduct[]): number | undefined {
  const prices = products
    .map((p) => Number(p?.price?.amount))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (!prices.length) return undefined;
  return prices[Math.floor(prices.length / 2)];
}

/**
 * One aggregate signal, like Etsy and Meta. The individual listings are not
 * the point — what the catalog is worth here is the going rate, how many
 * merchants carry this kind of thing, and one live link a human can open.
 */
export function toSignals(data: any): Signal[] {
  const node = data?.shoppingProducts;
  const products: CjProduct[] = node?.resultList ?? [];
  if (!products.length) return [];

  const price = medianPrice(products);
  // The best listing to link is the first with somewhere to actually go.
  const linkable = products.find((p) => p.link) ?? products[0];

  return [
    {
      source: 'cj',
      // Overwritten by safeSearch with the runner's intent. A merchant feed
      // describes a market, not one seller's item.
      scope: 'category',
      productTitle: linkable.title,
      // Advertisers carrying the category. A weaker saturation measure than
      // Etsy's, which counts sellers of the same handmade thing, so where
      // both report, `combine` takes the larger and Etsy usually wins.
      ...(typeof node?.totalCount === 'number' ? { listings: node.totalCount } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(linkable.imageLink ? { imageUrl: linkable.imageLink } : {}),
      ...(linkable.link ? { liveSourcingUrl: linkable.link } : {}),
      ...(linkable.advertiserName || linkable.brand
        ? { liveMerchant: linkable.advertiserName ?? linkable.brand }
        : {}),
    },
  ];
}

export const cj: Adapter = {
  name: 'cj',
  configured: () => Boolean(token() && companyId()),
  missing: () => 'CJ_ACCESS_TOKEN / CJ_COMPANY_ID (cj.com/publisher — free, then developers.cj.com)',

  async search(keyword: string): Promise<Signal[]> {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { companyId: companyId(), keyword, limit: 25 },
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: any = await res.json();
    // GraphQL answers 200 with an errors array, so a failure here would
    // otherwise read as "this keyword has no products".
    if (json?.errors?.length) throw new Error(json.errors[0]?.message ?? 'GraphQL error');

    return toSignals(json?.data);
  },
};
