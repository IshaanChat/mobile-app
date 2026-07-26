// Ranking for the Discover feed (trend cards). Stage-1 recommender: pure
// content-based scoring — no per-user learning yet. Every reaction is
// logged (SavedTrend + the event bus), so a learned ranker can replace the
// weights here once there is real engagement data to learn from.
//
// score = 0.5 * interest match + 0.3 * demand + 0.2 * freshness
// then a greedy diversity pass so one category can't wallpaper the feed.
//
// `demand` reads machine `heat` when the ingest pipeline has measured this
// product and falls back to the curator's `hotness` when it hasn't. The
// weights are deliberately unchanged from when this only knew about
// hotness: rankCards is shared with the Growth feed (routes/growth.ts maps
// CommunityPost through it, and those have no heat), so re-cutting them
// would silently reorder a feed this change has nothing to do with.

export interface RankableCard {
  id: string;
  category: string;
  /** Comma-separated keywords, as stored on TrendProduct.tags */
  tags: string;
  /** Curator-set 0–100 */
  hotness: number;
  createdAt: Date;
  /** Machine-measured 0–100. When present it stands in for `hotness`. */
  heat?: number | null;
  /** The previous poll's heat. heat - heatPrev is the trending axis. */
  heatPrev?: number | null;
  /**
   * Recent month's readership over the previous month's, as a ratio. Stands in
   * for the heat delta before there have been two polls to difference.
   */
  interestTrend?: number | null;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9#]+/)
    .filter((t) => t.length > 2);
}

/** Freshness decays linearly to 0 over 45 days. Curators bump `hotness` (or
 * re-import with a new slug) when something old heats up again. */
function freshness(createdAt: Date, now: Date): number {
  const ageDays = (now.getTime() - createdAt.getTime()) / 86_400_000;
  return Math.max(0, 1 - ageDays / 45);
}

/** Tag-overlap match, normalized to 0–1. Multi-word tags ("cutting board")
 * only count on a full match and score higher — same rule as the Discover
 * community engine, because partial-word credit surfaces junk. */
function matchScore(tags: string, interestTokens: Set<string>): number {
  if (interestTokens.size === 0) return 0;
  let raw = 0;
  for (const tag of tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)) {
    const words = tag.split(/\s+/);
    if (!words.every((w) => interestTokens.has(w))) continue;
    raw += words.length > 1 ? 3 : 2;
  }
  return Math.min(raw, 6) / 6;
}

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/**
 * How in-demand this is, 0–1. Measured evidence beats editorial judgement
 * when we have it — but `hotness` stays the fallback rather than a default
 * of zero, because on day one nothing has been measured and a feed sorted
 * by "we don't know" is no feed at all.
 */
function demand(card: RankableCard): number {
  const value = card.heat ?? card.hotness;
  return clamp01(value / 100);
}

/**
 * The middle of the pack's readership trend, used as the zero point.
 *
 * Absolute readership trends are close to useless on their own, because they
 * move together: measured over a summer window, 37 of 41 subjects were down,
 * several by more than a third. That is Wikipedia's own seasonality and its
 * long secular decline, not 37 dying markets. Scored raw, "trending" would
 * have meant "declining slowest".
 *
 * So the cohort sets the baseline and each subject is judged against its
 * peers. Falling 2% in a month when the median falls 10% is a subject
 * gaining ground, and that is what the sort should surface.
 */
function cohortTrend(cards: RankableCard[]): number {
  const trends = cards
    .map((c) => c.interestTrend)
    .filter((t): t is number => typeof t === 'number' && t > 0)
    .sort((a, b) => a - b);
  // Too small a sample is no cohort at all; fall back to absolute.
  if (trends.length < 4) return 1;
  return trends[Math.floor(trends.length / 2)] || 1;
}

/**
 * How fast this is heating, 0–1. A rise of 25 heat points between polls is
 * full marks.
 *
 * Two polls are needed to difference a heat reading, which used to mean the
 * whole Trending sort was dead on a fresh database — nothing had a previous
 * value, so everything scored 0 and the tab degraded to "hot". Readership
 * arrives already differentiated (this month against last), so it stands in
 * until real polls accumulate and steps aside once they have. Beating the
 * cohort by a quarter is full marks.
 */
