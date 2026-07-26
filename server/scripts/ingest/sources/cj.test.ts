// Fixture-driven: no token, no network. Written before the credential
// exists so that the day it arrives the parsing is already known-good — and
// so the one rule that matters is locked down first: a catalog can say what
// something costs, never that anyone bought it.

import { describe, expect, it } from 'vitest';
import { medianPrice, toSignals } from './cj';
import { combine } from '../score';
import fixture from '../fixtures/cj-shopping-products.json';

const signals = toSignals(fixture.data);

describe('medianPrice', () => {
  const products = fixture.data.shoppingProducts.resultList;

  it('ignores a bulk lot that would wreck the average', () => {
    // Prices are 9.99, 18.99, 24.50, 31.00 and a 912.00 case of 48. The mean
    // is about 199 — a number that would make the card's cost-to-resale line
    // nonsense. The median is what a person actually pays.
    expect(medianPrice(products)).toBe(24.5);
  });

  it('reports nothing rather than zero when no price is usable', () => {
    expect(medianPrice([])).toBeUndefined();
    expect(medianPrice([{ price: { amount: '0' } }, { price: {} }])).toBeUndefined();
  });
});

describe('toSignals', () => {
  it('returns one aggregate signal, not one per listing', () => {
    expect(signals).toHaveLength(1);
  });

  it('never reports units sold, whatever the scope', () => {
    // CJ knows what is listed. It has no idea what sold, and the gap between
    // those two is what the whole ranking rests on.
    expect(signals[0].unitsSold).toBeUndefined();
    expect(combine(signals.map((s) => ({ ...s, scope: 'product' as const }))).unitsSold)
      .toBeUndefined();
  });

  it('counts advertisers carrying the category as saturation', () => {
    expect(signals[0].listings).toBe(412);
  });

  it('skips a listing with nowhere to go and links one that opens', () => {
    // The first result in the fixture has no link. Linking it would give the
    // user a dead "Source it" button.
    expect(signals[0].liveSourcingUrl).toContain('verdanthome.co/planter');
    expect(signals[0].liveMerchant).toBe('Verdant Home');
  });

  it('returns nothing at all when the feed is empty', () => {
    expect(toSignals({ shoppingProducts: { totalCount: 0, resultList: [] } })).toEqual([]);
    expect(toSignals({})).toEqual([]);
  });
});

describe('cj through the scorer', () => {
  it('contributes a price and a market, not demand', () => {
    const out = combine(signals);
    expect(out.priceLow).toBe(24.5);
    expect(out.listings).toBe(412);
    expect(out.unitsSold).toBeUndefined();
  });

  it('lets Etsy win the saturation call where both report', () => {
    // Etsy counts sellers of the same handmade thing; CJ counts advertisers
    // carrying the category. The larger, more pessimistic number wins.
    const withEtsy = combine([
      ...signals,
      { source: 'etsy', scope: 'category', listings: 900 },
    ]);
    expect(withEtsy.listings).toBe(900);
  });

  it('carries the live listing through for the card to prefer', () => {
    const out = combine(signals);
    expect(out.liveSourcingUrl).toContain('verdanthome.co');
    expect(out.liveMerchant).toBe('Verdant Home');
  });
});
