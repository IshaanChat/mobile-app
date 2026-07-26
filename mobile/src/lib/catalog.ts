// Discover's vocabulary — the labels and formatters the card renders with.
// Ported from the prototype so the two surfaces say the same words, in the
// same order, about the same things. Same job lib/platforms.ts does for Grow.

import type { Audience, DiscoverEvidence, SourcingType } from '@/types';

export const SOURCING_LABELS: Record<SourcingType, string> = {
  DROPSHIP: 'Dropship',
  WHOLESALE: 'Wholesale',
  PRINT_ON_DEMAND: 'Print on demand',
  MATERIALS: 'Materials',
  MAKE_YOUR_OWN: 'Make your own',
};

export const AUDIENCE_LABELS: Record<Audience, string> = {
  maker: 'Maker',
  reseller: 'Reseller',
  both: 'Maker + reseller',
};

// Deepened from the palette on purpose: these chips sit on top of a photo
// and carry white text, so the theme's lighter accents wouldn't hold up.
export const AUDIENCE_COLORS: Record<Audience, string> = {
  maker: '#4A7C61',
  reseller: '#8C5E15',
  both: '#A8536C',
};

/** 2,400 -> "2.4k". Long numbers turn a chip into a paragraph. */
export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

/**
 * At most two chips, hardest claim first. A strip of five reads as marketing
 * rather than evidence, and the point of these is that they're checkable.
 *
 * Returns nothing at all when there's no evidence block — which is every
 * product until an API key lands. A card with no numbers should look like a
 * card with no numbers.
 */
export function evidenceChips(e: DiscoverEvidence | null): { icon: 'flame' | 'spark'; text: string }[] {
  if (!e) return [];
  const chips: { icon: 'flame' | 'spark'; text: string }[] = [];
  if (e.unitsSold) chips.push({ icon: 'flame', text: `${compact(e.unitsSold)} sold` });
  // A week is the floor for an ad run meaning anything — below that it's
  // still a test, not evidence somebody is committed to it.
  if (e.adDaysLive && e.adDaysLive >= 7) {
    chips.push({ icon: 'flame', text: `${e.adDaysLive} days live` });
  }
  // Only shown when readership is actually growing in absolute terms. The
  // ranker compares each subject against its peers, because nearly
  // everything drifts down together — but a chip claiming "rising" on a
  // subject that lost 8% would be a lie, however well it did relatively.
  if (e.interestTrend !== null && e.interestTrend > 1.05) {
    chips.push({ icon: 'spark', text: `+${Math.round((e.interestTrend - 1) * 100)}% interest` });
  }
  if (e.saturation === 'low' && e.listings !== null) {
    chips.push({ icon: 'spark', text: 'low competition' });
  }
  return chips.slice(0, 2);
}

/** How stale the ad evidence is, for the manual bench's freshness warning. */
export function daysSincePolled(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}