function momentum(card: RankableCard, baseline: number): number {
  if (card.heat != null && card.heatPrev != null) {
    return clamp01(Math.max(0, card.heat - card.heatPrev) / 25);
  }
  if (card.interestTrend != null && baseline > 0) {
    return clamp01((card.interestTrend / baseline - 1) * 4);
  }
  return 0;
}

export function scoreCard(card: RankableCard, interestTokens: Set<string>, now: Date, _baseline = 1): number {
  return (
    0.5 * matchScore(card.tags, interestTokens) +
    0.3 * demand(card) +
    0.2 * freshness(card.createdAt, now)
  );
}

/**
 * The Trending sort. Momentum leads, but interest still tilts it — "matching
 * your interests OR climbing fastest floats to the top" is a blend, not an
 * either/or, and a trending shelf full of things you'd never sell is useless.
 *
 * Rows with no measurement are scaled down rather than excluded: they can
 * still appear when little else has moved, but they can't outrank a product
 * we have actually watched climb.
 */
export function scoreTrending(
  card: RankableCard,
  interestTokens: Set<string>,
  now: Date,
  baseline = 1
): number {
  const evidenced = card.heat != null ? 1 : 0.6;
  return (
    (0.55 * momentum(card, baseline) + 0.3 * demand(card)) * evidenced +
    0.15 * matchScore(card.tags, interestTokens)
  );
}

export type Scorer = (
  card: RankableCard,
  interestTokens: Set<string>,
  now: Date,
  /** The cohort's median readership trend — the zero point for momentum. */
  baseline: number
) => number;

/**
 * Score without ordering. The feed route needs the raw numbers to sort
 * sections by their best product, which it can't do if ranking is the only
 * way to get a score out.
 */
export function scoreCards<T extends RankableCard>(
  cards: T[],
  interestTokens: Set<string>,
  now: Date = new Date(),
  score: Scorer = scoreCard
): { card: T; score: number }[] {
  // Computed once over the whole pool, not per card: momentum is a
  // comparison against peers, so it needs to see them.
  const baseline = cohortTrend(cards);
  return cards.map((card) => ({ card, score: score(card, interestTokens, now, baseline) }));
}

/**
 * Rank cards for one user. `interestTokens` come from onboarding interests
 * (explorers) or the business's niche/keywords (owners); an empty set —
 * brand-new user, nothing known — degrades gracefully to hotness+freshness.
 *
 * Diversity: greedy pick where a card matching the previous pick's category
 * has its score dampened, so equals interleave but a runaway favourite
 * category can still dominate when it genuinely outscores everything.
 */
export function rankCards<T extends RankableCard>(
  cards: T[],
  interestTokens: Set<string>,
  now: Date = new Date(),
  score: Scorer = scoreCard
): T[] {
  const pool = scoreCards(cards, interestTokens, now, score);
  const result: T[] = [];
  // How far back the diversity pass looks. Comparing against only the
  // previous pick let two categories alternate A-B-A-B forever, each escaping
  // the penalty on every other turn. That was survivable when scores varied
  // per product; it stopped being survivable once readership arrived, because
  // that signal is measured per subject, so every product in a niche scores
  // identically and the feed collapsed to two niches interleaved.
  const RECENT = 4;

  while (pool.length > 0) {
    const recent = result.slice(-RECENT).map((c) => c.category);
    let bestIdx = 0;
    let bestEffective = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      // Compounding, so a third helping of the same shelf costs more than a
      // second. A genuinely dominant category can still win through.
      const repeats = recent.filter((c) => c === pool[i].card.category).length;
      const effective = pool[i].score * 0.75 ** repeats;
      if (effective > bestEffective) {
        bestEffective = effective;
        bestIdx = i;
      }
    }
    const [picked] = pool.splice(bestIdx, 1);
    result.push(picked.card);
  }
  return result;
}
