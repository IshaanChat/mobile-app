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
 * How fast this is heating, 0–1. A rise of 25 heat points between polls is
 * full marks. Returns 0 when there's no previous reading: a product measured
 * once is not trending, it's just hot, and `demand` already says so.
 */
function momentum(card: RankableCard): number {
  if (card.heat == null || card.heatPrev == null) return 0;
  return clamp01(Math.max(0, card.heat - card.heatPrev) / 25);
}

export function scoreCard(card: RankableCard, interestTokens: Set<string>, now: Date): number {
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
export function scoreTrending(card: RankableCard, interestTokens: Set<string>, now: Date): number {
  const evidenced = card.heat != null ? 1 : 0.6;
  return (
    (0.55 * momentum(card) + 0.3 * demand(card)) * evidenced +
    0.15 * matchScore(card.tags, interestTokens)
  );
}

export type Scorer = (card: RankableCard, interestTokens: Set<string>, now: Date) => number;

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
  return cards.map((card) => ({ card, score: score(card, interestTokens, now) }));
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
  let lastCategory: string | null = null;

  while (pool.length > 0) {
    let bestIdx = 0;
    let bestEffective = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const penalty = pool[i].card.category === lastCategory ? 0.75 : 1;
      const effective = pool[i].score * penalty;
      if (effective > bestEffective) {
        bestEffective = effective;
        bestIdx = i;
      }
    }
    const [picked] = pool.splice(bestIdx, 1);
    result.push(picked.card);
    lastCategory = picked.card.category;
  }
  return result;
}
