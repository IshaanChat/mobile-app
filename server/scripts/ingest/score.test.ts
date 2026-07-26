import { describe, expect, it } from 'vitest';
import { combine, saturationOf, squash } from './score';
import type { Signal } from './types';

const s = (partial: Partial<Signal>): Signal => ({ source: 'aliexpress', ...partial });

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

describe('combine', () => {
  it('rates real sales above chatter', () => {
    const sales = combine([s({ unitsSold: 4000 })]);
    const talk = combine([s({ source: 'reddit', mentions: 80 })]);
    expect(sales.heat).toBeGreaterThan(talk.heat);
  });

  it('does not punish a product for sources that stayed silent', () => {
    // Same sales figure, but one also has views. Neither should collapse.
    const alone = combine([s({ unitsSold: 3000 })]);
    const withViews = combine([s({ unitsSold: 3000 }), s({ source: 'youtube', views: 400_000 })]);
    expect(alone.heat).toBeGreaterThan(40);
    expect(withViews.heat).toBeGreaterThan(40);
  });

  it('treats a crowded market as a reason for caution', () => {
    const quiet = combine([s({ unitsSold: 4000 }), s({ source: 'ebay', listings: 20 })]);
    const crowded = combine([s({ unitsSold: 4000 }), s({ source: 'ebay', listings: 5000 })]);
    expect(crowded.heat).toBeLessThan(quiet.heat);
  });

  it('sums sales across sources but takes the widest listing count', () => {
    const out = combine([
      s({ unitsSold: 1000, price: 4 }),
      s({ source: 'etsy', unitsSold: 500, price: 9 }),
      s({ source: 'ebay', listings: 200 }),
      s({ source: 'ebay', listings: 350 }),
    ]);
    expect(out.unitsSold).toBe(1500);
    expect(out.listings).toBe(350);
    expect(out.priceLow).toBe(4);
    expect(out.priceHigh).toBe(9);
  });

  it('records which sources actually reported, without duplicates', () => {
    const out = combine([s({ unitsSold: 10 }), s({ unitsSold: 20 }), s({ source: 'reddit', mentions: 3 })]);
    expect(out.sources.sort()).toEqual(['aliexpress', 'reddit']);
  });

  it('stays in range and omits metrics nobody reported', () => {
    const empty = combine([]);
    expect(empty.heat).toBe(0);
    expect(empty.unitsSold).toBeUndefined();
    expect(empty.listings).toBeUndefined();

    const huge = combine([s({ unitsSold: 10_000_000 }), s({ source: 'youtube', views: 900_000_000 })]);
    expect(huge.heat).toBeLessThanOrEqual(100);
    expect(huge.heat).toBeGreaterThan(0);
  });
});

describe('saturationOf', () => {
  it('reads crowding off the listing count', () => {
    expect(saturationOf(combine([s({ source: 'ebay', listings: 40 })]))).toBe('low');
    expect(saturationOf(combine([s({ source: 'ebay', listings: 300 })]))).toBe('medium');
    expect(saturationOf(combine([s({ source: 'ebay', listings: 2000 })]))).toBe('high');
  });

  it('says medium when nothing counted listings', () => {
    expect(saturationOf(combine([s({ unitsSold: 100 })]))).toBe('medium');
  });
});
