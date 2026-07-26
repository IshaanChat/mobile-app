import { describe, expect, it } from 'vitest';
import { rankCards, scoreTrending, tokenize, type RankableCard } from './rank';

const NOW = new Date('2026-07-22T12:00:00Z');

function card(over: Partial<RankableCard> & { id: string }): RankableCard {
  return {
    category: 'Jewelry',
    tags: 'jewelry, earrings',
    hotness: 50,
    createdAt: NOW,
    ...over,
  };
}

const tokens = (s: string) => new Set(tokenize(s));

describe('rankCards', () => {
  it('puts interest-matching cards above non-matching ones', () => {
    const cards = [
      card({ id: 'pets', category: 'Pets', tags: 'dog, pets' }),
      card({ id: 'jewelry', category: 'Jewelry', tags: 'jewelry, earrings' }),
    ];
    const ranked = rankCards(cards, tokens('handmade jewelry and earrings'), NOW);
    expect(ranked[0].id).toBe('jewelry');
  });

  it('multi-word tags require every word and outscore single-word tags', () => {
    const cards = [
      card({ id: 'single', tags: 'board' }),
      card({ id: 'multi', tags: 'cutting board' }),
      card({ id: 'partial', category: 'Other', tags: 'cutting stone' }),
    ];
    const ranked = rankCards(cards, tokens('walnut cutting board'), NOW);
    expect(ranked[0].id).toBe('multi');
    // "cutting stone" must not get credit for matching only "cutting".
    expect(ranked[ranked.length - 1].id).toBe('partial');
  });

  it('falls back to hotness order when nothing is known about the user', () => {
    const cards = [
      card({ id: 'cool', hotness: 10 }),
      card({ id: 'hot', hotness: 95, category: 'Pets' }),
      card({ id: 'warm', hotness: 60, category: 'Food' }),
    ];
    const ranked = rankCards(cards, new Set(), NOW);
    expect(ranked.map((c) => c.id)).toEqual(['hot', 'warm', 'cool']);
  });

  it('prefers fresher cards when otherwise equal', () => {
    const old = new Date(NOW.getTime() - 40 * 86_400_000);
    const cards = [
      card({ id: 'stale', createdAt: old }),
      card({ id: 'fresh', category: 'Food', createdAt: NOW }),
    ];
    const ranked = rankCards(cards, new Set(), NOW);
    expect(ranked[0].id).toBe('fresh');
  });

  it('interleaves categories instead of walling one shelf', () => {
    const cards = [
      card({ id: 'j1', hotness: 90 }),
      card({ id: 'j2', hotness: 89 }),
      card({ id: 'j3', hotness: 88 }),
      card({ id: 'food', category: 'Food', hotness: 80 }),
    ];
    const ranked = rankCards(cards, new Set(), NOW);
    // Without the penalty food would be last; with it, it breaks up the run.
    expect(ranked.map((c) => c.id).indexOf('food')).toBeLessThan(3);
  });

  it('still lets a category dominate when it genuinely outscores everything', () => {
    const cards = [
      card({ id: 'j1', hotness: 100 }),
      card({ id: 'j2', hotness: 99 }),
      card({ id: 'weak', category: 'Food', hotness: 5 }),
    ];
    const ranked = rankCards(cards, new Set(), NOW);
    expect(ranked.map((c) => c.id)).toEqual(['j1', 'j2', 'weak']);
  });

  it('lets measured heat override the curator’s hotness', () => {
    // The curator guessed high on 'guess' and low on 'measured'; ingest then
    // measured the opposite. Evidence should win.
    const cards = [
      card({ id: 'guess', hotness: 90 }),
      card({ id: 'measured', hotness: 10, heat: 95 }),
    ];
    const ranked = rankCards(cards, new Set(), NOW);
    expect(ranked[0].id).toBe('measured');
  });

  it('leaves cards with no heat ranked on hotness, as before', () => {
    // The Growth feed maps CommunityPosts through rankCards and they never
    // carry heat — this is the case that must not have moved.
    const cards = [
      card({ id: 'cool', hotness: 10 }),
      card({ id: 'hot', hotness: 90 }),
      card({ id: 'warm', hotness: 50 }),
    ];
    const ranked = rankCards(cards, new Set(), NOW);
    expect(ranked.map((c) => c.id)).toEqual(['hot', 'warm', 'cool']);
  });
});

