// AliExpress affiliate (Portals) API — the backbone of the pipeline.
//
// It's the only source that gives all three things at once: how many units
// actually sold, the unit cost you'd pay, and a link your users can buy
// through that pays you commission.
//
// Docs: https://portals.aliexpress.com  →  api.aliexpress.com/sync
// Requires an approved affiliate account. Signing is TOP-style: MD5 of the
// secret + sorted params + secret, uppercased.

import { createHash } from 'crypto';
import type { Adapter, Signal } from '../types';

// Read lazily. TypeScript hoists the emitted requires above every statement,
// so a module-scope read would happen before run.ts calls loadEnvFile() and
// the adapter would report itself unconfigured whatever is in .env.
const KEY = () => process.env.ALIEXPRESS_APP_KEY ?? '';
const SECRET = () => process.env.ALIEXPRESS_APP_SECRET ?? '';
const TRACKING = () => process.env.ALIEXPRESS_TRACKING_ID ?? 'salesmechanic';
const ENDPOINT = 'https://api-sg.aliexpress.com/sync';

function sign(params: Record<string, string>): string {
  const base = Object.keys(params).sort().map((k) => k + params[k]).join('');
  return createHash('md5').update(SECRET() + base + SECRET()).digest('hex').toUpperCase();
}

/** "2,431 sold" / "2431" / "10000+" all appear in the wild. */
function toCount(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return undefined;
  const digits = v.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : undefined;
}

export const aliexpress: Adapter = {
  name: 'aliexpress',
  configured: () => Boolean(KEY() && SECRET()),
  missing: () => 'ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET (portals.aliexpress.com)',

  async search(keyword: string): Promise<Signal[]> {
    const params: Record<string, string> = {
      method: 'aliexpress.affiliate.product.query',
      app_key: KEY(),
      timestamp: String(Date.now()),
      sign_method: 'md5',
      format: 'json',
      v: '2.0',
      keywords: keyword,
      page_size: '20',
      page_no: '1',
      sort: 'LAST_VOLUME_DESC', // best-selling first — that's the whole point
      target_currency: 'USD',
      target_language: 'EN',
      tracking_id: TRACKING(),
    };
    params.sign = sign(params);

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: any = await res.json();

    const err = json?.error_response;
    if (err) throw new Error(err.msg || err.sub_msg || 'API error');

    const products =
      json?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? [];

    return (Array.isArray(products) ? products : [products]).filter(Boolean).map((p: any): Signal => ({
      source: 'aliexpress',
      // Stamped over by safeSearch with the scope the runner intended: a
      // search for glaze is supply, a search for the product is demand.
      scope: 'product',
      productTitle: p.product_title,
      unitsSold: toCount(p.lastest_volume ?? p.latest_volume ?? p.volume),
      price: Number(p.target_sale_price ?? p.sale_price ?? p.original_price) || undefined,
      // `rating` used to be parsed here and read by nothing — dead code that
      // looked like a feature. Bring it back with a scorer that uses it.
      url: p.promotion_link || p.product_detail_url,
      imageUrl: p.product_main_image_url,
    }));
  },
};
