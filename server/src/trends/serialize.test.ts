import { describe, expect, it } from 'vitest';
import { saturationLabel, toDiscoverProduct, type TrendProductWithNiche } from './serialize';

// This serializer is the whole contract between the catalogue and every client.
// It has been the quiet failure mode twice now: a field lands in the content
// files, the importer stores it, and nothing downstream ever sees it because
// this function was not told. `tier` sat unread for weeks that way.
function product(over: Partial<TrendProductWithNiche> = {}): TrendProductWithNiche {
  return {
    id: 'p1',
    slug: 'stoneware-mugs',
    title: 'Stoneware mugs',
    blurb: 'People buy these in fours.',
    category: 'Home & living',
    tags: 'mugs, stoneware',
    nicheId: 'n1',
    niche: {
      id: 'n1',
      slug: 'ceramics',
      name: 'Ceramics',
      domain: 'Home & living',
      audience: 'maker',
    },
    sourcingType: 'MATERIALS',
    sourceName: 'Local clay supplier',
    sourceUrl: null,
    sourcingUrl: null,
    sourceCost: '$2–8/mug',
    typicalResale: '$28–45',
    priceRange: null,
    imageQuery: null,
    imageUrl: null,
    imageCredit: null,
    hotness: 50,
    tier: null,
    heat: null,
    heatPrev: null,
    unitsSold: null,
    listings: null,
    priceLow: null,
    priceHigh: null,
    adCount: null,
    adDaysLive: null,
    adReach: null,
    interest: null,
    interestTrend: null,
    liveSourcingUrl: null,
    liveMerchant: null,
    adSource: null,
    adCoverage: null,
    adEvidenceUrl: null,
    adAdvertiser: null,
    signalSources: null,
    signalsPolledAt: null,
    status: 'ACTIVE',
    origin: 'CATALOG',
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...over,
  } as TrendProductWithNiche;
}

describe('toDiscoverProduct', () => {
  it('carries tier through so the High upside badge can exist', () => {
    expect(toDiscoverProduct(product({ tier: 'upside' }), false).tier).toBe('upside');
    expect(toDiscoverProduct(product({ tier: 'proven' }), false).tier).toBe('proven');
  });

  it('leaves tier null for hand-curated products rather than defaulting it', () => {
    // Null means "not assessed", which is a different claim from "proven".
    // Defaulting here would mark 188 curated products as having passed a
    // sourcing check that was never run on them.
    expect(toDiscoverProduct(product({ tier: null }), false).tier).toBeNull();
  });

  it('reports the caller-supplied saved flag rather than inventing one', () => {
    expect(toDiscoverProduct(product(), true).saved).toBe(true);
    expect(toDiscoverProduct(product(), false).saved).toBe(false);
  });

  it('serializes evidence as null when nothing has actually been measured', () => {
    // The content rule: an empty field beats dressing editorial hotness up as
    // data. A card with no measurements renders no evidence strip at all.
    expect(toDiscoverProduct(product(), false).evidence).toBeNull();
  });

  it('serializes evidence once any single signal exists', () => {
    const evidence = toDiscoverProduct(product({ heat: 40, listings: 300 }), false).evidence;
    expect(evidence).not.toBeNull();
    expect(evidence?.heat).toBe(40);
    expect(evidence?.saturation).toBe('medium');
  });

  it('computes heatDelta only when there are two readings', () => {
    expect(toDiscoverProduct(product({ heat: 40 }), false).evidence?.heatDelta).toBeNull();
    expect(
      toDiscoverProduct(product({ heat: 40, heatPrev: 25 }), false).evidence?.heatDelta
    ).toBe(15);
  });

  it('survives a product whose niche was archived out from under it', () => {
    // These stay readable on the saved shelf, so the serializer cannot assume
    // a niche exists.
    expect(toDiscoverProduct(product({ niche: null, nicheId: null }), true).niche).toBeNull();
  });

  it('prefers a live merchant listing over the authored search link', () => {
    const p = product({
      sourcingUrl: 'https://example.com/search',
      liveSourcingUrl: 'https://example.com/actual-listing',
    });
    expect(toDiscoverProduct(p, false).sourcingUrl).toBe('https://example.com/actual-listing');
  });

  it('splits signal sources and drops the empty strings', () => {
    const p = product({ heat: 10, signalSources: 'wikipedia,,ebay' });
    expect(toDiscoverProduct(p, false).evidence?.sources).toEqual(['wikipedia', 'ebay']);
  });
});

describe('saturationLabel', () => {
  it('is null when nothing was counted, which is not the same as zero', () => {
    expect(saturationLabel(null)).toBeNull();
  });

  it('bands on the same thresholds the scorer uses', () => {
    expect(saturationLabel(0)).toBe('low');
    expect(saturationLabel(119)).toBe('low');
    expect(saturationLabel(120)).toBe('medium');
    expect(saturationLabel(599)).toBe('medium');
    expect(saturationLabel(600)).toBe('high');
  });
});
