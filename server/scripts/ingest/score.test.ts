import { describe, expect, it } from 'vitest';
import { adPressure, combine, saturationOf, squash } from './score';
import type { Signal } from './types';

/** Defaults to product scope; tests that care about scope say so. */
const s = (partial: Partial<Signal>): Signal => ({
  source: 'aliexpress',
  scope: 'product',
  ...partial,
});

describe('squash', () => {
  it('is 0 for nothing and rises with magnitude', () => {
    expect(squash(0, 1000)).toBe(0);
    expect(squash(-5, 1000)).toBe(0);
    expect(squash(100, 1000)).toBeGreaterThan(0);
    expect(squash(1000, 1000)).toBeGreaterThan(squash(100, 1000));
  });

  it('rewards an order of magnitude more than a doubling', () => {
    const doubling = squash(2000, 3000) - squash(1000, 3000);
    const orderOfMagnitude = squash(10_000, 3000) - squash(1000, 3000);
    expect(orderOfMagnitude).toBeGreaterThan(doubling * 2);
  });
});

describe('the scope gate', () => {
  it('refuses to read units sold from a supply-scoped signal', () => {
    // 4,200 pots of glaze sold is not 4,200 mugs sold. This is the whole
    // reason scope exists.
    const glaze = combine([s({ scope: 'supply', unitsSold: 4200, price: 6 })]);
    expect(glaze.unitsSold).toBeUndefined();
  });

  it('still keeps the price a supply signal reports', () => {
    // The materials cost is the honest thing that search DOES tell us.
    const glaze = combine([s({ scope: 'supply', unitsSold: 4200, price: 6 })]);
    expect(glaze.priceLow).toBe(6);
  });

  it('refuses units sold from a category-scoped signal too', () => {
    const market = combine([s({ scope: 'category', unitsSold: 9000 })]);
    expect(market.unitsSold).toBeUndefined();
  });

  it('scores a supply-only product below one with real sales', () => {
    const supply = combine([s({ scope: 'supply', unitsSold: 4200 })]);
    const real = combine([s({ scope: 'product', unitsSold: 4200 })]);
    expect(supply.heat).toBeLessThan(real.heat);
  });
});

describe('combine', () => {
  it('takes the best listing rather than adding them up', () => {
    // One search returns many listings of the same product. Summing them
    // invented a number many times too big; the best seller is the answer.
    const many = combine([
      s({ unitsSold: 1000 }),
      s({ unitsSold: 500 }),
      s({ unitsSold: 300 }),
    ]);
    expect(many.unitsSold).toBe(1000);
  });

  it('rates real sales above ad pressure alone', () => {
    const sales = combine([s({ unitsSold: 4000 })]);
    const ads = combine([s({ source: 'meta', scope: 'category', ads: 6, adDaysLive: 14 })]);
    expect(sales.heat).toBeGreaterThan(ads.heat);
  });

  it('does not punish a product for sources that stayed silent', () => {
    const alone = combine([s({ unitsSold: 3000 })]);
    const corroborated = combine([
      s({ unitsSold: 3000 }),
      s({ source: 'meta', scope: 'category', ads: 4, adDaysLive: 30 }),
    ]);
    expect(alone.heat).toBeGreaterThan(40);
    expect(corroborated.heat).toBeGreaterThan(40);
  });

  it('penalises a crowded market', () => {
    const crowded = combine([s({ unitsSold: 2000 }), s({ source: 'etsy', scope: 'category', listings: 5000 })]);
    const clear = combine([s({ unitsSold: 2000 }), s({ source: 'etsy', scope: 'category', listings: 20 })]);
    expect(crowded.heat).toBeLessThan(clear.heat);
  });

  it('gives a marketplace-only product a floor above nothing at all', () => {
    // Four fifths of the catalog can never report unitsSold. Without this
    // rung they would all cap at the same dead score.
    const marketExists = combine([s({ source: 'etsy', scope: 'category', listings: 80 })]);
    const nothing = combine([]);
    expect(marketExists.heat).toBeGreaterThan(nothing.heat);
  });

  it('reports the widest listing count and the full price band', () => {
    const out = combine([
      s({ listings: 200, price: 4 }),
      s({ source: 'etsy', scope: 'category', listings: 350, price: 9 }),
    ]);
    expect(out.listings).toBe(350);
    expect(out.priceLow).toBe(4);
    expect(out.priceHigh).toBe(9);
  });

  it('lists its sources, deduped and sorted', () => {
    const out = combine([
      s({ unitsSold: 10 }),
      s({ unitsSold: 20 }),
      s({ source: 'etsy', scope: 'category', listings: 5 }),
    ]);
    expect(out.sources).toEqual(['aliexpress', 'etsy']);
  });

  it('stays within bounds at both extremes', () => {
    expect(combine([]).heat).toBe(0);
    expect(combine([]).unitsSold).toBeUndefined();
    const huge = combine([s({ unitsSold: 10_000_000 })]);
    expect(huge.heat).toBeLessThanOrEqual(100);
    expect(huge.heat).toBeGreaterThan(0);
  });
});

describe('adPressure', () => {
  it('is undefined when no ad data was reported', () => {
    expect(adPressure(undefined, undefined)).toBeUndefined();
  });

  it('values one long-running ad above several brand-new ones', () => {
    const sustained = adPressure(50, 1)!;
    const burst = adPressure(3, 10)!;
    expect(sustained).toBeGreaterThan(burst);
  });

  it('lifts heat once an ad has been live three weeks', () => {
    const brief = combine([s({ source: 'meta', scope: 'category', ads: 3, adDaysLive: 5 })]);
    const sustained = combine([s({ source: 'meta', scope: 'category', ads: 3, adDaysLive: 40 })]);
    expect(sustained.heat).toBeGreaterThan(brief.heat);
  });

  it('carries ad coverage through so the card can say where it applies', () => {
    const out = combine([
      s({ source: 'meta', scope: 'category', ads: 2, adDaysLive: 30, adCoverage: 'EU' }),
    ]);
    expect(out.adCoverage).toBe('EU');
  });
});

describe('saturationOf', () => {
  it('reads listing counts as a market description', () => {
    expect(saturationOf({ listings: 40 } as any)).toBe('low');
    expect(saturationOf({ listings: 300 } as any)).toBe('medium');
    expect(saturationOf({ listings: 2000 } as any)).toBe('high');
    expect(saturationOf({} as any)).toBe('medium');
  });
});
