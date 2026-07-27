/**
 * What makes a product worth a beginner's first shop.
 *
 * This exists because discovery was ranking by `unitsSold` descending and
 * taking the top of the list. That is not a neutral default — the highest
 * lifetime order volume on a supplier marketplace is the *definition* of a
 * saturated product. Every seller running the same obvious search sees the
 * same top ten, so the pipeline was engineered to surface exactly the segment
 * with the most competition and the thinnest remaining margin.
 *
 * The fix is not to invert it. No demand is worse than crowded demand. What
 * this module encodes is a BAND: enough sales to prove somebody wants the
 * thing, not so many that the market is already answered.
 *
 * On the numbers below — they are industry heuristics, not research. They come
 * from the people who sell dropshipping tools and courses, which is a group
 * with an obvious interest in the advice sounding precise. They are written
 * here as named, editable constants rather than buried in expressions
 * precisely so they can be argued with and tuned once real outcomes exist.
 * Nothing here is measured yet. When enough products have shipped to compare
 * against, these should be refit and this comment deleted.
 */

/** Sourcing cost above which a beginner cannot fund ads out of the margin. */
export const COST_CEILING = 15;
/** Below this a listing is not worth the fulfilment and support overhead. */
export const RETAIL_FLOOR = 12;
/** The markup a product must support to cover ads, fees and testing losses. */
export const MARKUP_MIN = 3;
export const MARKUP_MAX = 5;
/**
 * Retail sweet spot. $10–30 is the impulse band; $30–100 is where the
 * headroom for paid acquisition actually lives. The overlap is what a first
 * shop should be aiming at.
 */
export const RETAIL_SWEET_LOW = 25;
export const RETAIL_SWEET_HIGH = 100;
/**
 * Recent sales below this are indistinguishable from noise.
 *
 * Raised from 40 after the first real pull. At 40 the survivors included
 * products with 47, 52 and 53 recent sales — technically above the line and
 * nowhere near enough to tell a genuine early trend from a handful of orders
 * that happened to land in the same month.
 */
export const DEMAND_FLOOR = 100;
/**
 * Above this, assume the obvious buyers have been served and the ad auction
 * is expensive. Not a cliff — the score tapers past it.
 */
export const DEMAND_CROWDED = 2500;
/**
 * The floor a well-served market keeps however crowded it gets. Proof that
 * thousands of people bought something is still evidence, and it has to stay
 * worth more than silence.
 */
export const CROWDED_FLOOR = 0.25;

export interface Candidate {
  /** Recent units moved by the best-selling listing. */
  unitsSold?: number;
  /** What one unit costs to source, in USD. */
  cost?: number;
  /** Competing sellers, where a marketplace reported it. */
  listings?: number;
  /** Recent attention over the month before it; 1.2 is a fifth more. */
  interestTrend?: number;
  /** How many candidates the rank is out of, when known. */
  total?: number;
  /**
   * Where this sat in a volume-sorted result page, zero-based.
   *
   * The cheapest competition proxy available and the most useful. Everyone
   * doing this search sorts by best-selling and works down from the top, so
   * position 0 is the most contested listing on the page almost by
   * definition, while the same demand at position 25 has had far fewer eyes
   * on it. Costs nothing extra to collect — it is just the array index.
   */
  rank?: number;
}

export type Verdict = 'pass' | 'borderline' | 'reject';

export interface Assessment {
  score: number;
  verdict: Verdict;
  /** Why it scored what it did, in the curator's language. */
  reasons: string[];
  /** Hard failures. Any one of these means reject whatever the score says. */
  blockers: string[];
  /** The retail band this cost supports, for the card. */
  retail?: { low: number; high: number };
  /** Coming the other way: what it must cost to be worth sourcing. */
  target?: { max: number; ideal: number };
  /** Which shelf this belongs on: proven, high-upside, or neither. */
  tier?: Tier;
}

/**
 * A product seen from the demand side — what it sells for, not what it costs.
 * This is the shape retail marketplaces can actually give us.
 */
