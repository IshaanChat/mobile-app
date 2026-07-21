#!/usr/bin/env node
/**
 * Validates DATABASE_URL before Prisma touches it, and prints a safe
 * fingerprint so a misconfigured value is obvious in the deploy log.
 *
 * Never prints the password. Runs first in the start command so failures
 * say what is actually wrong instead of surfacing as a Prisma schema error.
 */

// Locally the value lives in .env; on a host it is already in the
// environment. Missing file is fine.
try {
  process.loadEnvFile();
} catch {}

const raw = process.env.DATABASE_URL;

const fail = (msg, hint) => {
  console.error(`\n[env] DATABASE_URL problem: ${msg}`);
  if (hint) console.error(`[env] ${hint}`);
  console.error('');
  process.exit(1);
};

if (!raw) {
  fail('not set at all.', 'Add it in Render: Environment -> Add Environment Variable.');
}

// Report the shape without leaking the credential.
const firstChars = JSON.stringify(raw.slice(0, 14));
console.log(`[env] DATABASE_URL length=${raw.length} starts=${firstChars}`);

if (raw !== raw.trim()) {
  fail(
    'has leading or trailing whitespace (often a stray newline from a paste).',
    'Re-enter it as a single line with nothing before or after.'
  );
}

if (/^["']|["']$/.test(raw)) {
  fail(
    'is wrapped in quotes.',
    'In a .env file quotes are fine, but Render stores the value literally — enter it without them.'
  );
}

if (/^DATABASE_URL\s*=/i.test(raw)) {
  fail(
    'includes the "DATABASE_URL=" prefix in the value itself.',
    'Enter only the connection string in the value field.'
  );
}

if (!/^postgres(ql)?:\/\//.test(raw)) {
  fail(
    `does not start with postgresql:// — it begins with ${firstChars}.`,
    'Paste the FULL connection string: postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require'
  );
}

let url;
try {
  url = new URL(raw);
} catch {
  fail('is not a parseable URL.', 'Check for spaces or missing characters.');
}

if (!url.hostname) fail('has no hostname.');
if (!url.username) fail('has no username.', 'Expected postgresql://USER:PASSWORD@HOST/...');
if (!url.pathname || url.pathname === '/') {
  fail('has no database name.', 'Expected .../neondb at the end, before any ? parameters.');
}

// Safe to show: host and database identify the target without exposing auth.
console.log(`[env] host=${url.hostname} db=${url.pathname.slice(1)}`);

if (url.hostname.includes('-pooler')) {
  console.warn(
    '[env] WARNING: this is Neon\'s POOLED host. Prisma Migrate needs a direct\n' +
    '[env] connection — remove "-pooler" from the hostname. Migrations that apply\n' +
    '[env] schema changes will fail through the pooler.'
  );
}

console.log('[env] DATABASE_URL looks valid.\n');
