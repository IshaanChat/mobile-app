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
/** Recent sales below this are indistinguishable from noise. */
export const DEMAND_FLOOR = 40;
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
  const raw = band(unitsSold, 150, 1200, DEMAND_FLOOR, DEMAND_CROWDED * 2);
  // Never taper the crowded end to zero. Doing so was an over-correction that
  // scored 9,000 recent sales exactly the same as 20 — it turned "this market
  // is well served" into "nobody wants this", which is a different and much
  // worse claim. A crowded market is a discount, not a disqualification.
  return unitsSold > 1200 ? Math.max(raw, CROWDED_FLOOR) : raw;
}

/** Position in a best-seller list. Mid-page beats the top of it. */
export function rankScore(rank?: number): number {
  if (rank === undefined) return 0.5; // unknown position, no opinion
  // Positions 20–50 are where products with real demand and thin competition
  // sit. Note the adapter currently requests one page of 20, so it can never
  // see past position 19 — reaching this range needs page_no 2 and 3.
  return band(rank, 12, 50, -8, 90);
}

/** How much room the cost leaves once ads, fees and returns are paid for. */
export function marginScore(cost?: number): number {
  if (cost === undefined || cost <= 0) return 0;
  // Cheap is good, but only down to a point: under a dollar or two the
  // product is usually too flimsy to survive a refund policy.
  return band(cost, 2, 9, 0.5, COST_CEILING);
}

/** Where the achievable retail lands against the bands buyers actually sit in. */
export function retailScore(cost?: number): number {
  if (cost === undefined || cost <= 0) return 0;
  const mid = cost * ((MARKUP_MIN + MARKUP_MAX) / 2);
  return band(mid, RETAIL_SWEET_LOW, RETAIL_SWEET_HIGH, RETAIL_FLOOR, 250);
}

/** Competing sellers, where anyone reported them. Fewer is better, flatly. */
export function crowdingScore(listings?: number): number {
  if (listings === undefined) return 0.5;
  if (listings <= 120) return 1;
  return clamp01(1 - (listings - 120) / 600);
}

/** Direction of travel. Flat is fine; falling is the thing to avoid. */
export function trendScore(interestTrend?: number): number {
  if (interestTrend === undefined) return 0.5;
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

function parts(c: Candidate) {
  return {
    demand: demandScore(c.unitsSold),
    rank: rankScore(c.rank),
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
  const score = Math.round(WEIGHTS.reduce((a, [k, w]) => a + p[k] * w, 0) * 100);

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

  const verdict: Verdict = blockers.length ? 'reject' : score >= 62 ? 'pass' : score >= 45 ? 'borderline' : 'reject';

  return {
    score,
    verdict,
    reasons,
    blockers,
    ...(c.cost && c.cost > 0 ? { retail: { low: c.cost * MARKUP_MIN, high: c.cost * MARKUP_MAX } } : {}),
  };
}

/**
 * Rank a page of candidates best-first, dropping anything with a blocker.
 *
 * Replaces `sort by unitsSold desc`, which put the most contested listing on
 * the page in first place every single time.
 */
export function shortlist<T extends Candidate>(candidates: T[]): { candidate: T; assessment: Assessment }[] {
  return candidates
    .map((candidate, i) => ({ candidate, assessment: assess({ ...candidate, rank: candidate.rank ?? i }) }))
    .filter((r) => r.assessment.verdict !== 'reject')
    .sort((a, b) => b.assessment.score - a.assessment.score);
}
