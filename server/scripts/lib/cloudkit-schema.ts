// The public database's shape, in one place.
//
// This exists because CloudKit Web Services will not create record types.
// Saving a record of an unknown type from the native SDK creates it in the
// development environment; doing the same over a server-to-server key returns
// `NOT_FOUND could not find record_type`, for `create` as well as
// `forceReplace`. So the schema has to be defined before the first push.
//
// Keeping it here rather than in the Console means the schema is reviewable,
// diffable, and cannot drift from what `cloudkit-push.ts` actually sends —
// which is the failure the Console would otherwise invite.
//
// Index attributes are not optional decoration. A field with no QUERYABLE
// cannot appear in a predicate, and `___recordID QUERYABLE` is what makes
// "fetch every record of this type" legal at all — without it the app's first
// query fails at runtime, not at build time.

export type FieldType = 'STRING' | 'INT64' | 'DOUBLE' | 'LIST<STRING>';

export interface FieldSpec {
  type: FieldType;
  /** QUERYABLE to filter on it, SORTABLE to order by it, SEARCHABLE for text. */
  index?: Array<'QUERYABLE' | 'SORTABLE' | 'SEARCHABLE'>;
}

export type RecordSchema = Record<string, FieldSpec>;

const str = (index?: FieldSpec['index']): FieldSpec => ({ type: 'STRING', index });
const int = (index?: FieldSpec['index']): FieldSpec => ({ type: 'INT64', index });
const dbl = (): FieldSpec => ({ type: 'DOUBLE' });
const strList = (): FieldSpec => ({ type: 'LIST<STRING>' });

export const SCHEMA: Record<string, RecordSchema> = {
  Niche: {
    name: str(),
    domain: str(['QUERYABLE']),
    audience: str(['QUERYABLE']),
    imageUrl: str(),
    imageCredit: str(),
    tags: str(),
  },

  Product: {
    title: str(['SEARCHABLE']),
    blurb: str(),
    // The join back to Niche. Queryable because Discover groups by it.
    nicheSlug: str(['QUERYABLE']),
    sourcingType: str(['QUERYABLE']),
    sourceName: str(),
    // The AliExpress or Printful listing.
    sourcingUrl: str(),
    sourceCost: str(),
    sourceCategory: str(),
    typicalResale: str(),
    imageUrl: str(),
    imageCredit: str(),
    // Sortable: the feed orders by it, and Hot is a percentile of what loaded.
    hotness: int(['QUERYABLE', 'SORTABLE']),
    tier: str(['QUERYABLE']),

    signalHeat: int(),
    signalInterest: int(),
    signalInterestTrend: dbl(),
    signalUnitsSold: int(),
    signalPriceLow: dbl(),
    signalPriceHigh: dbl(),
    signalPolledAt: str(),
    signalSources: strList(),
  },

  Community: {
    title: str(['SEARCHABLE']),
    tagline: str(),
    platform: str(['QUERYABLE']),
    kind: str(['QUERYABLE']),
    url: str(),
    overview: str(),
    audience: str(),
    loves: str(),
    dislikes: str(),
    approach: str(),
    rules: str(),
    discussions: str(),
    hotness: int(['QUERYABLE', 'SORTABLE']),
    imageUrl: str(),
    imageCredit: str(),
    tags: str(),
  },

  Tip: {
    kind: str(['QUERYABLE']),
    text: str(),
    tab: str(['QUERYABLE']),
    level: int(['QUERYABLE', 'SORTABLE']),
  },

  JourneyLevel: {
    level: int(['QUERYABLE', 'SORTABLE']),
    name: str(),
    title: str(),
  },

  Milestone: {
    title: str(),
    detail: str(),
    level: int(['QUERYABLE', 'SORTABLE']),
    tab: str(['QUERYABLE']),
    trigger: str(['QUERYABLE']),
    // `where` is reserved in too many places to be worth the fight.
    place: str(),
    xp: int(),
  },

  Playbook: {
    name: str(),
    blurb: str(),
    steps: strList(),
  },

  OnboardingScript: {
    json: str(),
  },
};

/**
 * Emits a `.ckdb` schema file for CloudKit Console → Schema → Import Schema.
 *
 * The security block is the point of the exercise as much as the fields are:
 * `_world` reads, and nothing else writes. CloudKit's default lets any
 * authenticated user create records in a public database, which would let
 * anyone with a debugger add products to the feed. The server-to-server key
 * writes as the container owner and is unaffected by these grants.
 */
export function toCKDB(): string {
  const system = [
    ['"___createTime"', 'TIMESTAMP'],
    ['"___createdBy"', 'REFERENCE'],
    ['"___etag"', 'STRING'],
    ['"___modTime"', 'TIMESTAMP'],
    ['"___modifiedBy"', 'REFERENCE'],
    // Queryable so "every record of this type" is a legal query.
    ['"___recordID"', 'REFERENCE QUERYABLE'],
  ];

  const blocks = Object.entries(SCHEMA).map(([type, fields]) => {
    const lines = [
      ...system.map(([n, t]) => `        ${n.padEnd(24)} ${t}`),
      ...Object.entries(fields).map(([name, spec]) => {
        const attrs = [spec.type, ...(spec.index ?? [])].join(' ');
        return `        ${name.padEnd(24)} ${attrs}`;
      }),
      '        GRANT READ TO "_world"',
    ];
    return `    RECORD TYPE ${type} (\n${lines.join(',\n')}\n    );`;
  });

  return `DEFINE SCHEMA\n\n${blocks.join('\n\n')}\n`;
}
