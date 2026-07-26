// Shared shape every ingest adapter returns. Sources measure wildly different
// things — units sold, competing listings, comment counts — so each adapter
// normalises into this and the scorer reconciles them.

export type SourceName = 'aliexpress' | 'ebay' | 'reddit' | 'youtube';

export interface Signal {
  source: SourceName;
  /** What the source called it — used when discovering new products. */
  productTitle?: string;
  /** Units actually sold. The strongest signal we can get. */
  unitsSold?: number;
  /** Competing sellers — high means saturated, not popular. */
  listings?: number;
  /** Community mentions in the period. */
  mentions?: number;
  /** Video views for "<keyword> review" and similar. */
  views?: number;
  price?: number;
  rating?: number;
  url?: string;
  imageUrl?: string;
}

export interface Signals {
  heat: number;
  unitsSold?: number;
  listings?: number;
  mentions?: number;
  views?: number;
  priceLow?: number;
  priceHigh?: number;
  sources: SourceName[];
  polledAt: string;
}

export interface Adapter {
  name: SourceName;
  /** False when the adapter has no credentials — the runner skips it. */
  configured(): boolean;
  /** Why it's skipped, shown once at startup. */
  missing(): string;
  search(keyword: string): Promise<Signal[]>;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Adapters fail soft: a dead source shouldn't abort a whole run. */
export async function safeSearch(a: Adapter, keyword: string): Promise<Signal[]> {
  try {
    return await a.search(keyword);
  } catch (err: any) {
    console.warn(`  \x1b[33m${a.name} failed for "${keyword}": ${err.message}\x1b[0m`);
    return [];
  }
}
