// Fixture-driven: no token, no network. Meta approval is uncertain and may
// never arrive, but if it does the parsing has to already be correct — and
// the phrase gate is the part that decides whether an ad count means
// anything at all, so it should be pinned down long before a key exists.

import { describe, expect, it } from 'vitest';
import { daysBetween, matchesKeyword, toSignals } from './meta';
import { combine } from '../score';
import fixture from '../fixtures/meta-ads-archive.json';

const ads = fixture.data;

describe('matchesKeyword', () => {
  it('accepts an ad whose creative contains every word', () => {
    expect(matchesKeyword(ads[0], 'watering planter')).toBe(true);
    // Hyphenated terms survive: the split is on whitespace and each part is
    // matched as a substring, so "self-watering" is found whole.
    expect(matchesKeyword(ads[0], 'self-watering planter')).toBe(true);
  });

  it('rejects an ad that only matches some words', () => {
    // "Summer sale — everything must go" mentions neither word.
    expect(matchesKeyword(ads[2], 'watering planter')).toBe(false);
  });

  it('rejects an ad with no creative text at all', () => {
    // Without this, an empty-bodied ad joins every count going.
    expect(matchesKeyword(ads[3], 'watering planter')).toBe(false);
  });

  it('rejects an empty keyword rather than matching everything', () => {
    expect(matchesKeyword(ads[0], '')).toBe(false);
  });
});

describe('daysBetween', () => {
  it('measures a finished run', () => {
    expect(daysBetween('2026-05-02T00:00:00+0000', '2026-07-20T00:00:00+0000')).toBe(79);
  });

  it('treats a still-running ad as running until now', () => {
    const start = new Date(Date.now() - 10 * 86_400_000).toISOString();
    expect(daysBetween(start, undefined)).toBe(10);
  });

  it('is 0 for nonsense rather than negative', () => {
    expect(daysBetween(undefined, undefined)).toBe(0);
    expect(daysBetween('2026-07-20T00:00:00+0000', '2026-05-02T00:00:00+0000')).toBe(0);
  });
});

describe('toSignals', () => {
  const signals = toSignals(ads, 'watering planter');

  it('returns one aggregate signal, not one per ad', () => {
    expect(signals).toHaveLength(1);
  });

  it('counts only the ads that passed the phrase gate', () => {
    // Two of the four fixture ads actually mention it.
    expect(signals[0].ads).toBe(2);
  });

  it('reports the longest run, not the most recent', () => {
    expect(signals[0].adDaysLive).toBe(79);
  });

  it('credits the advertiser behind that longest run', () => {
    expect(signals[0].advertiserName).toBe('Verdant Home');
    expect(signals[0].url).toContain('1029384756');
  });

  it('sums reach across matched ads only', () => {
    // 412,000 + 31,000 — the 900,000 from the unmatched sale ad stays out.
    expect(signals[0].adReach).toBe(443_000);
  });

  it('stamps EU coverage so the card can say where this applies', () => {
    expect(signals[0].adCoverage).toBe('EU');
  });

  it('never claims to be about a specific product', () => {
    // An ad is a creative with no join key back to a catalog row. Claiming
    // product scope here is what would turn "ads exist for this phrase" into
    // the false "this product sold N times".
    expect(signals[0].scope).toBe('category');
    expect(signals[0].unitsSold).toBeUndefined();
  });

  it('returns nothing when no ad matches', () => {
    expect(toSignals(ads, 'ceramic mug')).toEqual([]);
  });
});

describe('meta signals through the scorer', () => {
  it('produce heat without ever producing units sold', () => {
    const out = combine(toSignals(ads, 'watering planter'));
    expect(out.heat).toBeGreaterThan(0);
    expect(out.unitsSold).toBeUndefined();
    expect(out.sources).toEqual(['meta']);
  });
});
