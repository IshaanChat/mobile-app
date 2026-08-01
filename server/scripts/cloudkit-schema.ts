/**
 * Writes the public database schema as a `.ckdb` file for the CloudKit Console.
 *
 *   npm run cloudkit:schema
 *
 * Then, in the Console: pick the container, Schema, Import Schema, choose the
 * file. Development only — Production gets it by promoting the development
 * schema, never by importing, so the two cannot drift.
 *
 * This has to happen before the first push. CloudKit Web Services returns
 * `NOT_FOUND could not find record_type` for any type it has not been told
 * about, and unlike the native SDK it will not create one for you.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { SCHEMA, toCKDB } from './lib/cloudkit-schema';

const out = join(process.cwd(), 'cloudkit-schema.ckdb');
writeFileSync(out, toCKDB(), 'utf8');

const types = Object.entries(SCHEMA);
const fields = types.reduce((n, [, f]) => n + Object.keys(f).length, 0);

console.log(`Wrote ${out}`);
console.log(`  ${types.length} record types, ${fields} fields\n`);
for (const [type, spec] of types) {
  console.log(`  ${type.padEnd(18)} ${Object.keys(spec).length} fields`);
}
console.log('\nCloudKit Console -> your container -> Schema -> Import Schema');
console.log('Then: npm run cloudkit:push');