describe('scoreTrending', () => {
  const climbing = card({ id: 'climbing', hotness: 50, heat: 60, heatPrev: 35 });
  const hotButFlat = card({ id: 'flat', hotness: 50, heat: 85, heatPrev: 85 });

  it('puts a fast climber above something hotter but flat', () => {
    expect(scoreTrending(climbing, new Set(), NOW))
      .toBeGreaterThan(scoreTrending(hotButFlat, new Set(), NOW));
  });

  it('treats a first measurement as hot, not trending', () => {
    // No heatPrev means no derivative. It should score exactly as if the
    // climb hadn't happened, rather than being credited for arriving hot.
    const firstPoll = card({ id: 'first', hotness: 50, heat: 60 });
    const noClimb = card({ id: 'none', hotness: 50, heat: 60, heatPrev: 60 });
    expect(scoreTrending(firstPoll, new Set(), NOW))
      .toBeCloseTo(scoreTrending(noClimb, new Set(), NOW));
  });

  it('sinks unmeasured cards below measured ones without hiding them', () => {
    const unmeasured = card({ id: 'unmeasured', hotness: 80 });
    const measured = card({ id: 'measured', hotness: 80, heat: 80, heatPrev: 80 });
    const unmeasuredScore = scoreTrending(unmeasured, new Set(), NOW);
    expect(unmeasuredScore).toBeLessThan(scoreTrending(measured, new Set(), NOW));
    expect(unmeasuredScore).toBeGreaterThan(0);
  });

  it('still lets interests tilt the trending feed', () => {
    const offInterest = card({ id: 'off', tags: 'candles', heat: 60, heatPrev: 50 });
    const onInterest = card({ id: 'on', tags: 'jewelry', heat: 60, heatPrev: 50 });
    expect(scoreTrending(onInterest, tokens('jewelry'), NOW))
      .toBeGreaterThan(scoreTrending(offInterest, tokens('jewelry'), NOW));
  });
});

describe('readership as a stand-in for the heat delta', () => {
  // Measured against the real API, 37 of 41 subjects were declining over a
  // summer window. Judged in absolute terms almost everything would score
  // zero momentum, so the cohort's median sets the zero point instead.
  const declining = (id: string, interestTrend: number) =>
    card({ id, heat: 50, interestTrend });

  const cohort = [
    declining('a', 0.86),
    declining('b', 0.9),
    declining('c', 0.9),
    declining('d', 0.95),
    declining('holding', 0.99),
  ];

  it('surfaces the subject losing ground slowest in a falling cohort', () => {
    const ranked = rankCards(cohort, new Set(), NOW, scoreTrending);
    expect(ranked[0].id).toBe('holding');
  });

  it('gives no credit at all for falling faster than the cohort', () => {
    // Everything at or below the median clamps to zero momentum rather than
    // going negative, so steep decliners tie at the bottom instead of being
    // ranked against each other. Ordering among them falls to demand, which
    // is the honest answer: we know they're all sinking, not which sinks best.
    const baseline = 0.9;
    expect(scoreTrending(declining('steep', 0.7), new Set(), NOW, baseline))
      .toBe(scoreTrending(declining('mild', 0.86), new Set(), NOW, baseline));
    expect(scoreTrending(declining('holding', 0.99), new Set(), NOW, baseline))
      .toBeGreaterThan(scoreTrending(declining('steep', 0.7), new Set(), NOW, baseline));
  });

  it('gives every product a trending signal on a fresh catalog', () => {
    // The point of the whole exercise: no product here has heatPrev, so
    // before this the entire sort collapsed to a tie on hotness.
    const scores = cohort.map((c) => scoreTrending(c, new Set(), NOW, 0.9));
    expect(new Set(scores).size).toBeGreaterThan(1);
  });

  it('stops reading readership once two real polls exist', () => {
    // Readership is a stand-in, not a rival. Once there's a measured delta
    // the inferred one must not leak in — otherwise a subject Wikipedia
    // likes would keep scoring after the pipeline had watched it go cold.
    const cold = card({ id: 'cold', heat: 50, heatPrev: 50, interestTrend: 2 });
    const coldNoTrend = card({ id: 'cold2', heat: 50, heatPrev: 50 });
    expect(scoreTrending(cold, new Set(), NOW, 1))
      .toBe(scoreTrending(coldNoTrend, new Set(), NOW, 1));
  });

  it('does not let two hot niches alternate forever', () => {
    // Readership is measured per subject, so every product in a niche scores
    // identically. Against only the previous pick, two niches would trade
    // places A-B-A-B and escape the penalty on every other turn — the feed
    // showed exactly two shelves interleaved before this was widened.
    const cards = [
      ...[1, 2, 3, 4].map((n) => card({ id: `a${n}`, category: 'Art', heat: 60, interestTrend: 1.4 })),
      ...[1, 2, 3, 4].map((n) => card({ id: `b${n}`, category: 'Beauty', heat: 60, interestTrend: 1.4 })),
      ...[1, 2].map((n) => card({ id: `c${n}`, category: 'Coffee', heat: 55, interestTrend: 1.2 })),
    ];
    const ranked = rankCards(cards, new Set(), NOW, scoreTrending);
    const firstCoffee = ranked.findIndex((c) => c.category === 'Coffee');
    expect(firstCoffee).toBeGreaterThanOrEqual(0);
    expect(firstCoffee).toBeLessThan(6);
  });

  it('falls back to absolute when the cohort is too small to mean anything', () => {
    const pair = [card({ id: 'up', heat: 50, interestTrend: 1.5 }), card({ id: 'flat', heat: 50, interestTrend: 1 })];
    const ranked = rankCards(pair, new Set(), NOW, scoreTrending);
    expect(ranked[0].id).toBe('up');
  });
});
