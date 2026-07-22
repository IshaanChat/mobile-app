// The Discover feed: curated trend cards, ranked per user.
//
// Cards are global read-only content (loaded via `npm run trends:import`);
// the only writes here are the caller's own reactions. Personalization
// input is either a businessId (owners — ranked by the business's niche and
// keywords) or an `interests` list (explorers who have no business yet).

import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { emitEvent } from '../core/events';
import { assertOwnsBusiness, HttpError } from '../core/auth';
import { rankCards, tokenize } from '../trends/rank';

export const trendsRouter = Router();

const FEED_LIMIT = 50;

// Same tilt table as the community engine: business type nudges matching
// toward the kinds of products that type tends to sell.
const TYPE_TOKENS: Record<string, string[]> = {
  PRODUCT_SALES: ['handmade', 'product', 'shop'],
  SERVICE: ['services', 'local', 'booking'],
  KNOWLEDGE: ['digital', 'course', 'template'],
};

trendsRouter.get('/', ah(async (req, res) => {
  const { businessId, interests } = req.query;

  const tokens = new Set<string>();
  if (typeof businessId === 'string' && businessId) {
    await assertOwnsBusiness(req.userId, businessId);
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (business) {
      for (const t of [
        ...tokenize(business.niche),
        ...tokenize(business.description),
        ...tokenize(business.audienceKeywords ?? ''),
        ...(TYPE_TOKENS[business.businessType ?? ''] ?? []),
      ]) tokens.add(t);
    }
  } else if (typeof interests === 'string') {
    for (const t of tokenize(interests)) tokens.add(t);
  }

  const [cards, reactions] = await Promise.all([
    prisma.trendCard.findMany({ where: { status: 'ACTIVE' } }),
    prisma.savedTrend.findMany({ where: { userId: req.userId } }),
  ]);

  const dismissed = new Set(reactions.filter((r) => r.state === 'DISMISSED').map((r) => r.trendCardId));
  const saved = new Set(reactions.filter((r) => r.state === 'SAVED').map((r) => r.trendCardId));

  const ranked = rankCards(cards.filter((c) => !dismissed.has(c.id)), tokens)
    .slice(0, FEED_LIMIT);

  res.json({
    generatedAt: new Date().toISOString(),
    cards: ranked.map((c) => ({
      id: c.id,
      title: c.title,
      blurb: c.blurb,
      category: c.category,
      imageUrl: c.imageUrl,
      sourceName: c.sourceName,
      sourceUrl: c.sourceUrl,
      priceRange: c.priceRange,
      hotness: c.hotness,
      saved: saved.has(c.id),
    })),
  });
}));

// The user's idea shelf. Includes archived cards on purpose: a shelf entry
// disappearing because the curator rotated stock would feel like data loss.
trendsRouter.get('/saved', ah(async (req, res) => {
  const rows = await prisma.savedTrend.findMany({
    where: { userId: req.userId, state: 'SAVED' },
    orderBy: { createdAt: 'desc' },
    include: { trendCard: true },
  });
  res.json(rows.map((r) => ({
    id: r.trendCard.id,
    title: r.trendCard.title,
    blurb: r.trendCard.blurb,
    category: r.trendCard.category,
    imageUrl: r.trendCard.imageUrl,
    sourceName: r.trendCard.sourceName,
    sourceUrl: r.trendCard.sourceUrl,
    priceRange: r.trendCard.priceRange,
    hotness: r.trendCard.hotness,
    saved: true,
    savedAt: r.createdAt,
  })));
}));

async function requireActiveCard(id: string) {
  const cardId = typeof id === 'string' && id ? id : null;
  if (!cardId) throw new HttpError(400, 'card id is required');
  const found = await prisma.trendCard.findFirst({ where: { id: cardId, status: 'ACTIVE' }, select: { id: true, slug: true } });
  if (!found) throw new HttpError(404, 'Trend not found');
  return found;
}

trendsRouter.post('/:id/save', ah(async (req, res) => {
  const card = await requireActiveCard(req.params.id);
  await prisma.savedTrend.upsert({
    where: { userId_trendCardId: { userId: req.userId, trendCardId: card.id } },
    create: { userId: req.userId, trendCardId: card.id, state: 'SAVED' },
    update: { state: 'SAVED' },
  });
  emitEvent('trend.saved', { payload: { trendCardId: card.id, slug: card.slug } });
  res.json({ saved: true });
}));

trendsRouter.delete('/:id/save', ah(async (req, res) => {
  await prisma.savedTrend.deleteMany({
    where: { userId: req.userId, trendCardId: req.params.id, state: 'SAVED' },
  });
  emitEvent('trend.unsaved', { payload: { trendCardId: req.params.id } });
  res.status(204).end();
}));

trendsRouter.post('/:id/dismiss', ah(async (req, res) => {
  const card = await requireActiveCard(req.params.id);
  await prisma.savedTrend.upsert({
    where: { userId_trendCardId: { userId: req.userId, trendCardId: card.id } },
    create: { userId: req.userId, trendCardId: card.id, state: 'DISMISSED' },
    update: { state: 'DISMISSED' },
  });
  emitEvent('trend.dismissed', { payload: { trendCardId: card.id, slug: card.slug } });
  res.json({ dismissed: true });
}));
