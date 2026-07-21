// Relationship scoring for client health.
//
// relationshipStrength (drives sorting/warmth): blends how often, how
// recently, and how valuable the interactions have been.
// engagementScore: frequency + recency only, reflecting cadence of contact
// independent of deal value.
//
// Weights are tuned per BUSINESS TYPE, because different businesses sell
// differently:
//   PRODUCT_SALES — many small transactions; value and frequency carry more.
//   SERVICE      — fewer, bigger deals with long cycles; staying recently
//                  in touch matters most, and relationships fade slower.
//   KNOWLEDGE    — courses/coaching; trust built over repeated touches, so
//                  frequency dominates.
//   OTHER        — balanced default.
//
// Both scores are 0-100.

export interface ScoreInput {
  occurredAt: Date;
  weight: number;
}

export interface Scores {
  relationshipStrength: number;
  engagementScore: number;
}

export type BusinessTypeKey = 'PRODUCT_SALES' | 'SERVICE' | 'KNOWLEDGE' | 'OTHER';

interface ScoreProfile {
  freqWeight: number;
  recencyWeight: number;
  valueWeight: number;
  recencyHalfLifeDays: number;
  freqSaturationCount: number;
  valueSaturationTotal: number;
}

const PROFILES: Record<BusinessTypeKey, ScoreProfile> = {
  PRODUCT_SALES: {
    freqWeight: 0.35, recencyWeight: 0.30, valueWeight: 0.35,
    recencyHalfLifeDays: 120, freqSaturationCount: 6, valueSaturationTotal: 15,
  },
  SERVICE: {
    freqWeight: 0.25, recencyWeight: 0.45, valueWeight: 0.30,
    recencyHalfLifeDays: 180, freqSaturationCount: 4, valueSaturationTotal: 12,
  },
  KNOWLEDGE: {
    freqWeight: 0.45, recencyWeight: 0.35, valueWeight: 0.20,
    recencyHalfLifeDays: 120, freqSaturationCount: 8, valueSaturationTotal: 12,
  },
  OTHER: {
    freqWeight: 0.35, recencyWeight: 0.35, valueWeight: 0.30,
    recencyHalfLifeDays: 120, freqSaturationCount: 6, valueSaturationTotal: 15,
  },
};

export function profileFor(businessType: string | null | undefined): ScoreProfile {
  return PROFILES[(businessType as BusinessTypeKey) ?? 'OTHER'] ?? PROFILES.OTHER;
}

export function computeScores(interactions: ScoreInput[], businessType?: string | null): Scores {
  if (interactions.length === 0) {
    return { relationshipStrength: 0, engagementScore: 0 };
  }
  const profile = profileFor(businessType);

  const freqNorm = Math.min(interactions.length / profile.freqSaturationCount, 1);

  const mostRecent = interactions.reduce((latest, i) =>
    i.occurredAt > latest ? i.occurredAt : latest, interactions[0].occurredAt);
  const daysSince = Math.max(0, (Date.now() - mostRecent.getTime()) / (1000 * 60 * 60 * 24));
  const recencyNorm = Math.max(0, 1 - daysSince / profile.recencyHalfLifeDays);

  const totalWeight = interactions.reduce((sum, i) => sum + i.weight, 0);
  const valueNorm = Math.min(totalWeight / profile.valueSaturationTotal, 1);

  const relationshipStrength = Math.round(
    100 * (profile.freqWeight * freqNorm + profile.recencyWeight * recencyNorm + profile.valueWeight * valueNorm)
  );

  // Engagement re-normalizes freq+recency to a full scale.
  const engagementDenominator = profile.freqWeight + profile.recencyWeight;
  const engagementScore = Math.round(
    (100 * (profile.freqWeight * freqNorm + profile.recencyWeight * recencyNorm)) / engagementDenominator
  );

  return { relationshipStrength, engagementScore };
}
