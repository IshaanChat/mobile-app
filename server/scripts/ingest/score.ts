// Turn raw signals into one 0–100 heat number.
//
// The hard part is that sources measure different things at wildly different
// magnitudes: AliExpress orders run to tens of thousands, ad runs to tens of
// days. Comparing them raw would let one drown out everything. So each metric
// is squashed onto 0–1 with a log curve against a reference "this is a strong
// number" point, then blended.
//
// Weighting reflects how much each signal is worth believing:
//   units sold  — someone paid money. Strongest evidence there is.
//   ad pressure — someone is paying daily to push it, and hasn't stopped.
// Saturation is subtracted rather than added: lots of competing listings means
// a crowded market, which is a reason to be cautious, not excited.

import type { Signal, Signals, SourceName } from './types';
import { todayISO } from './types';

/** Reference points where a metric counts as "strong" (scores ~0.8). */
const REF = { unitsSold: 3000, adDaysLive: 45, ads: 8, interest: 4000 };

/**
 * Crowding, 0–1, on a linear ramp between the same thresholds `saturationOf`
 * uses for its words.
 *
 * A log squash is the wrong shape here. Against a reference of 400 it scored
 * 20 listings at 0.5 crowding and 80 at 0.73 — so a card could say "low
 * competition" while the heat behind it had already been docked as if the
 * market were flooded. The number and the word have to agree.
 */
function crowdingOf(listings?: number): number {
  if (listings === undefined) return 0;
  if (listings <= 120) return 0;
  return Math.min(1, (listings - 120) / 480);
}

/**
 * What a marketplace listing count is worth on its own: proof a real market
 * exists, and nothing at all about how big it is. Deliberately middling —
 * it has to beat silence without ever rivalling evidence of a sale.
 */
const MARKET_EXISTS = 0.5;

/** Log squash so an order of magnitude matters more than a doubling. */
export function squash(value: number, reference: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const v = Math.log10(1 + value) / Math.log10(1 + reference);
  return Math.max(0, Math.min(1.2, v));
}

const maxOf = (ns: (number | undefined)[]) => {
  const vals = ns.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  return vals.length ? Math.max(...vals) : undefined;
};

/**
 * Ad pressure, 0–1. Duration dominates count on purpose: ten creatives
 * launched last week is a test, one creative running seven weeks is a
 * business paying for it every day and choosing not to stop.
 */
export function adPressure(adDaysLive?: number, ads?: number): number | undefined {
  if (adDaysLive === undefined && ads === undefined) return undefined;
  return 0.7 * squash(adDaysLive ?? 0, REF.adDaysLive) + 0.3 * squash(ads ?? 0, REF.ads);
}

