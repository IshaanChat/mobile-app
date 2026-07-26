// Turning a signal into a product row. Extracted from the runner so the
// riskiest part of the pipeline — writing entries that have to satisfy the
// same schema as the hand-written ones — can be tested without a network.

import type { Signals, Signal } from './types';

export const slugify = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 52);

export const money = (n?: number) =>
  typeof n === 'number' && n > 0 ? '$' + n.toFixed(2) : '';

/** Supplier titles are keyword soup — "2024 New Hot Sale Ceramic Mug, 350ml,
 *  Free Shipping | Gift". Take the first clause and cap it. */
export function cleanTitle(raw: string): string {
  const first = raw.split(/[,|(\/]/)[0];
  return first
    .replace(/\b(20\d\d|new|hot sale|free shipping|dropshipping|wholesale)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 70);
}

/** Written from the numbers, never from anyone's marketing copy. */
export function describe(s: Signals, resale?: string): string {
  const bits: string[] = [];
  if (s.unitsSold) bits.push(`${s.unitsSold.toLocaleString('en-US')} sold recently`);
  if (s.priceLow) bits.push(`sourcing around ${money(s.priceLow)}`);
  if (s.listings !== undefined) {
    bits.push(
      s.listings < 120
        ? 'and barely anyone selling it yet'
        : s.listings < 600
          ? `with about ${s.listings} competing listings`
          : `though it's crowded — roughly ${s.listings.toLocaleString('en-US')} sellers already`
    );
  }
  const lead = bits.length ? bits.join(', ') + '.' : 'Surfaced by the trend feed.';
  return resale ? `${lead} Comparable listings sell for ${resale}.` : lead;
}

export function resaleBand(unitCost?: number): string {
  if (!unitCost || unitCost <= 0) return '';
  return `$${(unitCost * 3).toFixed(0)}–${(unitCost * 5).toFixed(0)}`;
}

/** Must match the shape of every hand-written entry in content/products/. */
export function buildProduct(hit: Signal, nicheSlug: string, signals: Signals) {
  const title = cleanTitle(hit.productTitle ?? '');
  const resale = resaleBand(hit.price);
  return {
    slug: slugify(title),
    nicheSlug,
    title,
    blurb: describe(signals, resale),
    sourcingType: 'DROPSHIP',
    sourceName: 'AliExpress',
    sourcingUrl: hit.url ?? '',
    sourceCost: money(hit.price),
    typicalResale: resale,
    hotness: signals.heat,
    imageQuery: title,
    imageUrl: hit.imageUrl ?? '',
    imageCredit: hit.imageUrl ? 'AliExpress listing' : '',
    signals,
  };
}
