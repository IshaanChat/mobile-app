// Shared shape every ingest adapter returns. Sources measure wildly different
// things — units sold, competing listings, live ad creatives — so each adapter
// normalises into this and the scorer reconciles them.

export type SourceName = 'aliexpress' | 'etsy' | 'meta' | 'wikipedia' | 'cj' | 'printful' | 'ebay';

/**
 * What a number is ABOUT, which matters more than what it is.
 *
 * The pipeline's worst failure mode is attributing a supply-side measurement
 * to the thing being sold. Four fifths of the catalog is products the seller
 * makes: for those, `imageQuery` is "potter glazing ceramic bowl" and
 * `sourcingUrl` points at wholesale pottery glaze, so AliExpress is measuring
 * the market for clay, not for mugs. Reporting "4,200 sold" on a hand-thrown
 * mug because that many pots of glaze moved is inventing evidence.
 *
 *   product  — the searched term IS the thing being sold. Demand evidence.
 *   supply   — the searched term is an input to it. Price evidence only.
 *   category — the searched term is a market, not one listing. Saturation
 *              and ad-pressure evidence; never per-product demand.
 */
export type SignalScope = 'product' | 'supply' | 'category';

export interface Signal {
  source: SourceName;
  scope: SignalScope;
  /** What the source called it — used when discovering new products. */
  productTitle?: string;
  /** Units actually sold. Only ever trusted when scope is 'product'. */
  unitsSold?: number;
  /** Competing sellers — high means saturated, not popular. */
  listings?: number;
  /** What it costs to SOURCE. Supplier-side. */
  price?: number;
  /**
   * What it SELLS for. Demand-side, and deliberately a separate field.
   *
   * These are opposite ends of the same trade and merging them would be the
   * costliest possible unit error — a $34 eBay selling price landing in
   * `priceLow` reads as a $34 sourcing cost, which the criteria would reject
   * as unfundable when it is in fact the good news. Only ever set by a
   * marketplace reporting what buyers pay.
   */
  retailPrice?: number;
  url?: string;
  imageUrl?: string;

  /** Distinct live ad creatives matching the keyword. */
  ads?: number;
  /**
   * Longest continuous run among them, in days. The winning-product
   * heuristic: an ad still running after weeks is one somebody pays for
   * daily and hasn't switched off.
   */
  adDaysLive?: number;
  /** People reached. Stored and shown, deliberately never scored. */
  adReach?: number;
  /** 'EU' — all of Meta's non-political ad data is EU-reach only. */
  adCoverage?: string;
  advertiserName?: string;
  /** The landing domain, the closest thing to a product identity an ad has. */
  advertiserDomain?: string;

  /** Mean daily readers of the subject. Attention, not purchases. */
  interest?: number;
  /**
   * Recent month over the one before it, as a ratio: 1.35 is a third more
   * attention. The only signal here that arrives already differentiated, so
   * it's what lets "trending" mean something on the very first poll.
   */
  interestTrend?: number;

  /** A live listing found in a merchant catalog, and who sells it. */
  liveSourcingUrl?: string;
  liveMerchant?: string;
}

export interface Signals {
  heat: number;
  unitsSold?: number;
  listings?: number;
  priceLow?: number;
  priceHigh?: number;
  /** What buyers pay, where a retail marketplace reported it. */
  retailLow?: number;
  retailHigh?: number;
  /** Worked back from retail: the most it can cost and still be worth doing. */
  sourceUnder?: number;
  ads?: number;
  adDaysLive?: number;
  adReach?: number;
  adCoverage?: string;
  advertiserName?: string;
  interest?: number;
  interestTrend?: number;
  liveSourcingUrl?: string;
  liveMerchant?: string;
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

/**
 * Adapters fail soft: a dead source shouldn't abort a whole run.
 *
 * Scope is stamped on here by the caller rather than taken from the adapter,
 * because only the runner knows whether a given keyword was the product or
 * the materials it's made from. An adapter can't report its own scope
 * honestly, so it isn't asked to.
 */
export async function safeSearch(a: Adapter, keyword: string, scope: SignalScope): Promise<Signal[]> {
  try {
    const signals = await a.search(keyword);
    return signals.map((s) => ({ ...s, scope }));
  } catch (err: any) {
    console.warn(`  \x1b[33m${a.name} failed for "${keyword}": ${err.message}\x1b[0m`);
    return [];
  }
}
