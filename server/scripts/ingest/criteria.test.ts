// Fixture-driven: no network. The band shapes are the whole value here, and
// they fail silently — a criterion that quietly rewards the crowded end still
// returns a confident number and a plausible-looking shortlist.

import { describe, expect, it } from 'vitest';
import { assess, assessListing, demandScore, marginScore, rankScore, retailScore, shortlist, trendScore, verdictFor, PASS_SCORE, BORDERLINE_SCORE } from './criteria';

describe('demandScore', () => {
  it('rejects a product nobody is buying', () => {
    expect(demandScore(5)).toBe(0);
  });

  it('peaks where demand is proven but not answered', () => {
    // Near the top of the range but no longer a flat 1 — inside the band now
    // slopes toward the middle, which is what stops every qualifying product
    // scoring identically.
    expect(demandScore(600)).toBeGreaterThan(0.95);
    expect(demandScore(675)).toBe(1); // dead centre
    expect(demandScore(675)).toBeGreaterThan(demandScore(160));
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

  it('reads position relative to the list once the list is long', () => {
    // The regression that broke ranking at scale. Absolute positions scored
    // zero past 90, so in an 11,000-product pull an 18% weight became the
    // same constant for everyone and 607 of 662 picks tied on one number.
    expect(rankScore(400, 5000)).toBeGreaterThan(0);
    expect(rankScore(4900, 5000)).toBeLessThan(rankScore(2000, 5000));
  });

  it('still reads a single page absolutely', () => {
    // 40th of 50 and 40th of 5,000 are different claims; a percentile over
    // 20 items would be too coarse to mean anything.
    expect(rankScore(40, 50)).toBeGreaterThan(rankScore(2, 50));
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

describe('assessListing — working back from what it sells for', () => {
  const listed = { retail: 34, listings: 90, interestTrend: 1.1, rank: 20, unitsSold: 600 };

  it('states the sourcing target rather than needing a cost', () => {
    // The whole inversion. Cost is the number nobody publishes; retail is
    // public everywhere. Given one, the criteria fix the other.
    const a = assessListing(listed);
    expect(a.target?.max).toBeCloseTo(34 / 3, 5);
    expect(a.target?.ideal).toBeCloseTo(34 / 5, 5);
    expect(a.verdict).toBe('pass');
  });

  it('says the target out loud, in money', () => {
    expect(assessListing(listed).reasons.join(' ')).toContain('source under $11.33');
  });

  it('rejects a price too low to split', () => {
    expect(assessListing({ ...listed, retail: 6 }).verdict).toBe('reject');
  });

  it('tolerates a missing sales figure, since catalogs list rather than sell', () => {
    // Absence of a sold count is normal for a retail catalog and must not be
    // treated as absence of demand — that would reject nearly everything.
    const a = assessListing({ ...listed, unitsSold: undefined });
    expect(a.blockers).toEqual([]);
    expect(a.reasons.join(' ')).toContain('Listed rather than proven');
  });

  it('rejects when nothing at all indicates a market', () => {
    const a = assessListing({ retail: 34, unitsSold: undefined, listings: undefined });
    expect(a.verdict).toBe('reject');
    expect(a.blockers.join(' ')).toContain('Nothing indicates a market');
  });

  it('agrees with the cost-side path on the same product', () => {
    // A $34 seller sourced at $8 should pass either way round. If the two
    // entry points disagreed on an identical product the criteria would mean
    // two different things depending on which door you came through.
    expect(assessListing(listed).verdict).toBe('pass');
    expect(assess({ cost: 8, unitsSold: 600, listings: 90, interestTrend: 1.1, rank: 20 }).verdict).toBe('pass');
  });
});

describe('the bar', () => {
  it('rejects a handful of orders as noise', () => {
    // Raised to 100 after the first real pull wrote products with 47, 52 and
    // 53 recent sales — above the old floor of 40, and nowhere near enough to
    // separate an early trend from a month that happened to go well.
    expect(assess({ cost: 6.5, unitsSold: 99, rank: 20 }).verdict).toBe('reject');
    expect(assess({ cost: 6.5, unitsSold: 400, rank: 20 }).verdict).toBe('pass');
  });

  it('holds back the merely defensible', () => {
    // A 200,000-product feed is not short of candidates, so the bar sits at
    // "worth someone's first business", not at "nothing wrong with it".
    expect(verdictFor(PASS_SCORE, [])).toBe('pass');
    expect(verdictFor(PASS_SCORE - 1, [])).toBe('borderline');
    expect(verdictFor(BORDERLINE_SCORE - 1, [])).toBe('reject');
  });

  it('lets a blocker beat any score', () => {
    expect(verdictFor(99, ['nope'])).toBe('reject');
  });

  it('applies the same boundaries from either entry point', () => {
    // Two doors into one set of criteria; if they disagreed, "passes the
    // criteria" would mean different things depending on the data source.
    const cost = assess({ cost: 8, unitsSold: 600, listings: 90, rank: 20 });
    const listing = assessListing({ retail: 34, unitsSold: 600, listings: 90, rank: 20 });
    expect(cost.verdict).toBe('pass');
    expect(listing.verdict).toBe('pass');
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
