// Printful catalog — what the blank actually costs before you print on it.
//
// Docs: https://developers.printful.com/docs/  (v1 catalog)
//
// The second adapter here needing no credential of any kind, and the only one
// that answers the question print-on-demand rows actually turn on: what does
// this cost me per unit? v1's /products and /products/{id} are open — no key,
// no OAuth, no signup. (v2's /v2/catalog-* endpoints are NOT: they answer
// "This endpoint requires Oauth authentication!" despite what several guides
// claim. Verified by calling both. Do not "upgrade" this to v2 without a
// token in hand.)
//
// Why this matters for the catalog we have: the 20 PRINT_ON_DEMAND products
// carry hand-estimated costs like "$8–14 fulfilled". Those were reasonable
// guesses, but a guess is exactly what this project says it will not ship.
// Printful publishes the real number per variant, so the guess can go.
//
// What it is NOT: evidence of demand. Printful is the supplier, not the
// market — it knows what a Bella+Canvas 3001 costs to make and nothing
// whatsoever about whether anyone wants yours. It reports `price` and stops.
// It deliberately never sets unitsSold (nobody bought anything) or listings
// (variant count is colours and sizes, not competing sellers); either would
// be a supply fact wearing a demand costume, which is the one failure mode
// types.ts exists to prevent.

import type { Adapter, Signal } from '../types';

const BASE = 'https://api.printful.com';

// Same etiquette as the Wikimedia adapter: a free service, used politely.
const UA = 'Venturo/0.1 (https://github.com/IshaanChat/sales-mechanic; product cost research)';

export interface CatalogEntry {
  id: number;
  title: string;
  type: string;
  type_name?: string;
  brand?: string | null;
  model?: string | null;
  image?: string;
  variant_count?: number;
  is_discontinued?: boolean;
}

export interface Variant {
  id: number;
  name?: string;
  price?: string | number;
  availability_status?: string;
}

/**
 * The catalog is 517 entries and changes on the order of weeks, so it is
 * fetched once per run and shared. Matching happens locally against that
 * index; only the single winning product costs a second call.
 */
let catalogPromise: Promise<CatalogEntry[]> | null = null;
const cache = new Map<string, Signal[]>();

export function resetCache() {
  cache.clear();
  catalogPromise = null;
}

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'your', 'you', 'of', 'in', 'on',
  'to', 'my', 'our', 'custom', 'personalised', 'personalized', 'printed',
  'set', 'sets', 'pack', 'packs', 'niche', 'local', 'hometown',
]);
// "printed" is decoration — in "printed canvas book totes" the product is the
// tote. The bare noun "print" is NOT noise and must not join it: a "star-map
// print" is a poster, and stopping it here silently deleted the only word in
// the row that named a product. It also made the bug size-dependent, since
// "prints" survived the stop list and reached the synonym map while "print"
// never did — one row priced and the next one blank for no visible reason.

/**
 * Curators name the garment the way a seller talks; Printful names it the way
 * a factory does. "Tees" and "T-Shirt" are the same blank, and nothing in the
 * text says so — the first version of this matched neither.
 */
const SYNONYMS: Record<string, string> = {
  tee: 'shirt', tshirt: 'shirt', teeshirt: 'shirt',
  print: 'poster', // a "star-map print" is a poster to the people who make it
  hoody: 'hoodie', jumper: 'sweatshirt', sweater: 'sweatshirt',
};

export const tokens = (s: string): string[] =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
    // "tees" and "tee", "mugs" and "mug" are the same product to a supplier.
    .map((t) => (t.endsWith('s') && t.length > 3 ? t.slice(0, -1) : t))
    .map((t) => SYNONYMS[t] ?? t);

/**
 * The nouns that actually name a sellable blank.
 *
 * Curated rather than derived, because Printful's own taxonomy will not carry
 * the weight: `type` files "Car Magnets" under PHONE-CASE, and the useful half
 * of `type_name` is brand SKUs like "AS Colour 5025" — 440 distinct heads with
 * no clean product noun among them.
 *
 * Without this gate a single shared adjective scores a perfect match on the
 * wrong item. Measured against the real catalog: "Film-photography print
 * drops" matched a Men's *Drop* Arm Tank Top, "*Pet*-portrait blankets"
 * matched a Knitted Pet Sweater, "*Baby* milestone card sets" matched a Baby
 * Tee, and "*Vintage*-botanical print sets" matched a Vintage T-Shirt. Every
 * one returned a confident and entirely wrong cost.
 */
