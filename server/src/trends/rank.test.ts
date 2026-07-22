import { describe, expect, it } from 'vitest';
import { rankCards, tokenize, type RankableCard } from './rank';

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
});
