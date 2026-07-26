// Turn raw signals into one 0–100 heat number.
//
// The hard part is that sources measure different things at wildly different
// magnitudes: AliExpress orders run to tens of thousands, Reddit mentions to
// tens. Comparing them raw would let YouTube views drown out everything. So
// each metric is squashed onto 0–1 with a log curve against a reference
// "this is a strong number" point, then blended.
//
// Weighting reflects how much each signal is worth believing:
//   units sold  — someone paid money. Strongest evidence there is.
//   demand      — people searching/watching. Real, but intent not purchase.
//   community   — chatter. Weakest, and easiest to fake.
// Saturation is subtracted rather than added: lots of competing listings means
// a crowded market, which is a reason to be cautious, not excited.

import type { Signal, Signals, SourceName } from './types';
import { todayISO } from './types';

/** Reference points where a metric counts as "strong" (scores ~0.8). */
const REF = { unitsSold: 3000, views: 500_000, mentions: 60, listings: 400 };

/** Log squash so an order of magnitude matters more than a doubling. */
export function squash(value: number, reference: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const v = Math.log10(1 + value) / Math.log10(1 + reference);
  return Math.max(0, Math.min(1.2, v));
}

const sum = (ns: (number | undefined)[]) => {
  const vals = ns.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  return vals.length ? vals.reduce((a, b) => a + b, 0) : undefined;
};
const maxOf = (ns: (number | undefined)[]) => {
  const vals = ns.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  return vals.length ? Math.max(...vals) : undefined;
};

export function combine(signals: Signal[]): Signals {
  const unitsSold = sum(signals.map((s) => s.unitsSold));
  const listings = maxOf(signals.map((s) => s.listings));
  const mentions = sum(signals.map((s) => s.mentions));
  const views = sum(signals.map((s) => s.views));

  const prices = signals
    .map((s) => s.price)
    .filter((p): p is number => typeof p === 'number' && p > 0)
    .sort((a, b) => a - b);

  const sold = squash(unitsSold ?? 0, REF.unitsSold);
  const demand = squash(views ?? 0, REF.views);
  const chatter = squash(mentions ?? 0, REF.mentions);
  const crowding = squash(listings ?? 0, REF.listings);

  // Re-weight across whatever actually reported, so a product seen only by
  // AliExpress isn't punished for the sources that stayed silent.
  const parts: [number, number][] = [];
  if (unitsSold !== undefined) parts.push([sold, 0.55]);
  if (views !== undefined) parts.push([demand, 0.3]);
  if (mentions !== undefined) parts.push([chatter, 0.15]);

  const weightTotal = parts.reduce((a, [, w]) => a + w, 0);
  const positive = weightTotal > 0 ? parts.reduce((a, [v, w]) => a + v * w, 0) / weightTotal : 0;

  // Re-weighting alone would let 80 Reddit mentions score as high as 4,000
  // sales, since each would be the only thing reporting. So the ceiling is
  // set by the best evidence available: chatter on its own can suggest, it
  // can't confirm.
  const ceiling = unitsSold !== undefined ? 1 : views !== undefined ? 0.7 : 0.4;

  // A crowded market shaves up to a quarter off, never more.
  const heat = Math.round(Math.max(0, Math.min(1, positive * ceiling - crowding * 0.25)) * 100);

  const sources = [...new Set(signals.map((s) => s.source))] as SourceName[];

  return {
    heat,
    ...(unitsSold !== undefined ? { unitsSold } : {}),
    ...(listings !== undefined ? { listings } : {}),
    ...(mentions !== undefined ? { mentions } : {}),
    ...(views !== undefined ? { views } : {}),
    ...(prices.length ? { priceLow: prices[0], priceHigh: prices[prices.length - 1] } : {}),
    sources,
    polledAt: todayISO(),
  };
}

/** Crowding read back out for the UI, so saturation stops being hand-set. */
export function saturationOf(s: Signals): 'low' | 'medium' | 'high' {
  if (s.listings === undefined) return 'medium';
  if (s.listings < 120) return 'low';
  if (s.listings < 600) return 'medium';
  return 'high';
}
