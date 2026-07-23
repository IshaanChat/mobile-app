#!/usr/bin/env node
/**
 * End-to-end smoke test: exercises every endpoint's happy path against a
 * running server, then deletes everything it created.
 *
 *   npm run dev      # in one terminal
 *   npm run smoke    # in another
 *
 * Creates a scratch business and removes it at the end (cascade takes the
 * channels, contacts, interactions, products and payments with it), so it is
 * safe to run against a database with real data in it.
 */

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4000/api';

let passed = 0;
let failed = 0;
const failures = [];

// `as` selects which dev-mode account makes the call, so isolation can be
// tested without an auth provider. Ignored when Clerk is configured.
async function api(method, path, body, as = 'smoke-a') {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-dev-user': as },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

async function check(label, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32mPASS\x1b[0m  ${label}`);
  } catch (err) {
    failed++;
    failures.push({ label, message: err.message });
    console.log(`  \x1b[31mFAIL\x1b[0m  ${label}\n        ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const run = async () => {
  console.log(`\nSmoke test against ${BASE}\n`);

  // --- health -------------------------------------------------------------
  await check('health responds ok', async () => {
    const { status, body } = await api('GET', '/health');
    assert(status === 200 && body.ok === true, `got ${status} ${JSON.stringify(body)}`);
  });

  // --- profile (singleton; read-only here so we don't clobber real data) ---
  await check('profile endpoint responds', async () => {
    const { status } = await api('GET', '/profile');
    assert(status === 200, `got ${status}`);
  });

  // --- business -----------------------------------------------------------
  let businessId;
  await check('create business', async () => {
    const { status, body } = await api('POST', '/business', {
      name: 'SMOKE TEST — safe to delete',
      niche: 'smoke testing',
      description: 'Created by npm run smoke. Deleted automatically.',
      businessType: 'PRODUCT_SALES',
      salesAvenues: 'ETSY',
      pageUrl: 'example.com/smoke',
    });
    assert(status === 201, `got ${status} ${JSON.stringify(body)}`);
    assert(body.pageUrl === 'https://example.com/smoke', `pageUrl not normalised: ${body.pageUrl}`);
    businessId = body.id;
  });

  if (!businessId) {
    console.log('\nCannot continue without a business. Aborting.\n');
    process.exit(1);
  }

  await check('list businesses includes it', async () => {
    const { body } = await api('GET', '/business');
    assert(body.some((b) => b.id === businessId), 'new business missing from list');
  });

  await check('update business targeting', async () => {
    const { status, body } = await api('PATCH', `/business/${businessId}`, {
      idealCustomer: 'people who like smoke tests',
      audienceKeywords: 'pottery, candles',
    });
    assert(status === 200 && body.idealCustomer, `got ${status}`);
  });

  // --- contacts + channel auto-detection ----------------------------------
  let contactId;
  await check('create contact from a pasted URL (auto-creates channel)', async () => {
    const { status, body } = await api('POST', '/contacts', {
      businessId,
      name: 'Smoke Contact',
      sourceUrl: 'etsy.com/shop/smoketest',
      status: 'PROSPECT',
      firstNote: 'Met during a smoke test',
    });
    assert(status === 201, `got ${status} ${JSON.stringify(body)}`);
    assert(body.channel?.type === 'ETSY', `channel not detected as ETSY: ${body.channel?.type}`);
    assert(body.interactions?.length === 1, 'firstNote did not create an interaction');
    assert(body.relationshipStrength > 0, 'first touch did not seed a score');
    contactId = body.id;
  });

  await check('channel now exists for the business', async () => {
    const { body } = await api('GET', `/channels?businessId=${businessId}`);
    assert(Array.isArray(body) && body.length >= 1, 'no channels found');
  });

  await check('fetch contact detail', async () => {
    const { status, body } = await api('GET', `/contacts/${contactId}`);
    assert(status === 200 && body.id === contactId, `got ${status}`);
  });

  await check('channel detection preview', async () => {
    const { body } = await api('GET', '/contacts/detect-channel/preview?url=instagram.com/someone');
    assert(body?.type === 'INSTAGRAM', `expected INSTAGRAM, got ${JSON.stringify(body)}`);
  });

  await check('log an interaction and raise the score', async () => {
    const before = (await api('GET', `/contacts/${contactId}`)).body.relationshipStrength;
    const { status, body } = await api('POST', `/contacts/${contactId}/interactions`, {
      type: 'PURCHASE',
      note: 'Smoke purchase',
      weight: 4,
    });
    assert(status === 201, `got ${status}`);
    assert(body.relationshipStrength > before, `score did not rise (${before} -> ${body.relationshipStrength})`);
  });

  await check('promote contact to customer', async () => {
    const { status, body } = await api('PATCH', `/contacts/${contactId}`, { status: 'CUSTOMER' });
    assert(status === 200 && body.status === 'CUSTOMER', `got ${status}`);
  });

  // --- products + stock ---------------------------------------------------
  let productId;
  await check('create product with tracked stock', async () => {
    const { status, body } = await api('POST', '/products', {
      businessId,
      name: 'Smoke Mug',
      price: 20,
      stock: 5,
      sku: 'SMOKE-1',
      url: 'example.com/listing',
    });
    assert(status === 201 && body.stock === 5, `got ${status} ${JSON.stringify(body)}`);
    productId = body.id;
  });

  await check('product summary reports inventory value', async () => {
    const { body } = await api('GET', `/products?businessId=${businessId}`);
    assert(body.summary.inventoryValue === 100, `expected 100, got ${body.summary.inventoryValue}`);
  });

  // --- payments (and the stock side effect) -------------------------------
  await check('record a sale that decrements stock', async () => {
    const { status } = await api('POST', '/payments', {
      businessId,
      amount: 40,
      quantity: 2,
      productId,
      contactId,
      note: 'Smoke sale',
    });
    assert(status === 201, `got ${status}`);
    const { body } = await api('GET', `/products?businessId=${businessId}`);
    const product = body.products.find((p) => p.id === productId);
    assert(product.stock === 3, `stock should be 3 after selling 2, got ${product.stock}`);
  });

  await check('payment summary reflects the sale', async () => {
    const { body } = await api('GET', `/payments?businessId=${businessId}`);
    assert(body.summary.total === 40, `expected total 40, got ${body.summary.total}`);
    assert(body.summary.topClient?.name === 'Smoke Contact', 'top client not attributed');
  });

  // --- socials ------------------------------------------------------------
  await check('save social links', async () => {
    const { status, body } = await api('PUT', '/socials', {
      businessId,
      links: [
        { platform: 'INSTAGRAM', url: 'instagram.com/smoketest' },
        { platform: 'TWITTER', url: 'x.com/smoketest' },
      ],
    });
    assert(status === 200 && body.length === 2, `got ${status} ${JSON.stringify(body)}`);
  });

  // --- derived reads ------------------------------------------------------
  await check('graph payload assembles', async () => {
    const { status, body } = await api('GET', `/graph?businessId=${businessId}`);
    assert(status === 200 && body.contacts.length === 1, `got ${status}`);
    assert(body.contacts[0].lastInteractionAt, 'lastInteractionAt not derived');
  });

  await check('activity feed returns interactions', async () => {
    const { body } = await api('GET', `/interactions?businessId=${businessId}`);
    assert(Array.isArray(body) && body.length >= 2, `expected >=2 interactions, got ${body.length}`);
  });

  await check('missions board computes and awards Wisdom', async () => {
    const { status, body } = await api('GET', `/missions?businessId=${businessId}`);
    assert(status === 200, `got ${status}`);
    assert(body.missions.length > 0, 'no missions returned');
    assert(body.summary.xp > 0, 'no Wisdom awarded despite completed milestones');
    assert(body.summary.level >= 1 && body.summary.level <= 100, `level out of range: ${body.summary.level}`);
    const firstSale = body.missions.find((m) => m.id === 'first_sale');
    assert(firstSale?.completed, 'first_sale should be complete after promoting a customer');
  });

  await check('discover returns recommendations', async () => {
    const { status, body } = await api('GET', `/discover?businessId=${businessId}`);
    assert(status === 200 && body.recommendations.length > 0, `got ${status}`);
    const platforms = new Set(body.recommendations.map((r) => r.platform));
    assert(platforms.size >= 3, `expected platform diversity, got ${[...platforms].join(', ')}`);
  });

  await check('discover status reports LLM configuration', async () => {
    const { status, body } = await api('GET', '/discover/status');
    assert(status === 200 && typeof body.llmConfigured === 'boolean', `got ${status}`);
  });

  await check('settings readable with API key masked', async () => {
    const { status, body } = await api('GET', '/settings');
    assert(status === 200, `got ${status}`);
    assert(!('llmApiKey' in body), 'settings must never return the raw API key');
    assert(typeof body.llmApiKeySet === 'boolean', 'llmApiKeySet missing');
  });

  await check('analytics recorded events for this business', async () => {
    const { body } = await api('GET', `/analytics?businessId=${businessId}`);
    assert(body.total > 0, 'no analytics events recorded');
    assert(body.byType['payment.recorded'] >= 1, 'payment event missing');
  });

  // --- error handling -----------------------------------------------------
  await check('unknown endpoint returns JSON 404', async () => {
    const { status, body } = await api('GET', '/definitely-not-a-real-endpoint');
    assert(status === 404 && body.error, `got ${status} ${JSON.stringify(body)}`);
  });

  await check('deleting a missing record returns 404, not 500', async () => {
    const { status } = await api('DELETE', '/contacts/does-not-exist');
    assert(status === 404, `got ${status}`);
  });

  await check('validation rejects a bad payload', async () => {
    const { status } = await api('POST', '/contacts', { businessId, name: '' });
    assert(status === 400, `expected 400, got ${status}`);
  });

  // --- trends (Discover feed) ----------------------------------------------
  // Cards are global curated content; only the caller's reactions are
  // per-user. If no content has been imported the reaction checks skip.
  let trendCardId = null;
  await check('trends feed responds for a business owner', async () => {
    const { status, body } = await api('GET', `/trends?businessId=${businessId}`);
    assert(status === 200 && Array.isArray(body.cards), `got ${status} ${JSON.stringify(body)}`);
    trendCardId = body.cards[0]?.id ?? null;
  });

  await check('trends feed responds for an explorer (interests only)', async () => {
    const { status, body } = await api('GET', '/trends?interests=jewelry,handmade');
    assert(status === 200 && Array.isArray(body.cards), `got ${status}`);
  });

  if (trendCardId) {
    await check('save a trend, then it shows on the saved shelf', async () => {
      const save = await api('POST', `/trends/${trendCardId}/save`);
      assert(save.status === 200 && save.body.saved === true, `save: got ${save.status}`);
      const { body } = await api('GET', '/trends/saved');
      assert(body.some((c) => c.id === trendCardId), 'saved card missing from shelf');
    });

    await check("another account's saved shelf does not contain it", async () => {
      const { body } = await api('GET', '/trends/saved', undefined, 'smoke-b');
      assert(!body.some((c) => c.id === trendCardId), 'saved trend leaked across accounts');
    });

    await check('unsave removes it from the shelf', async () => {
      const del = await api('DELETE', `/trends/${trendCardId}/save`);
      assert(del.status === 204, `got ${del.status}`);
      const { body } = await api('GET', '/trends/saved');
      assert(!body.some((c) => c.id === trendCardId), 'card still on shelf after unsave');
    });

    await check('dismissing an unknown card returns 404, not 500', async () => {
      const { status } = await api('POST', '/trends/does-not-exist/dismiss');
      assert(status === 404, `got ${status}`);
    });
  } else {
    console.log('  \x1b[33mSKIP\x1b[0m  trend reactions (no cards imported — run npm run trends:import)');
  }

  // --- growth (community posts) --------------------------------------------
  let growthPostId = null;
  await check('growth feed responds for a business owner', async () => {
    const { status, body } = await api('GET', `/growth?businessId=${businessId}`);
    assert(status === 200 && Array.isArray(body.posts), `got ${status} ${JSON.stringify(body)}`);
    growthPostId = body.posts[0]?.id ?? null;
    assert(!growthPostId || typeof body.posts[0].overview === 'string', 'feed post missing overview section');
  });

  await check('growth without a businessId is a 400, not a 500', async () => {
    const { status } = await api('GET', '/growth');
    assert(status === 400, `got ${status}`);
  });

  if (growthPostId) {
    await check('growth post detail includes all sections', async () => {
      const { status, body } = await api('GET', `/growth/${growthPostId}`);
      assert(status === 200, `got ${status}`);
      for (const field of ['overview', 'discussions', 'loves', 'dislikes', 'rules', 'approach']) {
        assert(typeof body[field] === 'string' && body[field].length > 0, `missing section: ${field}`);
      }
    });
  } else {
    console.log('  \x1b[33mSKIP\x1b[0m  growth detail (no posts imported — run npm run growth:import)');
  }

  await check('unknown growth post returns 404, not 500', async () => {
    const { status } = await api('GET', '/growth/does-not-exist');
    assert(status === 404, `got ${status}`);
  });

  // --- tenant isolation ---------------------------------------------------
  // Everything below runs as a DIFFERENT account (smoke-b) against the data
  // created by smoke-a. Every one must be refused.
  const asB = (m, p, b) => api(m, p, b, 'smoke-b');

  await check("another account cannot list the first account's businesses", async () => {
    const { body } = await asB('GET', '/business');
    assert(!body.some((b) => b.id === businessId), 'business leaked across accounts');
  });

  await check("another account cannot read the business's clients", async () => {
    const { status } = await asB('GET', `/contacts?businessId=${businessId}`);
    assert(status === 404, `expected 404, got ${status}`);
  });

  await check('another account cannot read a client by id', async () => {
    const { status } = await asB('GET', `/contacts/${contactId}`);
    assert(status === 404, `expected 404, got ${status}`);
  });

  await check('another account cannot edit a client', async () => {
    const { status } = await asB('PATCH', `/contacts/${contactId}`, { name: 'hijacked' });
    assert(status === 404, `expected 404, got ${status}`);
  });

  await check('another account cannot delete a client', async () => {
    const { status } = await asB('DELETE', `/contacts/${contactId}`);
    assert(status === 404, `expected 404, got ${status}`);
  });

  await check('another account cannot log an interaction on a client', async () => {
    const { status } = await asB('POST', `/contacts/${contactId}/interactions`, { type: 'MESSAGE' });
    assert(status === 404, `expected 404, got ${status}`);
  });

  await check('another account cannot read products or payments', async () => {
    const products = await asB('GET', `/products?businessId=${businessId}`);
    const payments = await asB('GET', `/payments?businessId=${businessId}`);
    assert(products.status === 404, `products: expected 404, got ${products.status}`);
    assert(payments.status === 404, `payments: expected 404, got ${payments.status}`);
  });

  await check('another account cannot delete a product', async () => {
    const { status } = await asB('DELETE', `/products/${productId}`);
    assert(status === 404, `expected 404, got ${status}`);
  });

  await check('another account cannot write a payment against the business', async () => {
    const { status } = await asB('POST', '/payments', { businessId, amount: 1 });
    assert(status === 404, `expected 404, got ${status}`);
  });

  await check('another account cannot edit the business', async () => {
    const { status } = await asB('PATCH', `/business/${businessId}`, { name: 'hijacked' });
    assert(status === 404, `expected 404, got ${status}`);
  });

  await check('another account cannot delete the business', async () => {
    const { status } = await asB('DELETE', `/business/${businessId}`);
    assert(status === 404, `expected 404, got ${status}`);
  });

  await check("another account cannot read the business's missions or discover", async () => {
    const missions = await asB('GET', `/missions?businessId=${businessId}`);
    const discover = await asB('GET', `/discover?businessId=${businessId}`);
    assert(missions.status === 404, `missions: expected 404, got ${missions.status}`);
    assert(discover.status === 404, `discover: expected 404, got ${discover.status}`);
  });

  await check("another account cannot personalize trends with the business's id", async () => {
    const { status } = await asB('GET', `/trends?businessId=${businessId}`);
    assert(status === 404, `expected 404, got ${status}`);
  });

  await check("another account cannot read the business's growth feed", async () => {
    const { status } = await asB('GET', `/growth?businessId=${businessId}`);
    assert(status === 404, `expected 404, got ${status}`);
  });

  await check("another account cannot see the first account's analytics", async () => {
    const { body } = await asB('GET', '/analytics');
    assert(body.total === 0 || !body.byType['payment.recorded'], 'analytics leaked across accounts');
  });

  await check('each account sees its own profile, not the other one', async () => {
    const a = await api('GET', '/profile');
    const b = await asB('GET', '/profile');
    if (a.body && b.body) assert(a.body.id !== b.body.id, 'profile shared across accounts');
  });

  await check('the owner can still do everything', async () => {
    const { status, body } = await api('GET', `/contacts/${contactId}`);
    assert(status === 200 && body.id === contactId, `owner locked out: ${status}`);
  });

  // --- cleanup ------------------------------------------------------------
  await check('delete scratch business (cascades)', async () => {
    const { status } = await api('DELETE', `/business/${businessId}`);
    assert(status === 204, `got ${status}`);
    const { body } = await api('GET', '/business');
    assert(!body.some((b) => b.id === businessId), 'business still present after delete');
  });

  await check('server still healthy after the whole run', async () => {
    const { body } = await api('GET', '/health');
    assert(body.ok === true, 'server unhealthy');
  });

  // --- report -------------------------------------------------------------
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f.label}: ${f.message}`);
    console.log('');
    process.exit(1);
  }
};

run().catch((err) => {
  console.error(`\nSmoke test could not run: ${err.message}`);
  console.error('Is the server running? Try: npm run dev\n');
  process.exit(1);
});
