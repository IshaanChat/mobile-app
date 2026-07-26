// Fixture-driven: no network. The band shapes are the whole value here, and
// they fail silently — a criterion that quietly rewards the crowded end still
// returns a confident number and a plausible-looking shortlist.

import { describe, expect, it } from 'vitest';
import { assess, demandScore, marginScore, rankScore, retailScore, shortlist, trendScore } from './criteria';

describe('demandScore', () => {
  it('rejects a product nobody is buying', () => {
    expect(demandScore(5)).toBe(0);
  });

  it('peaks where demand is proven but not answered', () => {
    expect(demandScore(600)).toBe(1);
  });

  it('marks DOWN the best-selling end, not up', () => {
    // The entire reason this module exists. Ranking by volume gave this case
    // the top score, which is how discovery kept surfacing the most
    // contested products on the page.
    expect(demandScore(9000)).toBeLessThan(demandScore(600));
  });

  it('still prefers a crowded market to a dead one', () => {
    // Over-correcting would be its own bug: no demand is worse than shared
    // demand, and a band that punished volume hard enough would invert into
    // recommending products nobody wants.
    expect(demandScore(9000)).toBeGreaterThan(demandScore(20));
  });
});

describe('rankScore', () => {
  it('prefers mid-page to the top of the best-seller list', () => {
    // Everyone runs the same search and works down from the top, so position
    // 0 is the most contested listing on the page nearly by definition.
    expect(rankScore(25)).toBeGreaterThan(rankScore(0));
  });

  it('holds no opinion when position is unknown', () => {
    expect(rankScore(undefined)).toBe(0.5);
  });
});

describe('margin and retail', () => {
  it('scores a cheap sourceable item above an expensive one', () => {
    expect(marginScore(6)).toBeGreaterThan(marginScore(14));
  });

  it('distrusts the very bottom of the price range', () => {
    // Under a dollar or two the product usually cannot survive a refund
    // policy, whatever the margin looks like on paper.
    expect(marginScore(0.4)).toBeLessThan(marginScore(6));
  });

  it('wants the achievable retail to land where buyers are', () => {
    expect(retailScore(8)).toBeGreaterThan(retailScore(1.2));
  });
});

describe('trendScore', () => {
  it('treats flat as fine and falling as the problem', () => {
    expect(trendScore(1.0)).toBeGreaterThan(0.3);
    expect(trendScore(0.7)).toBe(0);
  });
});

describe('assess', () => {
  const good = { unitsSold: 700, cost: 6.5, listings: 90, interestTrend: 1.15, rank: 22 };

  it('passes a product that clears every bar', () => {
    const a = assess(good);
    expect(a.verdict).toBe('pass');
    expect(a.blockers).toEqual([]);
    expect(a.retail).toEqual({ low: 19.5, high: 32.5 });
  });

  it('rejects on cost even when everything else is excellent', () => {
    // Blockers sit outside the score on purpose. Averaging a hard fact away
    // would let a strong trend smuggle through something unsellable.
    const a = assess({ ...good, cost: 40 });
    expect(a.verdict).toBe('reject');
    expect(a.blockers[0]).toContain('ceiling');
  });

  it('rejects something too cheap to be worth fulfilling', () => {
    const a = assess({ ...good, cost: 1.2 });
    expect(a.verdict).toBe('reject');
    expect(a.blockers.join(' ')).toContain('too thin');
  });

  it('rejects a product with no proven demand', () => {
    expect(assess({ ...good, unitsSold: 3 }).verdict).toBe('reject');
    expect(assess({ ...good, unitsSold: undefined }).verdict).toBe('reject');
  });

  it('says out loud when a market is already served', () => {
    const a = assess({ ...good, unitsSold: 9000 });
    expect(a.reasons.join(' ')).toContain('already well served');
  });

  it('warns when a product is top of the best-seller list', () => {
    const a = assess({ ...good, rank: 0 });
    expect(a.reasons.join(' ')).toContain('every other seller is already looking');
  });
});

describe('shortlist', () => {
  it('does not simply return the highest volume first', () => {
    // The regression that matters. Given the old ranking, the 12,000-unit
    // item led the list; it should now lose to proven-but-quieter demand.
    const page = [
      { unitsSold: 12000, cost: 7 },  // rank 0 — the contested one
      { unitsSold: 40000, cost: 9 },  // rank 1
      { unitsSold: 800, cost: 6.5 },  // rank 2 — the one worth selling
    ];
    expect(shortlist(page)[0].candidate.unitsSold).toBe(800);
  });

  it('drops candidates with blockers entirely', () => {
    const page = [
      { unitsSold: 900, cost: 60 },   // unsourceable at that cost
      { unitsSold: 2, cost: 6 },      // no demand
      { unitsSold: 700, cost: 6.5 },
    ];
    const out = shortlist(page);
    expect(out).toHaveLength(1);
    expect(out[0].candidate.cost).toBe(6.5);
  });

  it('uses list position as rank when none was given', () => {
    // Position is just the array index, so it costs nothing to collect and
    // should never be silently absent.
    const page = [{ unitsSold: 700, cost: 6.5 }, { unitsSold: 700, cost: 6.5 }];
    const out = shortlist(page);
    expect(out[0].assessment.score).toBeGreaterThanOrEqual(out[1].assessment.score);
  });
});
