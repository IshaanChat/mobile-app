// Mission definitions — the game layer that teaches users how to scale.
//
// Missions have a cadence:
//   once    — milestones; complete once, keep the Wisdom forever
//   daily   — reset every morning
//   weekly  — reset every Monday
//   monthly — reset on the 1st
//
// Each mission computes live progress from real data; when current >= target
// the engine records a completion for the current period and awards Wisdom
// exactly once per period.

import { prisma } from '../prisma';

export type MissionCategory = 'setup' | 'marketing' | 'outreach' | 'sales';
export type MissionCadence = 'once' | 'daily' | 'weekly' | 'monthly';

export interface MissionDef {
  id: string;
  category: MissionCategory;
  cadence: MissionCadence;
  title: string;
  description: string;
  xp: number; // Wisdom awarded
  target: number;
  // "global" missions (profile etc.) complete once for the whole app;
  // others complete per business.
  scope: 'global' | 'business';
  // `since` is the start of the current period for repeatable missions.
  progress: (businessId: string, since: Date | null) => Promise<number>;
}

export const CADENCE_INFO: Record<MissionCadence, { title: string; blurb: string }> = {
  daily: { title: 'Daily', blurb: 'Small actions that keep momentum. Reset every morning.' },
  weekly: { title: 'Weekly', blurb: 'Rhythm builders. Reset every Monday.' },
  monthly: { title: 'Monthly', blurb: 'Big swings. Reset on the 1st of each month.' },
  once: { title: 'Milestones', blurb: 'One-time achievements on your journey. Complete them once, keep the Wisdom forever.' },
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const MISSIONS: MissionDef[] = [
  // ---------- Daily ----------
  {
    id: 'daily_touch',
    category: 'outreach',
    cadence: 'daily',
    title: 'Daily check-in',
    description: 'Log one client interaction today — momentum compounds.',
    xp: 15,
    target: 1,
    scope: 'business',
    progress: (businessId, since) =>
      prisma.interaction.count({ where: { contact: { businessId }, occurredAt: { gte: since! } } }),
  },
  {
    id: 'daily_scout',
    category: 'marketing',
    cadence: 'daily',
    title: 'Scout the market',
    description: 'Add one new prospect to your client book today.',
    xp: 15,
    target: 1,
    scope: 'business',
    progress: (businessId, since) =>
      prisma.contact.count({ where: { businessId, createdAt: { gte: since! } } }),
  },

  // ---------- Weekly ----------
  {
    id: 'weekly_rhythm',
    category: 'outreach',
    cadence: 'weekly',
    title: 'Weekly rhythm',
    description: 'Log 5 interactions this week — consistent outreach is the whole game.',
    xp: 40,
    target: 5,
    scope: 'business',
    progress: (businessId, since) =>
      prisma.interaction.count({ where: { contact: { businessId }, occurredAt: { gte: since! } } }),
  },
  {
    id: 'weekly_pipeline',
    category: 'marketing',
    cadence: 'weekly',
    title: 'Build the pipeline',
    description: 'Bring 2 new prospects into your client book this week.',
    xp: 40,
    target: 2,
    scope: 'business',
    progress: (businessId, since) =>
      prisma.contact.count({ where: { businessId, createdAt: { gte: since! } } }),
  },

  // ---------- Monthly ----------
  {
    id: 'monthly_close',
    category: 'sales',
    cadence: 'monthly',
    title: 'Monthly close',
    description: 'Record at least one sale this month.',
    xp: 75,
    target: 1,
    scope: 'business',
    progress: (businessId, since) =>
      prisma.interaction.count({ where: { type: 'PURCHASE', contact: { businessId }, occurredAt: { gte: since! } } }),
  },
  {
    id: 'monthly_portfolio',
    category: 'outreach',
    cadence: 'monthly',
    title: 'Portfolio review',
    description: 'Touch base with 5 different clients this month — no one falls through the cracks.',
    xp: 75,
    target: 5,
    scope: 'business',
    progress: async (businessId, since) => {
      const rows = await prisma.interaction.findMany({
        where: { contact: { businessId }, occurredAt: { gte: since! } },
        select: { contactId: true },
        distinct: ['contactId'],
      });
      return rows.length;
    },
  },

  // ---------- Milestones (one-time) ----------
  {
    id: 'introduce_yourself',
    category: 'setup',
    cadence: 'once',
    title: 'Introduce yourself',
    description: 'Create your profile so the app knows who it’s coaching.',
    xp: 25,
    target: 1,
    scope: 'global',
    progress: async () => (await prisma.userProfile.count()) > 0 ? 1 : 0,
  },
  {
    id: 'tell_your_story',
    category: 'setup',
    cadence: 'once',
    title: 'Tell your story',
    description: 'Add a bio and location to your profile — people buy from people.',
    xp: 25,
    target: 2,
    scope: 'global',
    progress: async () => {
      const p = await prisma.userProfile.findFirst();
      return (p?.bio ? 1 : 0) + (p?.location ? 1 : 0);
    },
  },
  {
    id: 'define_ideal_customer',
    category: 'setup',
    cadence: 'once',
    title: 'Know who you’re looking for',
    description: 'Describe your ideal customer in the Discover tab — targeting beats guessing.',
    xp: 50,
    target: 1,
    scope: 'business',
    progress: async (businessId) => {
      const b = await prisma.business.findUnique({ where: { id: businessId } });
      return b?.idealCustomer || b?.audienceKeywords ? 1 : 0;
    },
  },
  {
    id: 'set_sales_avenues',
    category: 'setup',
    cadence: 'once',
    title: 'Open for business',
    description: 'Set your sales avenues in My Business — where can people actually buy from you?',
    xp: 25,
    target: 1,
    scope: 'business',
    progress: async (businessId) => {
      const b = await prisma.business.findUnique({ where: { id: businessId } });
      return b?.salesAvenues ? 1 : 0;
    },
  },
  {
    id: 'stock_the_shelf',
    category: 'setup',
    cadence: 'once',
    title: 'Stock the shelf',
    description: 'Add your first product or offering in the Products tab — give people something to buy.',
    xp: 25,
    target: 1,
    scope: 'business',
    progress: (businessId) => prisma.product.count({ where: { businessId } }),
  },
  {
    id: 'build_the_catalog',
    category: 'marketing',
    cadence: 'once',
    title: 'Build the catalog',
    description: 'List 3 products or offerings — a fuller shelf gives every visitor a reason to stay.',
    xp: 50,
    target: 3,
    scope: 'business',
    progress: (businessId) => prisma.product.count({ where: { businessId } }),
  },
  {
    id: 'open_first_channel',
    category: 'marketing',
    cadence: 'once',
    title: 'Open your first channel',
    description: 'Add a client with a link — the app maps where your people come from.',
    xp: 25,
    target: 1,
    scope: 'business',
    progress: (businessId) => prisma.channel.count({ where: { businessId } }),
  },
  {
    id: 'be_everywhere',
    category: 'marketing',
    cadence: 'once',
    title: 'Be everywhere',
    description: 'Have relationships flowing from 3 different channels — never depend on one platform.',
    xp: 75,
    target: 3,
    scope: 'business',
    progress: (businessId) => prisma.channel.count({ where: { businessId } }),
  },
  {
    id: 'plant_your_flags',
    category: 'marketing',
    cadence: 'once',
    title: 'Plant your flags',
    description: 'Connect 2 of your business socials in My Business — your profiles are your storefront windows.',
    xp: 50,
    target: 2,
    scope: 'business',
    progress: (businessId) => prisma.socialLink.count({ where: { businessId } }),
  },
  {
    id: 'first_person',
    category: 'outreach',
    cadence: 'once',
    title: 'Sign your first client',
    description: 'Add the first person you’ve talked to about your business.',
    xp: 25,
    target: 1,
    scope: 'business',
    progress: (businessId) => prisma.contact.count({ where: { businessId } }),
  },
  {
    id: 'grow_your_circle',
    category: 'outreach',
    cadence: 'once',
    title: 'Grow your book',
    description: 'Build a client book of 5 people. Every big business started with five conversations.',
    xp: 75,
    target: 5,
    scope: 'business',
    progress: (businessId) => prisma.contact.count({ where: { businessId } }),
  },
  {
    id: 'stay_in_touch',
    category: 'outreach',
    cadence: 'once',
    title: 'Stay in touch',
    description: 'Log 3 interactions — checking in is 80% of selling.',
    xp: 50,
    target: 3,
    scope: 'business',
    progress: (businessId) => prisma.interaction.count({ where: { contact: { businessId } } }),
  },
  {
    id: 'relationship_builder',
    category: 'outreach',
    cadence: 'once',
    title: 'Relationship builder',
    description: 'Log 10 interactions. Consistency is what clients remember.',
    xp: 100,
    target: 10,
    scope: 'business',
    progress: (businessId) => prisma.interaction.count({ where: { contact: { businessId } } }),
  },
  {
    id: 'rekindle',
    category: 'outreach',
    cadence: 'once',
    title: 'Rekindle a connection',
    description: 'Reach back out to someone after a week of silence — most sellers never do.',
    xp: 75,
    target: 1,
    scope: 'business',
    progress: async (businessId) => {
      const contacts = await prisma.contact.findMany({
        where: { businessId },
        include: { interactions: { orderBy: { occurredAt: 'asc' }, select: { occurredAt: true } } },
      });
      for (const c of contacts) {
        for (let i = 1; i < c.interactions.length; i++) {
          const gap = c.interactions[i].occurredAt.getTime() - c.interactions[i - 1].occurredAt.getTime();
          if (gap >= 7 * DAY_MS) return 1;
        }
      }
      return 0;
    },
  },
  {
    id: 'start_a_conversation',
    category: 'sales',
    cadence: 'once',
    title: 'Open negotiations',
    description: 'Move someone from “new lead” to “in conversation” — that’s where sales begin.',
    xp: 50,
    target: 1,
    scope: 'business',
    progress: (businessId) =>
      prisma.contact.count({ where: { businessId, status: { in: ['ENGAGED', 'CUSTOMER'] } } }),
  },
  {
    id: 'first_sale',
    category: 'sales',
    cadence: 'once',
    title: 'First sale 🎉',
    description: 'Turn a relationship into your first customer.',
    xp: 100,
    target: 1,
    scope: 'business',
    progress: (businessId) => prisma.contact.count({ where: { businessId, status: 'CUSTOMER' } }),
  },
  {
    id: 'ring_the_register',
    category: 'sales',
    cadence: 'once',
    title: 'Ring the register',
    description: 'Log a purchase interaction — celebrate every sale, however small.',
    xp: 50,
    target: 1,
    scope: 'business',
    progress: (businessId) =>
      prisma.interaction.count({ where: { type: 'PURCHASE', contact: { businessId } } }),
  },
  {
    id: 'repeat_business',
    category: 'sales',
    cadence: 'once',
    title: 'Repeat business',
    description: 'Grow to 3 customers. Retention is the cheat code nobody uses.',
    xp: 150,
    target: 3,
    scope: 'business',
    progress: (businessId) => prisma.contact.count({ where: { businessId, status: 'CUSTOMER' } }),
  },
];

// ---------- 100-level Wisdom curve ----------
// Ten named tiers, ten sub-levels each ("Hustler IV"). The cost of each
// level rises steadily; repeatable missions keep the climb alive.

// Mastery ladder: starts at the dream, climbs the craft-guild ranks, ends
// zen — grounded in the Dreyfus skill-acquisition stages and the guild
// apprentice→master tradition.
const TIERS = ['Dreamer', 'Novice', 'Apprentice', 'Artisan', 'Adept', 'Expert', 'Master', 'Sage', 'Luminary', 'Guru'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const MAX_LEVEL = 100;

// thresholds[i] = cumulative Wisdom required to BE level i+1.
const THRESHOLDS: number[] = (() => {
  const arr = [0];
  let cum = 0;
  for (let n = 1; n < MAX_LEVEL; n++) {
    cum += 50 + 25 * (n - 1);
    arr.push(cum);
  }
  return arr;
})();

export function levelForXp(xp: number): { level: number; name: string; currentThreshold: number; nextThreshold: number | null } {
  let idx = 0;
  for (let i = 0; i < THRESHOLDS.length; i++) {
    if (xp >= THRESHOLDS[i]) idx = i;
  }
  const tier = TIERS[Math.min(Math.floor(idx / 10), TIERS.length - 1)];
  const sub = ROMAN[idx % 10];
  return {
    level: idx + 1,
    name: `${tier} ${sub}`,
    currentThreshold: THRESHOLDS[idx],
    nextThreshold: idx + 1 < THRESHOLDS.length ? THRESHOLDS[idx + 1] : null,
  };
}

// ---------- Period keys ----------

function isoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

export function periodKeyFor(cadence: MissionCadence, now = new Date()): string {
  switch (cadence) {
    case 'once':
      return 'once';
    case 'daily':
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    case 'weekly': {
      const { year, week } = isoWeek(now);
      return `${year}-W${String(week).padStart(2, '0')}`;
    }
    case 'monthly':
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}

export function periodStartFor(cadence: MissionCadence, now = new Date()): Date | null {
  switch (cadence) {
    case 'once':
      return null;
    case 'daily':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'weekly': {
      const day = now.getDay() || 7; // Monday = 1
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day - 1));
      return start;
    }
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}