export function combine(signals: Signal[]): Signals {
  // The scope gate, and the most important line in this file. Only signals
  // about the sellable thing may claim units sold — otherwise the maker half
  // of the catalog gets scored on how much clay and wax the world buys.
  const sellable = signals.filter((s) => s.scope === 'product');
  // Max, not sum: a search returns up to twenty listings for the same
  // product, and adding their volumes together invented a number twenty
  // times too big. The best-selling listing is the honest answer.
  const unitsSold = maxOf(sellable.map((s) => s.unitsSold));

  const listings = maxOf(signals.map((s) => s.listings));
  const ads = maxOf(signals.map((s) => s.ads));
  const adDaysLive = maxOf(signals.map((s) => s.adDaysLive));
  const adReach = maxOf(signals.map((s) => s.adReach));
  const pressure = adPressure(adDaysLive, ads);
  const interest = maxOf(signals.map((s) => s.interest));
  const interestTrend = maxOf(signals.map((s) => s.interestTrend));

  const prices = signals
    .map((s) => s.price)
    .filter((p): p is number => typeof p === 'number' && p > 0)
    .sort((a, b) => a - b);

  // Kept in its own bucket, never merged with sourcing prices above. The two
  // are opposite ends of one trade, and a selling price landing in `priceLow`
  // would read as a cost — turning the best news about a product into the
  // reason the criteria reject it.
  const retails = signals
    .map((s) => s.retailPrice)
    .filter((p): p is number => typeof p === 'number' && p > 0)
    .sort((a, b) => a - b);

  const sold = squash(unitsSold ?? 0, REF.unitsSold);
  const crowding = crowdingOf(listings);

  // Re-weight across whatever actually reported, so a product seen only by
  // AliExpress isn't punished for the sources that stayed silent.
  //
  // The market term carries little weight but has to be here rather than only
  // in the ceiling: the ceiling multiplies, so for the four fifths of the
  // catalog that can never report a sale it would only ever have scaled a
  // zero, and every maker product would sit at heat 0 forever.
  const parts: [number, number][] = [];
  if (unitsSold !== undefined) parts.push([sold, 0.6]);
  if (pressure !== undefined) parts.push([pressure, 0.4]);
  // Attention counts, but below both of the above: a lot of people reading
  // about macramé is real, and still weaker than one person buying some.
  if (interest !== undefined) parts.push([squash(interest, REF.interest), 0.25]);
  if (listings !== undefined) parts.push([MARKET_EXISTS, 0.2]);

  const weightTotal = parts.reduce((a, [, w]) => a + w, 0);
  const positive = weightTotal > 0 ? parts.reduce((a, [v, w]) => a + v * w, 0) / weightTotal : 0;

  // Re-weighting alone would let a single fortnight-old ad score as high as
  // 4,000 sales, since it would be the only thing reporting. So the ceiling
  // is set by the best evidence available.
  //
  // The marketplace rung matters more than it looks: four fifths of the
  // catalog can never legitimately report unitsSold, so without a rung for
  // "a real market exists, size unknown" every maker product would cap at
  // 0.4 and the Trending feed would look dead on arrival.
  //
  // Ad evidence stops at 0.85 rather than 1. That gap is the coverage
  // discount, made explicit: Meta's commercial data is EU-reaching ads only,
  // so it is a leading indicator for a US seller, not a mirror.
  const ceiling =
    unitsSold !== undefined ? 1
    : (adDaysLive ?? 0) >= 21 ? 0.85
    : pressure !== undefined ? 0.6
    : interest !== undefined ? 0.58
    : listings !== undefined ? 0.55
    : 0.4;

  // A crowded market shaves up to a quarter off, never more.
  const heat = Math.round(Math.max(0, Math.min(1, positive * ceiling - crowding * 0.25)) * 100);

  const sources = [...new Set(signals.map((s) => s.source))].sort() as SourceName[];
  const withAdvertiser = signals.find((s) => s.advertiserName);
  const coverage = signals.find((s) => s.adCoverage)?.adCoverage;
  const live = signals.find((s) => s.liveSourcingUrl);

  return {
    heat,
    ...(unitsSold !== undefined ? { unitsSold } : {}),
    ...(listings !== undefined ? { listings } : {}),
    ...(prices.length ? { priceLow: prices[0], priceHigh: prices[prices.length - 1] } : {}),
    ...(retails.length
      ? {
          retailLow: retails[0],
          retailHigh: retails[retails.length - 1],
          // The median, not the cheapest, is what a new seller can expect to
          // charge — the bottom of a marketplace is damaged stock and loss
          // leaders, and planning a business against it guarantees a miss.
          sourceUnder: Number((retails[Math.floor(retails.length / 2)] / 3).toFixed(2)),
        }
      : {}),
    ...(ads !== undefined ? { ads } : {}),
    ...(adDaysLive !== undefined ? { adDaysLive } : {}),
    ...(adReach !== undefined ? { adReach } : {}),
    ...(coverage ? { adCoverage: coverage } : {}),
    ...(withAdvertiser?.advertiserName ? { advertiserName: withAdvertiser.advertiserName } : {}),
    ...(interest !== undefined ? { interest } : {}),
    // Carried through but deliberately NOT folded into heat. It's a
    // derivative — it says which way this is moving, not how big it is, and
    // conflating the two is how a fading giant outranks a rising nobody.
    ...(interestTrend !== undefined ? { interestTrend } : {}),
    ...(live?.liveSourcingUrl ? { liveSourcingUrl: live.liveSourcingUrl } : {}),
    ...(live?.liveMerchant ? { liveMerchant: live.liveMerchant } : {}),
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
