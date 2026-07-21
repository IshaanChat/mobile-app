// Detect which channel a contact came from based on a pasted URL.
// Known platforms map to first-class channel types; anything else becomes
// an OTHER channel labeled with a cleaned-up domain name ("tiktok.com" -> "Tiktok").

export interface DetectedChannel {
  type: 'ETSY' | 'INSTAGRAM' | 'REDDIT' | 'OTHER';
  label: string;
}

const KNOWN_DOMAINS: { match: string; type: DetectedChannel['type']; label: string }[] = [
  { match: 'etsy.com', type: 'ETSY', label: 'Etsy' },
  { match: 'instagram.com', type: 'INSTAGRAM', label: 'Instagram' },
  { match: 'reddit.com', type: 'REDDIT', label: 'Reddit' },
];

export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function detectChannel(rawUrl: string): DetectedChannel | null {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return null;

  const hostname = new URL(normalized).hostname.replace(/^www\./i, '').toLowerCase();

  for (const known of KNOWN_DOMAINS) {
    if (hostname === known.match || hostname.endsWith(`.${known.match}`)) {
      return { type: known.type, label: known.label };
    }
  }

  // Fallback: "shop.tiktok.com" -> "Tiktok", "craftfair.co.uk" -> "Craftfair"
  const parts = hostname.split('.');
  const core = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  const label = core.charAt(0).toUpperCase() + core.slice(1);
  return { type: 'OTHER', label };
}