export interface Listing {
  /** Observed selling price. */
  retail?: number;
  unitsSold?: number;
  listings?: number;
  interestTrend?: number;
  rank?: number;
  total?: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * A band score: 1 inside [low, high], tapering to 0 at the outer edges.
 * Used wherever more is better only up to a point — which is most of the
 * interesting criteria here, and none of what the old ranking did.
 */
export function band(value: number, low: number, high: number, taperLow: number, taperHigh: number): number {
  if (value >= low && value <= high) return 1;
  if (value < low) return taperLow >= low ? 0 : clamp01((value - taperLow) / (low - taperLow));
  return taperHigh <= high ? 0 : clamp01((taperHigh - value) / (taperHigh - high));
}

/**
 * A band with a slope inside it: best at the middle, ~0.82 at the edges.
 *
 * The flat-topped `band` was the other half of the tie problem. Everything
 * in range scored exactly 1, so three of the six criteria returned the same
 * number for almost every product and the total collapsed onto a single
 * value. Sitting dead centre of the demand sweet spot is genuinely a better
 * sign than scraping the edge of it, and the score should say so.
 *
 * The slope is deliberately gentle. It is a tiebreaker among products that
 * already qualify, not a second opinion about whether they qualify — that
 * question is settled by the blockers, which this cannot override.
 */
export function centred(value: number, low: number, high: number, taperLow: number, taperHigh: number): number {
  const base = band(value, low, high, taperLow, taperHigh);
  if (base <= 0 || value < low || value > high) return base;
  const mid = (low + high) / 2;
  const half = (high - low) / 2 || 1;
  return 1 - 0.18 * Math.min(1, Math.abs(value - mid) / half);
}

/**
 * Demand, scored as a band rather than a maximum.
 *
 * This one line is the whole point of the module. Ranking by volume gave the
 * crowded end of the market the highest score; here it peaks in the middle
 * and tapers both ways — no proof of demand is a reject, and being the
 * single best-selling item in a category is a warning, not a prize.
 */
export function demandScore(unitsSold?: number): number {
  if (unitsSold === undefined) return 0;
  if (unitsSold < DEMAND_FLOOR) return 0;
  const raw = centred(unitsSold, 150, 1200, DEMAND_FLOOR, DEMAND_CROWDED * 2);
  // Never taper the crowded end to zero. Doing so was an over-correction that
  // scored 9,000 recent sales exactly the same as 20 — it turned "this market
  // is well served" into "nobody wants this", which is a different and much
  // worse claim. A crowded market is a discount, not a disqualification.
  return unitsSold > 1200 ? Math.max(raw, CROWDED_FLOOR) : raw;
}

/**
 * Position in a best-seller list, as a FRACTION of the list.
 *
 * This was absolute — positions 12–50 scored 1 and anything past 90 scored 0.
 * That was survivable while a pull was one page of 20 and catastrophic once
 * it was 11,000 products: every product past position 90 scored an identical
 * zero, so an 18% weight became a constant and 607 of 662 picks tied on the
 * exact same total. A score that cannot separate its inputs is not a ranking.
 *
 * Relative position is also the more honest measure. Being 40th out of 50 and
 * 40th out of 5,000 are not remotely the same claim about how contested
 * something is.
 */
export function rankScore(rank?: number, total?: number): number {
  if (rank === undefined) return 0.5; // unknown position, no opinion
  // Short lists keep the absolute reading — a single page really is 20 items
  // deep, and a percentile over 20 would be far too coarse to mean anything.
  if (!total || total < 120) return centred(rank, 12, 50, -8, 90);
  // The front of a long feed is where everyone else starts scrolling; the
  // deep tail is stock the feed itself ranked last. The good stretch is
  // between them.
  return centred(rank / total, 0.12, 0.75, -0.05, 1.05);
}

/** How much room the cost leaves once ads, fees and returns are paid for. */
export function marginScore(cost?: number): number {
  if (cost === undefined || cost <= 0) return 0;
  // Cheap is good, but only down to a point: under a dollar or two the
  // product is usually too flimsy to survive a refund policy.
  return centred(cost, 2, 9, 0.5, COST_CEILING);
}

/** Whether a retail price sits where buyers actually are. */
export function retailBandScore(retail?: number): number {
  if (retail === undefined || retail <= 0) return 0;
  return centred(retail, RETAIL_SWEET_LOW, RETAIL_SWEET_HIGH, RETAIL_FLOOR, 250);
}

/** Where the achievable retail lands, given what the thing costs to source. */
export function retailScore(cost?: number): number {
  if (cost === undefined || cost <= 0) return 0;
  return retailBandScore(cost * ((MARKUP_MIN + MARKUP_MAX) / 2));
}

/**
 * The inversion, and the reason this module has two entry points.
 *
 * Sourcing cost is the one number nobody publishes. It is the whole moat of
 * every "winning products" tool, and every open door that exists — Printful
 * included — is a supplier choosing to publish it because they earn when you
 * sell. Retail prices, by contrast, are public everywhere, because
 * marketplaces want them indexed.
 *
 * So stop treating cost as an input. Given what something demonstrably SELLS
 * for, the criteria already fix what it must COST to be worth doing, and that
 * is a more useful thing to show a beginner anyway: "source this under $11" is
 * actionable, survives suppliers changing their prices, and never blocks on a
 * credential.
 */
export function sourcingTarget(retail: number): { max: number; ideal: number } {
  return { max: retail / MARKUP_MIN, ideal: retail / MARKUP_MAX };
}

/**
 * Competing sellers, where anyone reported them. Fewer is better, flatly.
 *
 * Undefined rather than a neutral 0.5 when nothing reported. A constant is
 * not a neutral value — it is 10% of the weight pinned to the same number for
 * every product, which lifts the whole population and compresses the range
 * everything else is trying to spread across.
 */
export function crowdingScore(listings?: number): number | undefined {
  if (listings === undefined) return undefined;
  if (listings <= 120) return 1;
  return clamp01(1 - (listings - 120) / 600);
}

/** Direction of travel. Flat is fine; falling is the thing to avoid. */
export function trendScore(interestTrend?: number): number | undefined {
  if (interestTrend === undefined) return undefined;
  // 1.0 is flat. Below 0.85 attention is draining out of the category.
  return clamp01((interestTrend - 0.85) / 0.45);
}

/**
 * Weights. Demand and its crowding dominate because they are the two facts
 * that decide whether a beginner can get a first sale at all; margin decides
 * whether that sale was worth making.
 */
const WEIGHTS: [keyof ReturnType<typeof parts>, number][] = [
  ['demand', 0.28],
  ['rank', 0.18],
  ['margin', 0.2],
  ['retail', 0.16],
  ['crowding', 0.1],
  ['trend', 0.08],
];

/**
 * Weighted mean over the components that actually have a value.
 *
 * A criterion with no data must not vote. Re-weighting is how score.ts
 * already handles a source that stayed silent, and the alternative — a
 * neutral constant — is what flattened this score into nine distinct values
 * across 595 products.
 */
function weighted<K extends string>(p: Record<K, number | undefined>, weights: [K, number][]): number {
  const live = weights.filter(([k]) => p[k] !== undefined);
  const total = live.reduce((a, [, w]) => a + w, 0);
  if (!total) return 0;
  return Math.round((live.reduce((a, [k, w]) => a + (p[k] as number) * w, 0) / total) * 100);
}

function parts(c: Candidate) {
  return {
    demand: demandScore(c.unitsSold),
    rank: rankScore(c.rank, c.total),
    margin: marginScore(c.cost),
    retail: retailScore(c.cost),
    crowding: crowdingScore(c.listings),
    trend: trendScore(c.interestTrend),
  };
}

/**
 * Judge a candidate.
 *
 * Blockers are separate from the score on purpose. A product can look
 * excellent on five dimensions and still be unsellable because it costs $40
 * to source — averaging that away would let a strong trend score smuggle it
 * through. Hard facts reject; soft ones rank.
 */
export function assess(c: Candidate): Assessment {
  const blockers: string[] = [];
  const reasons: string[] = [];

  if (c.cost === undefined || c.cost <= 0) {
    blockers.push('No sourcing cost, so no margin can be checked.');
  } else {
    if (c.cost > COST_CEILING) {
      blockers.push(`Costs $${c.cost.toFixed(2)} to source — over the $${COST_CEILING} ceiling, which leaves nothing to fund ads with.`);
    }
    if (c.cost * MARKUP_MIN < RETAIL_FLOOR) {
      blockers.push(`Even at ${MARKUP_MIN}x this retails under $${RETAIL_FLOOR} — too thin to be worth fulfilling.`);
    }
  }

  if (c.unitsSold !== undefined && c.unitsSold < DEMAND_FLOOR) {
    blockers.push(`Only ${c.unitsSold} sold recently — no evidence anyone wants it.`);
  }
  if (c.unitsSold === undefined) {
    blockers.push('No sales figure, so demand is unproven.');
  }

  const p = parts(c);
  // Re-weighted across whatever actually reported, the same way score.ts
  // handles silent sources. Scoring an absent signal as 0.5 was quietly
  // adding a fixed 9 points to every product and squashing the usable range.
  const score = weighted(p, WEIGHTS);

  // Said plainly, because these lines are what a beginner reads on the card
  // to understand why this product and not another.
  if (c.unitsSold !== undefined) {
    if (c.unitsSold > DEMAND_CROWDED) reasons.push(`${c.unitsSold.toLocaleString('en-US')} sold — proven, but this market is already well served.`);
    else if (p.demand > 0.8) reasons.push(`${c.unitsSold.toLocaleString('en-US')} sold recently — enough to prove demand without the crowd.`);
  }
  if (c.rank !== undefined && c.rank < 8) reasons.push('Sits at the top of the best-seller list, where every other seller is already looking.');
  else if (p.rank > 0.8) reasons.push('Well down the best-seller list — real demand that fewer people have found.');
  if (c.cost !== undefined && c.cost > 0) reasons.push(`Sources at $${c.cost.toFixed(2)}, supporting roughly $${(c.cost * MARKUP_MIN).toFixed(0)}–${(c.cost * MARKUP_MAX).toFixed(0)} retail.`);
  if (c.listings !== undefined && c.listings > 600) reasons.push(`Roughly ${c.listings.toLocaleString('en-US')} sellers already listing it.`);
  if (c.interestTrend !== undefined && c.interestTrend < 0.85) reasons.push('Attention in this category is falling.');

  const tier = tierFor(score, c, blockers);
  if (tier === 'upside') {
    reasons.push('Early rather than proven — modest sales, but the margin is intact and few sellers have found it.');
  }

  return {
    score,
    verdict: verdictFor(score, blockers),
    ...(tier ? { tier } : {}),
    reasons,
    blockers,
    ...(c.cost && c.cost > 0 ? { retail: { low: c.cost * MARKUP_MIN, high: c.cost * MARKUP_MAX } } : {}),
  };
}

/** Below this, no supplier is going to sell you a thing worth shipping. */
export const MIN_SOURCEABLE = 1;

/**
 * Where the verdict boundaries sit.
 *
 * Raised from 62/45 once there were real products to look at. The first pull
 * wrote entries scoring 61, 63 and 64 — none of them wrong exactly, all of
 * them things you would scroll past. A feed of 200,000 products is not short
 * of candidates, so the bar should sit where "worth someone's first business"
 * is, not where "defensible" is. Scarcity of supply was never the constraint.
 */
export const PASS_SCORE = 70;
export const BORDERLINE_SCORE = 58;

/** The floor for the high-upside tier. Below this nothing qualifies. */
export const UPSIDE_SCORE = 50;
/**
 * The sales window that reads as EARLY rather than weak.
 *
 * Above DEMAND_FLOOR, so somebody is definitely buying; below this, so the
 * market has not yet been answered. A product with 180 recent sales and
 * intact margin is not a worse version of one with 900 — it is an earlier
 * one, and that is the whole bet the upside tier is making.
 */
export const UPSIDE_SALES_MAX = 600;

export type Tier = 'proven' | 'upside';

/**
 * Which shelf a product belongs on, or neither.
 *
 * Two tiers because one threshold was hiding a real distinction. Everything
 * between 50 and 70 was being discarded as "not good enough", but that range
 * holds two completely different populations: products whose numbers are thin
 * because nobody wants them, and products whose numbers are thin because
 * almost nobody has found them yet. The second group is where an unusual
 * product with room to run actually lives.
 *
 * What separates them is measurable, and it is deliberately NOT a guess at
 * novelty — there is nothing in a supplier feed that reports whether a thing
 * is interesting. What the feed does report is real-but-modest sales
 * alongside undamaged margin, and that combination is what an early product
 * looks like from the outside. A cheap thing selling 180 a month with a 4x
 * markup available has room to run; the same score reached by scraping the
 * cost ceiling with 110 sales does not.
 */
export function tierFor(score: number, c: Candidate, blockers: string[]): Tier | null {
  if (blockers.length) return null;
  if (score < UPSIDE_SCORE) return null;

  const sold = c.unitsSold ?? 0;
  const early = sold >= DEMAND_FLOOR && sold <= UPSIDE_SALES_MAX;
  // Margin has to be genuinely intact, not merely inside the band. An upside
  // pick is a bet, and a bet with thin margin has nothing to pay for itself.
  const roomToRun = marginScore(c.cost) >= 0.8 && retailScore(c.cost) >= 0.8;

  // Checked BEFORE the proven threshold, and that ordering is the whole
  // design. Defining upside as "scores lower" was wrong on contact with real
  // data: 16 of 2,354 products landed in the 50–70 band, because anything
  // that clears the blockers is inside every good range by construction and
  // therefore scores high. There is no population down there to find.
  //
  // The real distinction was never the score. It is whether the demand
  // evidence is EARLY or SETTLED — a $6 product with 180 recent sales and a
  // 4x markup available is a different proposition from an identical one with
  // 900, and the first is where an unusual product with room to run lives.
  // Both are good; they are good in different ways, and the app should say
  // which is which rather than rank one below the other.
  if (early && roomToRun) return 'upside';
  return score >= PASS_SCORE ? 'proven' : null;
}

/** One definition of the boundaries, used by both entry points. */
export function verdictFor(score: number, blockers: string[]): Verdict {
  if (blockers.length) return 'reject';
  if (score >= PASS_SCORE) return 'pass';
  if (score >= BORDERLINE_SCORE) return 'borderline';
  return 'reject';
}

/**
 * Judge a product from the demand side, and say what it has to cost.
 *
 * The counterpart to `assess`. Same criteria, one fewer input: nothing here
 * needs a sourcing cost, so it runs against any public retail catalog rather
 * than waiting on supplier credentials.
 */
export function assessListing(l: Listing): Assessment {
  const blockers: string[] = [];
  const reasons: string[] = [];

  if (l.retail === undefined || l.retail <= 0) {
    blockers.push('No selling price, so there is nothing to work back from.');
  } else {
    if (l.retail < RETAIL_FLOOR) {
      blockers.push(`Sells for $${l.retail.toFixed(2)} — under the $${RETAIL_FLOOR} floor, so there is no margin to split.`);
    }
    if (sourcingTarget(l.retail).max < MIN_SOURCEABLE) {
      blockers.push(`Would need sourcing under $${MIN_SOURCEABLE.toFixed(2)} to work, which nothing worth shipping costs.`);
    }
  }

  // Demand is softer here than in the cost-side path. A retail catalog often
  // reports what is listed rather than what sold, so absence of a sales figure
  // is normal rather than damning — but SOMETHING has to indicate a market,
  // or this is just a price with no evidence attached.
  if (l.unitsSold === undefined && l.listings === undefined) {
    blockers.push('Nothing indicates a market — no sales and no competing listings.');
  }

  const p = {
    retail: retailBandScore(l.retail),
    demand: l.unitsSold === undefined ? 0.45 : demandScore(l.unitsSold),
    crowding: crowdingScore(l.listings),
    trend: trendScore(l.interestTrend),
    rank: rankScore(l.rank, l.total),
  };
  const weights: [keyof typeof p, number][] = [
    ['retail', 0.3],
    ['demand', 0.26],
    ['crowding', 0.18],
    ['rank', 0.14],
    ['trend', 0.12],
  ];
  const score = weighted(p, weights);

  const target = l.retail && l.retail > 0 ? sourcingTarget(l.retail) : undefined;
  if (l.retail && target) {
    reasons.push(`Sells around $${l.retail.toFixed(0)} — source under $${target.max.toFixed(2)} to clear ${MARKUP_MIN}x, under $${target.ideal.toFixed(2)} to hit ${MARKUP_MAX}x.`);
  }
  if (l.unitsSold !== undefined && p.demand > 0.8) reasons.push(`${l.unitsSold.toLocaleString('en-US')} sold recently — demand without the crowd.`);
  if (l.unitsSold === undefined) reasons.push('Listed rather than proven — no sales figure available for this one.');
  if (l.listings !== undefined && l.listings > 600) reasons.push(`Roughly ${l.listings.toLocaleString('en-US')} sellers already listing it.`);
  if (l.interestTrend !== undefined && l.interestTrend < 0.85) reasons.push('Attention in this category is falling.');

  return { score, verdict: verdictFor(score, blockers), reasons, blockers, ...(target ? { target } : {}) };
}

/**
 * Rank a page of candidates best-first, dropping anything with a blocker.
 *
 * Replaces `sort by unitsSold desc`, which put the most contested listing on
 * the page in first place every single time.
 */
export function shortlist<T extends Candidate>(candidates: T[]): { candidate: T; assessment: Assessment }[] {
  return candidates
    .map((candidate, i, arr) => ({ candidate, assessment: assess({ ...candidate, rank: candidate.rank ?? i, total: arr.length }) }))
    .filter((r) => r.assessment.verdict !== 'reject')
    .sort((a, b) => b.assessment.score - a.assessment.score);
}
