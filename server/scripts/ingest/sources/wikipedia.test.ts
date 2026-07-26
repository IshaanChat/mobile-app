// Fixture-driven: no network. The maths here is the whole value of the
// adapter, and it's the part that would fail silently — a wrong window or a
// mis-sliced trend still returns a plausible number.

import { describe, expect, it } from 'vitest';
import { summarise, windowFor } from './wikipedia';
import { combine } from '../score';
import fixture from '../fixtures/wikipedia-pageviews.json';

const items = fixture.items;

describe('windowFor', () => {
  const { start, end } = windowFor(new Date('2026-07-26T12:00:00Z'));

  it('ends two days back, because the data lags a day', () => {
    // Reading up to today would compare a full month against a half-empty
    // one and report every subject as collapsing.
    expect(end).toBe('20260724');
  });

  it('covers two comparable months', () => {
    expect(start).toBe('20260526');
  });
});

describe('summarise', () => {
  it('averages daily readers across the window', () => {
    // 30 days at 100 and 30 at 130.
    expect(summarise(items).interest).toBe(115);
  });

  it('compares the recent month against the one before it', () => {
    expect(summarise(items).interestTrend).toBeCloseTo(1.3, 2);
  });

  it('reports no trend from a series too short to halve honestly', () => {
    // A young article would otherwise divide a real month by an accident of
    // when it was created.
    const short = items.slice(0, 20);
    expect(summarise(short).interestTrend).toBeUndefined();
    expect(summarise(short).interest).toBeGreaterThan(0);
  });

  it('reports no trend when the earlier half is empty', () => {
    const zeroed = items.map((i, n) => ({ ...i, views: n < 30 ? 0 : 130 }));
    expect(summarise(zeroed).interestTrend).toBeUndefined();
  });

  it('survives a series of zeroes without dividing by them', () => {
    const dead = items.map((i) => ({ ...i, views: 0 }));
    expect(summarise(dead).interest).toBe(0);
    expect(summarise(dead).interestTrend).toBeUndefined();
  });
});

describe('interest through the scorer', () => {
  const signal = {
    source: 'wikipedia' as const,
    scope: 'category' as const,
    ...summarise(items),
  };

  it('produces heat with no credential and no sale in sight', () => {
    const out = combine([signal]);
    expect(out.heat).toBeGreaterThan(0);
    expect(out.interest).toBe(115);
  });

  it('never claims a sale', () => {
    // Reading about macramé and buying macramé are different acts.
    expect(combine([signal]).unitsSold).toBeUndefined();
  });

  it('carries the trend through without folding it into heat', () => {
    // Level and direction are different questions. A fading giant would
    // otherwise outrank a rising nobody on the trending sort.
    const flat = combine([{ ...signal, interestTrend: 1 }]);
    const climbing = combine([{ ...signal, interestTrend: 1.8 }]);
    expect(climbing.heat).toBe(flat.heat);
    expect(climbing.interestTrend).toBe(1.8);
  });

  it('scores attention below a real sale', () => {
    const reading = combine([signal]);
    const buying = combine([
      { source: 'aliexpress' as const, scope: 'product' as const, unitsSold: 3000 },
    ]);
    expect(buying.heat).toBeGreaterThan(reading.heat);
  });
});
