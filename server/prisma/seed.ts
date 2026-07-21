/**
 * Demo data for screenshots, the demo video, and manual testing.
 *
 *   npm run seed          # add demo data
 *   npm run seed -- --reset   # wipe everything first, then add it
 *
 * Recreates the Wildflower Ceramics scenario: a handmade ceramics shop a
 * few months in, with a realistic spread of relationship ages so the
 * "who needs you" and warmth features have something to show. Dates are
 * relative to today, so the demo never looks stale.
 */

import { PrismaClient } from '@prisma/client';
import { computeScores } from '../src/scoring';

const prisma = new PrismaClient();

const daysAgo = (n: number, hour = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const DEMO_EXTERNAL_ID = 'dev:dev';

async function reset() {
  // Order matters only where onDelete isn't cascading.
  await prisma.appEvent.deleteMany();
  await prisma.missionCompletion.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.interaction.deleteMany();
  await prisma.product.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.socialLink.deleteMany();
  await prisma.business.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.user.deleteMany();
  console.log('  wiped existing data');
}

async function main() {
  const shouldReset = process.argv.includes('--reset');
  console.log('\nSeeding demo data…');
  if (shouldReset) await reset();

  // --- the account --------------------------------------------------------
  // Matches the default identity used by dev-mode auth, so the seeded data
  // belongs to whoever opens the app locally.
  const user = await prisma.user.upsert({
    where: { externalId: DEMO_EXTERNAL_ID },
    update: {},
    create: { externalId: DEMO_EXTERNAL_ID, email: 'maya@wildflowerceramics.example' },
  });

  // --- the person ---------------------------------------------------------
  const existingProfile = await prisma.userProfile.findUnique({ where: { userId: user.id } });
  if (!existingProfile) {
    await prisma.userProfile.create({
      data: {
        userId: user.id,
        name: 'Maya Okonkwo',
        email: 'maya@wildflowerceramics.example',
        age: 31,
        gender: 'WOMAN',
        location: 'Portland, OR',
        bio: 'Potter making small-batch stoneware for people who love their morning coffee.',
        experienceLevel: 'FIRST_TIME',
        goals: 'Replace my part-time job with the shop within two years.',
      },
    });
    console.log('  profile: Maya Okonkwo');
  } else {
    console.log('  profile: kept existing');
  }

  // --- the business -------------------------------------------------------
  const business = await prisma.business.create({
    data: {
      userId: user.id,
      name: 'Wildflower Ceramics',
      niche: 'Handmade stoneware mugs & bowls',
      description:
        'Small-batch stoneware for coffee lovers. Every piece thrown and glazed by hand in a home studio in Portland.',
      businessType: 'PRODUCT_SALES',
      salesAvenues: 'ETSY,INSTAGRAM_SHOP,IN_PERSON',
      idealCustomer:
        'Coffee and tea lovers who care about handmade things and will pay more for something with a story.',
      audienceKeywords: 'pottery, ceramics, coffee, handmade gifts',
      pageUrl: 'https://www.etsy.com/shop/wildflowerceramics',
    },
  });
  console.log(`  business: ${business.name}`);

  await prisma.socialLink.createMany({
    data: [
      { businessId: business.id, platform: 'INSTAGRAM', url: 'https://instagram.com/wildflowerceramics' },
      { businessId: business.id, platform: 'TIKTOK', url: 'https://tiktok.com/@wildflowerceramics' },
    ],
  });

  // --- channels -----------------------------------------------------------
  const [etsy, instagram, market] = await Promise.all([
    prisma.channel.create({ data: { businessId: business.id, type: 'ETSY', label: 'Etsy', url: 'https://www.etsy.com/shop/wildflowerceramics' } }),
    prisma.channel.create({ data: { businessId: business.id, type: 'INSTAGRAM', label: 'Instagram' } }),
    prisma.channel.create({ data: { businessId: business.id, type: 'OTHER', label: 'Craft fair' } }),
  ]);

  // --- products -----------------------------------------------------------
  const [mug, bowl, set, workshop] = await Promise.all([
    prisma.product.create({ data: { businessId: business.id, name: 'Speckled stoneware mug', description: '12oz, dishwasher safe', price: 34, stock: 12, sku: 'MUG-01', url: 'https://www.etsy.com/listing/000001' } }),
    prisma.product.create({ data: { businessId: business.id, name: 'Wide breakfast bowl', description: 'Matte oatmeal glaze', price: 42, stock: 2, sku: 'BWL-01' } }),
    prisma.product.create({ data: { businessId: business.id, name: 'Mug set of 4', description: 'Mixed glazes, gift boxed', price: 120, stock: 5, sku: 'SET-04' } }),
    prisma.product.create({ data: { businessId: business.id, name: 'Beginner wheel workshop', description: 'Two hours, studio, max 6 people', price: 85, stock: null } }),
  ]);
  console.log('  products: 4 (one low on stock, one untracked)');

  // --- people, with deliberately varied relationship ages -----------------
  const people: {
    name: string; channelId: string; status: string; sourceUrl?: string; notes?: string;
    touches: { type: string; note: string; weight: number; day: number }[];
  }[] = [
    {
      name: 'Priya Raman',
      channelId: etsy.id,
      status: 'CUSTOMER',
      sourceUrl: 'https://www.etsy.com/people/priyar',
      notes: 'Repeat buyer. Loves the speckled glaze. Mentioned a housewarming in the spring.',
      touches: [
        { type: 'MESSAGE', note: 'Asked whether the mugs are microwave safe', weight: 1, day: 74 },
        { type: 'PURCHASE', note: 'Bought two speckled mugs', weight: 4, day: 71 },
        { type: 'REVIEW', note: 'Left a 5-star review with photos', weight: 3, day: 64 },
        { type: 'PURCHASE', note: 'Came back for the set of 4 as a gift', weight: 5, day: 12 },
        { type: 'MESSAGE', note: 'Sent a thank-you note after it arrived', weight: 1, day: 9 },
      ],
    },
    {
      name: 'Daniel Weiss',
      channelId: instagram.id,
      status: 'CUSTOMER',
      sourceUrl: 'https://instagram.com/danielmakescoffee',
      notes: 'Coffee YouTuber, ~20k followers. Featured a mug in a video.',
      touches: [
        { type: 'MESSAGE', note: 'DM\'d asking about wholesale pricing', weight: 2, day: 45 },
        { type: 'MEETING', note: 'Video call about a small collaboration', weight: 3, day: 40 },
        { type: 'PURCHASE', note: 'Bought 3 mugs to feature', weight: 4, day: 35 },
        { type: 'MESSAGE', note: 'Shared the video — sent a spike of traffic', weight: 3, day: 21 },
      ],
    },
    {
      name: 'Sofia Marchetti',
      channelId: market.id,
      status: 'ENGAGED',
      notes: 'Met at the Alberta St market. Interested in a custom dinner set for her restaurant.',
      touches: [
        { type: 'MEETING', note: 'Long chat at the market stall about custom work', weight: 3, day: 26 },
        { type: 'MESSAGE', note: 'Emailed her a rough quote for 12 plates', weight: 2, day: 22 },
      ],
    },
    {
      name: 'Jordan Ellis',
      channelId: instagram.id,
      status: 'ENGAGED',
      sourceUrl: 'https://instagram.com/jordanhomegoods',
      notes: 'Runs a small home goods account. Asked about a collab.',
      touches: [
        { type: 'MESSAGE', note: 'Commented on the glaze process reel', weight: 1, day: 33 },
        { type: 'MESSAGE', note: 'Talked about a possible giveaway', weight: 2, day: 30 },
      ],
    },
    {
      name: 'Hannah Cole',
      channelId: etsy.id,
      status: 'PROSPECT',
      sourceUrl: 'https://www.etsy.com/people/hannahc',
      notes: 'Favourited the shop and asked about custom colours. Never followed up.',
      touches: [{ type: 'MESSAGE', note: 'Asked whether I do custom glaze colours', weight: 1, day: 19 }],
    },
    {
      name: 'Theo Nguyen',
      channelId: market.id,
      status: 'PROSPECT',
      notes: 'Took a card at the winter market. Wants a wedding gift set eventually.',
      touches: [{ type: 'MEETING', note: 'Chatted at the stall, took a card', weight: 1, day: 41 }],
    },
    {
      name: 'Grace Adeyemi',
      channelId: instagram.id,
      status: 'PROSPECT',
      sourceUrl: 'https://instagram.com/graceathome',
      notes: 'New follower who asked when the next restock is.',
      touches: [],
    },
  ];

  for (const person of people) {
    const contact = await prisma.contact.create({
      data: {
        businessId: business.id,
        channelId: person.channelId,
        name: person.name,
        status: person.status,
        sourceUrl: person.sourceUrl ?? null,
        notes: person.notes ?? null,
      },
    });

    for (const t of person.touches) {
      await prisma.interaction.create({
        data: { contactId: contact.id, type: t.type, note: t.note, weight: t.weight, occurredAt: daysAgo(t.day) },
      });
    }

    // Score exactly the way the API does, so the demo matches reality.
    const scores = computeScores(
      person.touches.map((t) => ({ occurredAt: daysAgo(t.day), weight: t.weight })),
      business.businessType
    );
    await prisma.contact.update({ where: { id: contact.id }, data: scores });
  }
  console.log(`  people: ${people.length} (customers, conversations, and a few going cold)`);

  // --- money --------------------------------------------------------------
  const priya = await prisma.contact.findFirst({ where: { businessId: business.id, name: 'Priya Raman' } });
  const daniel = await prisma.contact.findFirst({ where: { businessId: business.id, name: 'Daniel Weiss' } });

  await prisma.payment.createMany({
    data: [
      { businessId: business.id, contactId: priya!.id, productId: mug.id, amount: 68, quantity: 2, note: 'Two speckled mugs', occurredAt: daysAgo(71) },
      { businessId: business.id, contactId: daniel!.id, productId: mug.id, amount: 102, quantity: 3, note: 'Feature video', occurredAt: daysAgo(35) },
      { businessId: business.id, contactId: null, productId: bowl.id, amount: 84, quantity: 2, note: 'Craft fair — cash', occurredAt: daysAgo(26) },
      { businessId: business.id, contactId: priya!.id, productId: set.id, amount: 120, quantity: 1, note: 'Housewarming gift', occurredAt: daysAgo(12) },
      { businessId: business.id, contactId: null, productId: workshop.id, amount: 170, quantity: 2, note: 'Two workshop seats', occurredAt: daysAgo(5) },
    ],
  });
  console.log('  payments: 5 (~$544 total, some this month)');

  console.log('\nDone. Start the app and it will look like a real shop.\n');
}

main()
  .catch((err) => {
    console.error('\nSeed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
