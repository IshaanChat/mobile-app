// What counts as a valid piece of curated content.
//
// There are now two ways content gets in — editing JSON and running an
// importer, or POSTing to /api/admin — and they must not disagree about what
// is acceptable. A row the importer would reject but the endpoint accepts is a
// row that breaks the next `content:sync`.
//
// These return a list of problems rather than throwing, because a caller
// sending fifty products wants all fifty verdicts, not the first failure.

export const AUDIENCES = new Set(['maker', 'reseller', 'both']);
// Must stay identical to the set in scripts/import-catalog.ts. Kept as a
// literal list rather than imported from there because scripts/ is not part of
// the built server — importing across that line would drag tsx-only code into
// the production bundle.
export const SOURCING = new Set(['DROPSHIP', 'WHOLESALE', 'PRINT_ON_DEMAND', 'MATERIALS', 'MAKE_YOUR_OWN']);
export const COMMUNITY_KINDS = new Set(['community', 'hashtag', 'marketplace', 'search', 'event']);
export const TIP_KINDS = new Set(['know', 'lift']);
export const TIP_TABS = new Set(['discover', 'grow', 'shop', 'you', 'any']);

/** The bubble clamps to two lines and clips silently past roughly this. */
export const TIP_MAX_CHARS = 90;

function requireStrings(raw: any, keys: readonly string[], where: string, problems: string[]) {
  for (const key of keys) {
    if (typeof raw?.[key] !== 'string' || !raw[key].trim()) {
      problems.push(`${where}: missing or empty "${key}"`);
    }
  }
}

function checkHotness(raw: any, where: string, problems: string[]) {
  if (raw?.hotness !== undefined && (typeof raw.hotness !== 'number' || raw.hotness < 0 || raw.hotness > 100)) {
    problems.push(`${where}: hotness must be a number 0-100`);
  }
}

export const PRODUCT_REQUIRED = ['slug', 'nicheSlug', 'title', 'blurb', 'sourcingType'] as const;

/**
 * `knownNicheSlugs` is required rather than optional on purpose. A product
 * pointing at a niche that does not exist is a hard error: the prototype
 * silently drops those (`.filter(p => p.niche)`), which hides typos — the
 * product vanishes from the feed and nothing says why.
 */
export function validateProduct(raw: any, where: string, knownNicheSlugs: Set<string>): string[] {
  const problems: string[] = [];
  requireStrings(raw, PRODUCT_REQUIRED, where, problems);
  if (raw?.sourcingType && !SOURCING.has(raw.sourcingType)) {
    problems.push(`${where}: sourcingType must be one of ${[...SOURCING].join(', ')}`);
  }
  checkHotness(raw, where, problems);
  if (raw?.nicheSlug && !knownNicheSlugs.has(raw.nicheSlug)) {
    problems.push(`${where}: nicheSlug "${raw.nicheSlug}" does not exist`);
  }
  return problems;
}

export const COMMUNITY_REQUIRED = [
  'slug',
  'title',
  'platform',
  'kind',
  'url',
  'tagline',
  'audience',
  'overview',
  'discussions',
  'loves',
  'dislikes',
  'rules',
  'approach',
  'tags',
] as const;

export function validateCommunity(raw: any, where: string): string[] {
  const problems: string[] = [];
  requireStrings(raw, COMMUNITY_REQUIRED, where, problems);
  if (raw?.kind && !COMMUNITY_KINDS.has(raw.kind)) {
    problems.push(`${where}: kind must be one of ${[...COMMUNITY_KINDS].join(', ')}`);
  }
  checkHotness(raw, where, problems);
  return problems;
}

/**
 * Tips use `id` as their slug in the content file, and `where` for the tab.
 * Both names are kept for compatibility with `content/tips.json`; the column
 * is `tab`, because WHERE is a SQL reserved word.
 */
export function validateTip(raw: any, where: string): string[] {
  const problems: string[] = [];
  requireStrings(raw, ['id', 'text'], where, problems);
  if (!TIP_KINDS.has(raw?.kind)) {
    problems.push(`${where}: kind must be one of ${[...TIP_KINDS].join(', ')}`);
  }
  if (raw?.where !== undefined && !TIP_TABS.has(raw.where)) {
    problems.push(`${where}: where must be one of ${[...TIP_TABS].join(', ')}`);
  }
  if (raw?.level !== undefined && (!Number.isInteger(raw.level) || raw.level < 1)) {
    problems.push(`${where}: level must be a whole number >= 1`);
  }
  return problems;
}

/** Not a rejection — the clamp depends on rendered width, so this is a smell. */
export function tipTooLong(raw: any): boolean {
  return typeof raw?.text === 'string' && raw.text.length > TIP_MAX_CHARS;
}

/** Duplicate slugs within one payload make upsert order decide the winner. */
export function findDuplicateSlugs(items: any[], key = 'slug'): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const item of items) {
    const slug = item?.[key];
    if (typeof slug !== 'string') continue;
    if (seen.has(slug)) dupes.add(slug);
    seen.add(slug);
  }
  return [...dupes];
}
