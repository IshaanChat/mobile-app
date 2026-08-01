// Generates the server-to-server key pair CloudKit needs to accept writes to
// the public database, and prints the half you paste into the Console.
//
// Run once. The private key never leaves this machine and is gitignored with
// the rest of .env; losing it means generating a new pair and registering it
// again, which is annoying but not destructive.

import { generateKeyPairSync } from 'crypto';
import { existsSync, writeFileSync, chmodSync } from 'fs';
import { join } from 'path';

const OUT = join(process.cwd(), 'cloudkit-key.pem');

if (existsSync(OUT)) {
  console.error(
    `${OUT} already exists.\n` +
      'Delete it first if you really mean to replace the key — the old one stops\n' +
      'working the moment you register a new public half.'
  );
  process.exit(1);
}

// P-256 is what CloudKit accepts. Not a preference.
const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  privateKeyEncoding: { type: 'sec1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

writeFileSync(OUT, privateKey, { mode: 0o600 });
chmodSync(OUT, 0o600);

console.log(`Private key written to ${OUT} (chmod 600, gitignored).\n`);
console.log('Now, in the CloudKit Console:');
console.log('  1. Open your container, then Tokens & Keys -> Server-to-Server Keys');
console.log('  2. Add a key and paste this public half:\n');
console.log(publicKey);
console.log('  3. Copy the Key ID it gives back, then add to server/.env:\n');
console.log('     CLOUDKIT_CONTAINER=iCloud.com.ishaanchaturvedi.salesmechanic');
console.log('     CLOUDKIT_KEY_ID=<the key id>');
console.log(`     CLOUDKIT_PRIVATE_KEY_PATH=${OUT}`);
console.log('     CLOUDKIT_ENV=development\n');
console.log('Then: npm run cloudkit:push -- --dry-run');
