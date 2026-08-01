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
 * The grants are CloudKit's defaults, arrived at the hard way. Granting only
 * READ TO "_world" — the tighter posture, and the one worth wanting — fails
 * the push with `ACCESS_DENIED CREATE operation not permitted`: a
 * server-to-server key is **not** exempt from these roles the way container
 * ownership would suggest. Something has to be granted CREATE, and `_icloud`
 * is the only role the key satisfies.
 *
 * What that costs: any authenticated user can, in principle, create records in
 * these public types. WRITE is limited to `_creator`, so nobody can alter the
 * curated rows — the exposure is additions, not edits, and the app reads a
 * fixed set of slugs. The durable fix is for the client to ignore records whose
 * creator is not the push key, which is worth doing before the catalogue is
 * worth polluting.
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
      '        GRANT WRITE TO "_creator"',
      '        GRANT CREATE TO "_icloud"',
      '        GRANT READ TO "_world"',
    ];
    return `    RECORD TYPE ${type} (\n${lines.join(',\n')}\n    );`;
  });

  return `DEFINE SCHEMA\n\n${blocks.join('\n\n')}\n`;
}
