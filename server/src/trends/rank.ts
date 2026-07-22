// Ranking for the Discover feed (trend cards). Stage-1 recommender: pure
// content-based scoring — no per-user learning yet. Every reaction is
// logged (SavedTrend + the event bus), so a learned ranker can replace the
// weights here once there is real engagement data to learn from.
//
// score = 0.5 * interest match + 0.3 * hotness + 0.2 * freshness
// then a greedy diversity pass so one category can't wallpaper the feed.

export interface RankableCard {
  id: string;
  category: string;
  /** Comma-separated keywords, as stored on TrendCard.tags */
  tags: string;
  /** Curator-set 0–100 */
  hotness: number;
  createdAt: Date;
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

export function scoreCard(card: RankableCard, interestTokens: Set<string>, now: Date): number {
  return (
    0.5 * matchScore(card.tags, interestTokens) +
    0.3 * (Math.min(Math.max(card.hotness, 0), 100) / 100) +
    0.2 * freshness(card.createdAt, now)
  );
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
  now: Date = new Date()
): T[] {
  const pool = cards.map((card) => ({ card, score: scoreCard(card, interestTokens, now) }));
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
