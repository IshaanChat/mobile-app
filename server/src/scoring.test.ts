import { describe, it, expect } from 'vitest';
import { computeScores, profileFor } from './scoring';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

describe('computeScores', () => {
  it('returns zero for a contact with no interactions', () => {
    expect(computeScores([])).toEqual({ relationshipStrength: 0, engagementScore: 0 });
  });

  it('keeps both scores within 0-100 even when saturated', () => {
    const many = Array.from({ length: 50 }, () => ({ occurredAt: new Date(), weight: 5 }));
    const { relationshipStrength, engagementScore } = computeScores(many, 'PRODUCT_SALES');
    expect(relationshipStrength).toBeGreaterThan(0);
    expect(relationshipStrength).toBeLessThanOrEqual(100);
    expect(engagementScore).toBeLessThanOrEqual(100);
  });

  it('scores a recent interaction higher than an old one', () => {
    const recent = computeScores([{ occurredAt: daysAgo(1), weight: 3 }]);
    const old = computeScores([{ occurredAt: daysAgo(200), weight: 3 }]);
    expect(recent.relationshipStrength).toBeGreaterThan(old.relationshipStrength);
  });

  it('never goes negative for interactions older than the decay window', () => {
    const ancient = computeScores([{ occurredAt: daysAgo(10_000), weight: 1 }]);
    expect(ancient.relationshipStrength).toBeGreaterThanOrEqual(0);
    expect(ancient.engagementScore).toBeGreaterThanOrEqual(0);
  });

  it('scores more interactions higher than fewer, all else equal', () => {
    const few = computeScores([{ occurredAt: daysAgo(2), weight: 2 }]);
    const many = computeScores([
      { occurredAt: daysAgo(2), weight: 2 },
      { occurredAt: daysAgo(3), weight: 2 },
      { occurredAt: daysAgo(4), weight: 2 },
    ]);
    expect(many.relationshipStrength).toBeGreaterThan(few.relationshipStrength);
  });

  it('ignores interaction value in the engagement score', () => {
    const light = computeScores([{ occurredAt: daysAgo(1), weight: 1 }]);
    const heavy = computeScores([{ occurredAt: daysAgo(1), weight: 5 }]);
    expect(light.engagementScore).toBe(heavy.engagementScore);
    // ...but value does move relationship strength.
    expect(heavy.relationshipStrength).toBeGreaterThan(light.relationshipStrength);
  });

  describe('business-type personalization', () => {
    it('lets a SERVICE relationship decay more slowly than PRODUCT_SALES', () => {
      const stale = [{ occurredAt: daysAgo(150), weight: 3 }];
      const service = computeScores(stale, 'SERVICE');
      const product = computeScores(stale, 'PRODUCT_SALES');
      // Long sales cycles: a 5-month-old touch still counts for services.
      expect(service.relationshipStrength).toBeGreaterThan(product.relationshipStrength);
    });

    it('weights repeat contact more heavily for KNOWLEDGE than PRODUCT_SALES', () => {
      const frequent = Array.from({ length: 4 }, (_, i) => ({ occurredAt: daysAgo(i + 1), weight: 1 }));
      const knowledge = computeScores(frequent, 'KNOWLEDGE');
      const product = computeScores(frequent, 'PRODUCT_SALES');
      expect(knowledge.relationshipStrength).toBeGreaterThan(product.relationshipStrength);
    });

    it('falls back to the balanced profile for unknown or missing types', () => {
      expect(profileFor(null)).toEqual(profileFor('OTHER'));
      expect(profileFor('NOT_A_REAL_TYPE')).toEqual(profileFor('OTHER'));
    });
  });
});