const PRODUCT_NOUNS = new Set([
  'shirt', 'hoodie', 'sweatshirt', 'sweater', 'tank', 'top', 'dress', 'legging',
  'sock', 'hat', 'cap', 'beanie', 'jersey', 'short', 'pant', 'jacket', 'vest',
  'scarf', 'bandana', 'headband', 'robe', 'swimsuit', 'onesie', 'bodysuit', 'bib',
  'shoe', 'sandal', 'apron',
  'poster', 'canvas', 'card', 'postcard', 'sticker', 'magnet',
  'mug', 'tumbler', 'bottle', 'blanket', 'towel', 'pillow', 'cushion',
  'tote', 'bag', 'backpack', 'pouch', 'case', 'flag', 'banner', 'puzzle',
  'journal', 'notebook', 'coaster', 'mousepad', 'ornament', 'keychain',
  'pin', 'patch', 'tag', 'tapestry',
]);

/**
 * Words that mark an upgrade rather than a different product.
 *
 * Catalog depth alone picks these, because an upsell line carries every size
 * and colour the plain one does. Measured: a star-map print matched the
 * *Framed* poster at $20.35 when the plain sheet is $5.39, and a name blanket
 * matched an *Embroidered Premium Sherpa* at $45.90 over a $24.14 throw.
 * Quoting a beginner the framed price makes the margin look four times worse
 * than the business they would actually start.
 *
 * Only penalised when the row did NOT ask for it — "niche-humor embroidered
 * sweatshirts" wants the embroidery, and should keep paying for it.
 */
const UPGRADE_WORDS = new Set([
  'framed', 'embroidered', 'premium', 'sherpa', 'deluxe', 'luxury',
  'heavyweight', 'organic', 'bamboo', 'velveteen', 'sequin', 'glitter',
]);

/**
 * The product nouns a keyword asks for. Empty means the row names a design
 * and never a thing — "monthly milestone outfit sets" says nothing about
 * which blank it is printed on, and guessing one is how you get a wrong price.
 */
export function nounsIn(keyword: string): string[] {
  return [...new Set(tokens(keyword).filter((t) => PRODUCT_NOUNS.has(t)))];
}

/**
 * What an entry is called. `type` is excluded here on purpose: it would let
 * "Paper Gift Bag" answer a query about postcards purely because Printful
 * files it under POSTCARD.
 */
const entryWords = (e: CatalogEntry): string[] => tokens(`${e.title} ${e.type_name ?? ''}`);

/**
 * Every word the catalog uses for something it will still sell you.
 *
 * Discontinued lines are excluded so the vocabulary means "words the supplier
 * can act on today". Counting a retired blank's wording would let a keyword
 * clear the filter on the strength of a product nobody can order.
 */
export function vocabularyOf(catalog: CatalogEntry[]): Set<string> {
  const v = new Set<string>();
  for (const e of catalog) {
    if (e.is_discontinued) continue;
    for (const t of tokens(`${e.title} ${e.type_name ?? ''} ${e.type}`)) v.add(t);
  }
  return v;
}

/**
 * How well a catalog entry answers a keyword, 0–1.
 *
 * Scored against title, type and type_name together, because the useful word
 * lives in a different field depending on the product: "Luggage Tag" is the
 * title, "T-SHIRT" is only the type, "Tag | Luggage" only the type_name.
 * Matching title alone missed roughly a third of the obvious cases.
 */
export function scoreMatch(keyword: string, entry: CatalogEntry, vocabulary?: Set<string>): number {
  let want = tokens(keyword);
  // Score only against words the supplier could possibly know. A row is named
  // for its DESIGN — "hometown varsity tees", "gym-slogan crop tops" — while
  // the catalog is named for the GARMENT. Counting "varsity" against a blank
  // that has no opinion on it caps every real match below the floor, which is
  // exactly how the first version matched nothing at all.
  if (vocabulary) {
    const known = want.filter((t) => vocabulary.has(t));
    // Nothing the supplier recognises means there is nothing here to price.
    if (!known.length) return 0;
    want = known;
  }
  if (!want.length) return 0;
  const have = new Set(tokens(`${entry.title} ${entry.type_name ?? ''} ${entry.type}`));
  if (!have.size) return 0;
  const hits = want.filter((t) => have.has(t)).length;
  return hits / want.length;
}

/**
 * The best entry for a keyword, or nothing.
 *
 * Two guards, and it is worth being precise about which does what, because
 * they are easy to confuse:
 *
 *   The vocabulary filter (in scoreMatch) is what stops a wrong price. If a
 *   keyword contains no word the supplier knows, there is nothing to match
 *   and it returns nothing rather than its least-bad guess.
 *
 *   Keeping the maker catalog out is NOT this function's job and it must not
 *   pretend otherwise — "hand-thrown latte mugs" does contain "mug", and
 *   Printful does sell a mug, so the text alone cannot tell you a potter
 *   would never use it. That call needs sourcingType, which only run.ts has,
 *   and which is why run.ts asks this adapter about POD rows and no others.
 */
/**
 * The floor is low because the product-noun gate above now does the work it
 * used to. At 0.5 it rejected "Retro travel posters" outright: "retro" and
 * "travel" are words Printful genuinely uses elsewhere, so a correct poster
 * match scored 1/3 and lost. Design words will always outnumber garment words
 * in a row title, so a recall threshold cannot be the safety mechanism.
 */
