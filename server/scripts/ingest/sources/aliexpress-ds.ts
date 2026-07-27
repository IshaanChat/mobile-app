// AliExpress Dropshipper (DS) API — bulk product feeds.
//
// Docs: https://openservice.aliexpress.com/doc/api.htm  (aliexpress.ds.*)
//
// This exists because the affiliate adapter next door cannot work with this
// app's credentials, and no amount of configuration will change that. Probed
// against the live API: every `aliexpress.affiliate.*` method returns "App
// does not have permission to access this api" — product.query, hotproduct.
// query, category.get and link.generate alike, including when a tracking_id
// is supplied. The permission set is the gate, not the parameters, so chasing
// a tracking ID is wasted effort.
//
// The same credentials have full access to `aliexpress.ds.*`, which is the
// better family for this anyway: it is the dropshipping API, and it returns
// bulk curated feeds rather than the keyword search everyone else runs.
//
// One thing it does NOT give: keyword search. `aliexpress.ds.text.search` is
// permitted but answers EXCEPTION_TEXT_SEARCH_FOR_DS on every parameter
// combination tried, and `ds.product.get` needs an OAuth access_token, which
// is a user-authorisation flow rather than an app credential. So discovery
// here is feed-shaped, not query-shaped.
//
// That difference is a feature. Searching a niche keyword returns what
// everybody searching that keyword sees; a feed is a curated pool nobody
// else is ranking with your criteria.

import { createHash } from 'crypto';

const ENDPOINT = 'https://api-sg.aliexpress.com/sync';

const KEY = () => process.env.ALIEXPRESS_APP_KEY ?? '';
const SECRET = () => process.env.ALIEXPRESS_APP_SECRET ?? '';

export const configured = () => Boolean(KEY() && SECRET());

/** TOP-style signing: MD5 of secret + sorted params + secret, uppercased. */
function sign(params: Record<string, string>): string {
  const base = Object.keys(params).sort().map((k) => k + params[k]).join('');
  return createHash('md5').update(SECRET() + base + SECRET()).digest('hex').toUpperCase();
}

export async function call(method: string, extra: Record<string, string> = {}): Promise<any> {
  const params: Record<string, string> = {
    method,
    app_key: KEY(),
    timestamp: String(Date.now()),
    sign_method: 'md5',
    format: 'json',
    v: '2.0',
    ...extra,
  };
  params.sign = sign(params);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json: any = await res.json();
  if (json?.error_response) {
    const e = json.error_response;
    throw new Error(e.msg ?? e.sub_msg ?? 'API error');
  }
  return json;
}

export interface Feed {
  name: string;
  productCount: number;
}

/** The 124 curated pools this app is allowed to draw from. */
export async function feeds(): Promise<Feed[]> {
  const json = await call('aliexpress.ds.feedname.get');
  const promos = json?.aliexpress_ds_feedname_get_response?.resp_result?.result?.promos?.promo ?? [];
  return promos.map((p: any) => ({ name: p.promo_name, productCount: Number(p.product_num) || 0 }));
}

/** One product as the feed reports it, before any judgement is applied. */
export interface FeedProduct {
  productId: string;
  title: string;
  /** What it costs to source, in the requested currency. */
  cost: number;
  originalPrice?: number;
  discount?: string;
  /** Recent units moved. The feeds differ enormously in whether they set it. */
  unitsSold?: number;
  imageUrl?: string;
  images: string[];
  videoUrl?: string;
  /** AliExpress's own taxonomy, which is NOT this project's niches. */
  categoryTop?: string;
  categorySub?: string;
  /** Carries `affd` affiliate parameters already, so attribution rides along. */
  url: string;
  shopUrl?: string;
}

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function toProduct(raw: any): FeedProduct | undefined {
  const cost = num(raw?.target_sale_price ?? raw?.sale_price);
  const title = String(raw?.product_title ?? '').trim();
  if (!cost || !title) return undefined;
  return {
    productId: String(raw?.product_id ?? ''),
    title,
    cost,
    originalPrice: num(raw?.target_original_price ?? raw?.original_price),
    discount: raw?.discount ? String(raw.discount) : undefined,
    // Absent on many feeds. Deliberately left undefined rather than zeroed —
    // "no figure reported" and "nobody bought one" are different claims, and
    // the criteria treat them differently.
    unitsSold: num(raw?.lastest_volume ?? raw?.latest_volume ?? raw?.volume),
    imageUrl: raw?.product_main_image_url,
    images: raw?.product_small_image_urls?.productSmallImageUrl ?? [],
    videoUrl: raw?.product_video_url || undefined,
    categoryTop: raw?.first_level_category_name,
    categorySub: raw?.second_level_category_name,
    url: raw?.product_detail_url ?? '',
    shopUrl: raw?.shop_url,
  };
}

export interface FetchOptions {
  pages?: number;
  pageSize?: number;
  country?: string;
  currency?: string;
  language?: string;
  /** Called after each page, so a long pull can report progress. */
  onPage?: (page: number, got: number) => void;
}

/**
 * Pull a feed, page by page.
 *
 * Pages are requested in order and concatenated in order, because the runner
 * turns array position into the `rank` the criteria score — position is the
 * cheapest crowding proxy available and reordering would silently destroy it.
 */
export async function fetchFeed(feedName: string, opts: FetchOptions = {}): Promise<FeedProduct[]> {
  const { pages = 3, pageSize = 50, country = 'US', currency = 'USD', language = 'EN', onPage } = opts;
  const out: FeedProduct[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= pages; page++) {
    const json = await call('aliexpress.ds.recommend.feed.get', {
      feed_name: feedName,
      country,
      target_currency: currency,
      target_language: language,
      page_size: String(pageSize),
      page_no: String(page),
    });
    const result = json?.aliexpress_ds_recommend_feed_get_response?.result;
    const raw: any[] = result?.products?.traffic_product_d_t_o ?? result?.products?.product ?? [];

    let added = 0;
    for (const r of raw) {
      const p = toProduct(r);
      // Feeds repeat products across pages often enough to matter — a plain
      // concat produced the same item three times in a 144-product pull.
      if (!p || (p.productId && seen.has(p.productId))) continue;
      seen.add(p.productId);
      out.push(p);
      added++;
    }
    onPage?.(page, added);

    // Stop only on a genuinely empty page. A SHORT page is not the last one
    // here — this feed answers a request for 50 with 48 and still has plenty
    // behind it, so the usual "short means done" rule ended every pull after
    // page 1 and quietly capped the catalog at a third of what was available.
    if (!raw.length) break;
    await new Promise((r) => setTimeout(r, 600)); // stay well inside the rate limit
  }
  return out;
}
