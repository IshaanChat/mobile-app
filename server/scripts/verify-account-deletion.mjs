#!/usr/bin/env node
/**
 * Proves account deletion actually deletes everything.
 *
 *   npm run dev                        # a dev-mode server (no CLERK_SECRET_KEY)
 *   node scripts/verify-account-deletion.mjs
 *
 * Builds a scratch account with a row in every table that holds user data,
 * deletes it, then asserts nothing survives. Two of those tables — AppEvent and
 * MissionCompletion — carry a bare `businessId` with no foreign key, so they
 * are outside every cascade and are exactly what this exists to catch.
 *
 * Safe against a database with real data: everything it touches belongs to a
 * throwaway user it created, and the final check is scoped to that user.
 */

import { PrismaClient } from '@prisma/client';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4000/api';
const WHO = `deltest-${Date.now()}`;

const prisma = new PrismaClient();
let failures = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  \x1b[32mPASS\x1b[0m  ${label}`);
  } else {
    failures++;
    console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-dev-user': WHO },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

async function run() {
  console.log(`Scratch account: dev:${WHO}\n`);

  // ---- build an account that touches every table -------------------------
  const profile = await api('POST', '/profile', {
    name: 'Deletion Test',
    email: 'deletion@example.com',
    age: 30,
    gender: 'PREFER_NOT_TO_SAY',
    experienceLevel: 'FIRST_TIME',
  });
  check('created a profile', profile.status === 201, `got ${profile.status}`);

  const business = await api('POST', '/business', {
    name: 'Scratch Co',
    niche: 'testing',
    description: 'exists to be deleted',
  });
  check('created a business', business.status === 201, `got ${business.status}`);
  const businessId = business.body?.id;
  if (!businessId) {
    console.log('\nCannot continue without a business.');
    process.exit(1);
  }

  const contact = await api('POST', '/contacts', {
    businessId,
    name: 'A Person',
    noLinkKind: 'IN_PERSON',
  });
  check('created a contact', contact.status === 201, `got ${contact.status}`);

  if (contact.body?.id) {
    const interaction = await api('POST', `/contacts/${contact.body.id}/interactions`, {
      type: 'MESSAGE',
    });
    check('logged an interaction', interaction.status === 201, `got ${interaction.status}`);
  }

  const payment = await api('POST', '/payments', { businessId, amount: 12.5 });
  check('recorded a payment', payment.status === 201, `got ${payment.status}`);

  await api('PUT', '/socials', {
    businessId,
    links: [{ platform: 'INSTAGRAM', url: 'https://instagram.com/scratch' }],
  });

  // Reading missions is what writes MissionCompletion rows — the endpoint
  // awards on read, which is why this is a GET and still mutates.
  await api('GET', `/missions?businessId=${businessId}`);

  // SavedTrend hangs off the user rather than the business, so it exercises a
  // different cascade path from everything above.
  const feed = await api('GET', `/trends?businessId=${businessId}&sort=niche`);
  const firstProduct = feed.body?.products?.[0]?.id;
  if (firstProduct) {
    const saved = await api('POST', `/trends/${firstProduct}/save`);
    check('saved a product', saved.status === 200, `got ${saved.status}`);
  } else {
    check('saved a product', false, 'the feed returned no products — is content imported?');
  }

  const user = await prisma.user.findUnique({
    where: { externalId: `dev:${WHO}` },
    select: { id: true },
  });
  check('the user row exists', Boolean(user));
  if (!user) process.exit(1);

  // ---- count what is there before ----------------------------------------
  const before = await counts(user.id, businessId);
  console.log('\n  before:', JSON.stringify(before));
  check('there is data in every table', Object.values(before).every((n) => n > 0),
    JSON.stringify(before));

  // ---- export before deleting --------------------------------------------
  const exported = await api('GET', '/account/export');
  check('export returns 200', exported.status === 200, `got ${exported.status}`);
  check('export includes the business', exported.body?.businesses?.length === 1);
  check('export includes contacts', (exported.body?.businesses?.[0]?.contacts?.length ?? 0) > 0);
  check('export includes mission progress', Array.isArray(exported.body?.missionProgress));
  check('export includes activity', Array.isArray(exported.body?.activity));

  // ---- delete -------------------------------------------------------------
  const deleted = await api('DELETE', '/account');
  check('delete returns 200', deleted.status === 200, `got ${deleted.status}`);
  check('delete reports success', deleted.body?.deleted === true);

  // ---- nothing may survive -------------------------------------------------
  const after = await counts(user.id, businessId);
  console.log('  after: ', JSON.stringify(after), '\n');

  for (const [table, n] of Object.entries(after)) {
    check(`${table} is empty after deletion`, n === 0, `${n} row(s) left behind`);
  }

  // A second delete must not 500.
  const again = await api('DELETE', '/account');
  check('deleting twice is handled', again.status === 404 || again.status === 200,
    `got ${again.status}`);

  console.log(
    failures === 0
      ? '\n\x1b[32mAccount deletion is complete — nothing survives.\x1b[0m'
      : `\n\x1b[31m${failures} check(s) failed.\x1b[0m`
  );
  process.exit(failures === 0 ? 0 : 1);
}

/** Everything that could hold this account's data, counted directly. */
async function counts(userId, businessId) {
  const [user, profile, businesses, contacts, payments, socials, events, missions, saved] =
    await Promise.all([
      prisma.user.count({ where: { id: userId } }),
      prisma.userProfile.count({ where: { userId } }),
      prisma.business.count({ where: { userId } }),
      prisma.contact.count({ where: { businessId } }),
      prisma.payment.count({ where: { businessId } }),
      prisma.socialLink.count({ where: { businessId } }),
      // The two outside every cascade.
      prisma.appEvent.count({ where: { businessId } }),
      prisma.missionCompletion.count({ where: { businessId } }),
      prisma.savedTrend.count({ where: { userId } }),
    ]);
  return { user, profile, businesses, contacts, payments, socials, events, missions, saved };
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
