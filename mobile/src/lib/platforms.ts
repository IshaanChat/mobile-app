// Per-platform styling for Growth cards: a brand-adjacent accent color and
// an emoji mark. Used when a post has no hero image (most, until the
// enricher supplies them) so cards still read as visual, not text rows.

export interface PlatformStyle {
  color: string;
  emoji: string;
}

const PLATFORMS: Record<string, PlatformStyle> = {
  reddit: { color: '#FF4500', emoji: '👽' },
  instagram: { color: '#C13584', emoji: '📸' },
  tiktok: { color: '#0F0F0F', emoji: '🎵' },
  x: { color: '#1D1D1F', emoji: '💬' },
  youtube: { color: '#CC0000', emoji: '▶️' },
  etsy: { color: '#F1641E', emoji: '🧡' },
  pinterest: { color: '#E60023', emoji: '📌' },
  facebook: { color: '#1877F2', emoji: '👥' },
  forum: { color: '#5A67D8', emoji: '🗣️' },
};

export function platformStyle(platform: string): PlatformStyle {
  return PLATFORMS[platform.toLowerCase()] ?? { color: '#5A67D8', emoji: '🌐' };
}

export function formatMembers(count: number | null): string | null {
  if (count === null || count <= 0) return null;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M members`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}k members`;
  return `${count} members`;
}

export const KIND_LABELS: Record<string, string> = {
  community: 'Community',
  hashtag: 'Hashtag',
  marketplace: 'Marketplace',
  search: 'Search recipe',
  event: 'Event',
};