export function bestMatch(keyword: string, catalog: CatalogEntry[], floor = 0.2): CatalogEntry | undefined {
  const nouns = nounsIn(keyword);
  // No product noun, no price. The row names a design, not a thing.
  if (!nouns.length) return undefined;

  const vocabulary = vocabularyOf(catalog);
  let best: CatalogEntry | undefined;
  let bestRank: [number, number, number] = [0, 0, 0];

  for (const entry of catalog) {
    if (entry.is_discontinued) continue;
    const words = entryWords(entry);
    // The gate: the blank has to BE one of the things asked for. A tank top
    // is not a print, however many adjectives the two happen to share.
    if (!nouns.some((n) => words.includes(n))) continue;

    const score = scoreMatch(keyword, entry, vocabulary);
    if (score < floor) continue;

    // Rank: how much of the request was answered, then catalog depth.
    //
    // Depth is doing real work, not breaking a rare tie. Rows are named for
    // their design, so most of a keyword's words are ones no blank contains
    // and nearly every candidate in the right noun class scores identically —
    // "Unisex Staple T-Shirt | Bella + Canvas 3001" and "Unisex Knitted
    // T-shirt" both answer "varsity tees" at exactly 0.5. Variant count is
    // what separates them, and it is the honest proxy for the standard blank:
    // the staple line carries hundreds of size and colour combinations, the
    // oddity carries a handful.
    //
    // Scoring string precision instead was tried and is worse. It rewards a
    // short title, so it picked "Set of Business Cards" over a greeting card
    // and the knitted oddity over the Bella staple — the SKU in the good
    // entry's name counted against it.
    // Upgrades the row never asked for, subtracted before depth is consulted
    // — otherwise the upsell line wins on variant count every time.
    const asked = new Set(tokens(keyword));
    const upsell = words.filter((w) => UPGRADE_WORDS.has(w) && !asked.has(w)).length;

    const rank: [number, number, number] = [score, -upsell, entry.variant_count ?? 0];
    if (
      rank[0] > bestRank[0] ||
      (rank[0] === bestRank[0] && (rank[1] > bestRank[1] || (rank[1] === bestRank[1] && rank[2] > bestRank[2])))
    ) {
      best = entry;
      bestRank = rank;
    }
  }
  return best;
}

/**
 * The cheapest in-stock variant's price.
 *
 * Cheapest rather than mean because the base cost a seller plans around is
 * the one they can actually hit — a 3001 tee is $13.69 in 2XL and less in S,
 * and quoting the average would overstate what a starter batch costs. Sizes
 * out of stock are skipped: an unbuyable variant is not a price.
 */
export function cheapestPrice(variants: Variant[]): number | undefined {
  const prices = variants
    .filter((v) => !v.availability_status || v.availability_status !== 'discontinued')
    .map((v) => Number(v.price))
    .filter((n) => Number.isFinite(n) && n > 0);
  return prices.length ? Math.min(...prices) : undefined;
}

async function getJSON(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json: any = await res.json();
  if (json?.error) throw new Error(json.error.message ?? 'Printful error');
  return json.result;
}

function loadCatalog(): Promise<CatalogEntry[]> {
  // Assigned before awaiting so concurrent callers share the one request
  // rather than each starting their own.
  if (!catalogPromise) catalogPromise = getJSON('/products');
  return catalogPromise;
}

export const printful: Adapter = {
  name: 'printful',
  // No credential exists to be missing.
  configured: () => true,
  missing: () => '',

  async search(keyword: string): Promise<Signal[]> {
    const key = keyword.trim();
    if (!key) return [];
    const hit = cache.get(key);
    if (hit) return hit;

    const catalog = await loadCatalog();
    const match = bestMatch(key, catalog);
    if (!match) {
      // Expected for four fifths of the catalog — Printful has no opinion on
      // hand-thrown stoneware. Cached so the run stops asking, and silent
      // because it is not a fault.
      cache.set(key, []);
      return [];
    }

    const detail = await getJSON(`/products/${match.id}`);
    const price = cheapestPrice(detail?.variants ?? []);
    if (price === undefined) {
      cache.set(key, []);
      return [];
    }

    const signals: Signal[] = [
      {
        source: 'printful',
        // Stamped over by safeSearch. Named here anyway so reading one signal
        // in isolation still says what it is about: the blank, not the sale.
        scope: 'supply',
        productTitle: match.title,
        price,
        url: `https://www.printful.com/custom/${match.id}`,
        ...(match.image ? { imageUrl: match.image } : {}),
        // The catalog IS the live listing — this is a real product a real
        // supplier will fulfil today, which is exactly what these fields mean.
        liveSourcingUrl: `https://www.printful.com/custom/${match.id}`,
        liveMerchant: 'Printful',
      },
    ];
    cache.set(key, signals);
    return signals;
  },
};
