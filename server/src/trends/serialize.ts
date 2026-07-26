// The Discover card, in one place.
//
// This used to be written inline in routes/trends.ts — once for the feed and
// again for the saved shelf — and the two had already drifted apart. Any
// client reading Discover reads this shape, which is what makes the feed
// reusable by the web app rather than just technically available to it.

import type { Niche, TrendProduct } from '@prisma/client';

export type TrendProductWithNiche = TrendProduct & { niche: Niche | null };

/**
 * Saturation as a word rather than a raw count, because "412 listings" means
 * nothing without knowing what normal looks like. Thresholds match
 * scripts/ingest/score.ts so the feed and the scorer never disagree.
 */
export function saturationLabel(listings: number | null): 'low' | 'medium' | 'high' | null {
  if (listings === null) return null;
  if (listings < 120) return 'low';
  if (listings < 600) return 'medium';
  return 'high';
}

export interface DiscoverEvidence {
  heat: number | null;
  /** Change since the previous poll. Null until there are two readings. */
  heatDelta: number | null;
  unitsSold: number | null;
  listings: number | null;
  saturation: 'low' | 'medium' | 'high' | null;
  priceLow: number | null;
  priceHigh: number | null;
  adCount: number | null;
  adDaysLive: number | null;
  adReach: number | null;
  /** 'meta' | 'manual' — where the ad evidence came from. */
  adSource: string | null;
  /** 'EU' when the ad data only covers EU-reaching ads, which Meta's does. */
  adCoverage: string | null;
  adEvidenceUrl: string | null;
  adAdvertiser: string | null;
  sources: string[];
  polledAt: Date | null;
}

/**
 * `evidence` is null when nothing has actually been measured — which is every
 * product until an API key exists. That nullability is the honest bit: the
 * card renders no evidence strip at all rather than dressing the curator's
 * editorial `hotness` up as data.
 */
export function toDiscoverProduct(p: TrendProductWithNiche, saved: boolean) {
  const measured = p.heat !== null || p.adDaysLive !== null || p.listings !== null;

  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    blurb: p.blurb,
    category: p.category,
    niche: p.niche
      ? {
          slug: p.niche.slug,
          name: p.niche.name,
          domain: p.niche.domain,
          audience: p.niche.audience,
        }
      : null,
    sourcingType: p.sourcingType,
    sourceName: p.sourceName,
    sourcingUrl: p.sourcingUrl ?? p.sourceUrl,
    sourceCost: p.sourceCost,
    typicalResale: p.typicalResale,
    priceRange: p.priceRange,
    imageUrl: p.imageUrl,
    imageCredit: p.imageCredit,
    hotness: p.hotness,
    evidence: measured
      ? ({
          heat: p.heat,
          heatDelta: p.heat !== null && p.heatPrev !== null ? p.heat - p.heatPrev : null,
          unitsSold: p.unitsSold,
          listings: p.listings,
          saturation: saturationLabel(p.listings),
          priceLow: p.priceLow,
          priceHigh: p.priceHigh,
          adCount: p.adCount,
          adDaysLive: p.adDaysLive,
          adReach: p.adReach,
          adSource: p.adSource,
          adCoverage: p.adCoverage,
          adEvidenceUrl: p.adEvidenceUrl,
          adAdvertiser: p.adAdvertiser,
          sources: p.signalSources ? p.signalSources.split(',').filter(Boolean) : [],
          polledAt: p.signalsPolledAt,
        } satisfies DiscoverEvidence)
      : null,
    saved,
  };
}

export type DiscoverProduct = ReturnType<typeof toDiscoverProduct>;
