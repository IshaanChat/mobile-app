// Fixture-driven: no network. The price statistics are the value here and
// they fail silently — a mean over untrimmed listings still returns a
// confident number, just one no seller could ever charge.

import { describe, expect, it } from 'vitest';
import { median, trimmed } from './ebay';
import { combine } from '../score';

describe('trimmed', () => {
  it('drops the outer decile, where the wrong products live', () => {
    // A search for "linen apron" returns miscategorised $3 dish towels and
    // $400 designer pieces. Both are real listings; neither is the market.
    const prices = [3, 22, 24, 25, 26, 27, 28, 29, 31, 33, 35, 400];
    const out = trimmed(prices);
    expect(out).not.toContain(3);
    expect(out).not.toContain(400);
  });

  it('leaves a short list alone rather than gutting it', () => {
    // Trimming a decile off five listings throws away real evidence.
    expect(trimmed([10, 20, 30, 40, 50])).toEqual([10, 20, 30, 40, 50]);
  });
});

describe('median', () => {
  it('takes the middle, not the cheapest', () => {
    // The bottom of any marketplace is damaged stock and loss leaders. A new
    // seller planning against that number is planning to lose.
    expect(median([10, 30, 32, 34, 200])).toBe(32);
  });

  it('averages the two middles on an even count', () => {
    expect(median([20, 30, 40, 50])).toBe(35);
  });

  it('reports nothing rather than zero on an empty list', () => {
    expect(median([])).toBeUndefined();
  });
});

describe('retail never becomes cost', () => {
  const listing = {
    source: 'ebay' as const,
    scope: 'category' as const,
    retailPrice: 34,
    listings: 90,
  };

  it('keeps a selling price out of the sourcing fields', () => {
    // The costliest possible unit error. A $34 selling price landing in
    // priceLow reads as a $34 sourcing cost — which the criteria reject as
    // unfundable, when it is in fact the good news about the product.
    const s = combine([listing]);
    expect(s.priceLow).toBeUndefined();
    expect(s.priceHigh).toBeUndefined();
    expect(s.retailLow).toBe(34);
  });

  it('works back to what the thing has to cost', () => {
    expect(combine([listing]).sourceUnder).toBeCloseTo(11.33, 2);
  });

  it('keeps both sides separate when a supplier and a marketplace both report', () => {
    const supplier = { source: 'aliexpress' as const, scope: 'supply' as const, price: 7.2 };
    const s = combine([listing, supplier]);
    expect(s.priceLow).toBe(7.2);
    expect(s.retailLow).toBe(34);
  });
});
