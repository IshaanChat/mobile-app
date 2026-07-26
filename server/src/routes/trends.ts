// The Discover feed: the curated product catalog, ranked per user.
//
// Products are global read-only content (loaded via `npm run catalog:import`);
// the only writes here are the caller's own reactions. Personalization
// input is either a businessId (owners — ranked by the business's niche and
// keywords) or an `interests` list (explorers who have no business yet).
//
// Two layouts come out of one ranked list. `sort=niche` groups into domain
// sections the way the shelves of a shop do; `sort=trending` is a flat feed
// of what's climbing fastest. Sections index into the same `products` array
// rather than carrying their own copies, so a client can switch layout
// without refetching and the two can never disagree about a card.

import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { emitEvent } from '../core/events';
import { assertOwnsBusiness, HttpError } from '../core/auth';
import { rankCards, scoreCards, scoreCard, scoreTrending, tokenize } from '../trends/rank';
import { toDiscoverProduct } from '../trends/serialize';

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
  const { businessId, interests, sort, audience, nicheSlug } = req.query;
  const trending = sort === 'trending';

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

  const [rows, reactions] = await Promise.all([
    prisma.trendProduct.findMany({
      where: {
        status: 'ACTIVE',
        // Catalog rows only. Pre-rename cards have no niche and can't render
        // as Discover cards; they stay readable on the saved shelf.
        nicheId: { not: null },
        ...(typeof nicheSlug === 'string' && nicheSlug ? { niche: { slug: nicheSlug } } : {}),
        ...(typeof audience === 'string' && audience ? { niche: { audience } } : {}),
      },
      include: { niche: true },
    }),
    prisma.savedTrend.findMany({ where: { userId: req.userId } }),
  ]);

  const dismissed = new Set(reactions.filter((r) => r.state === 'DISMISSED').map((r) => r.trendCardId));
  const saved = new Set(reactions.filter((r) => r.state === 'SAVED').map((r) => r.trendCardId));
  const live = rows.filter((c) => !dismissed.has(c.id));

  const now = new Date();
  let ordered: typeof live;
  let sections: { key: string; title: string; productIds: string[] }[] = [];

  if (trending) {
    // Diversity pass on: one runaway domain shouldn't wallpaper a flat feed.
    ordered = rankCards(live, tokens, now, scoreTrending).slice(0, FEED_LIMIT);
  } else {
    // Grouped. The diversity penalty is deliberately skipped — every product
    // in a section shares a category, so it would fire on every pick and
    // cancel out. Section order comes from each domain's best product, so the
    // shelf that matches you is the one you land on.
    const scored = scoreCards(live, tokens, now, scoreCard)
      .sort((a, b) => b.score - a.score)
      .slice(0, FEED_LIMIT);
    ordered = scored.map((s) => s.card);

    const best = new Map<string, number>();
    const grouped = new Map<string, { key: string; title: string; productIds: string[] }>();
    for (const { card, score } of scored) {
      const domain = card.niche?.domain ?? card.category;
      const key = domain.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!grouped.has(key)) grouped.set(key, { key, title: domain, productIds: [] });
      grouped.get(key)!.productIds.push(card.id);
      best.set(key, Math.max(best.get(key) ?? -Infinity, score));
    }
    sections = [...grouped.values()].sort((a, b) => (best.get(b.key) ?? 0) - (best.get(a.key) ?? 0));
  }

  res.json({
    generatedAt: now.toISOString(),
    sort: trending ? 'trending' : 'niche',
    sections,
    products: ordered.map((c) => toDiscoverProduct(c, saved.has(c.id))),
  });
}));

// The user's idea shelf. Includes archived cards on purpose: a shelf entry
// disappearing because the curator rotated stock would feel like data loss.
trendsRouter.get('/saved', ah(async (req, res) => {
  const rows = await prisma.savedTrend.findMany({
    where: { userId: req.userId, state: 'SAVED' },
    orderBy: { createdAt: 'desc' },
    include: { trendCard: { include: { niche: true } } },
  });
  // Same serializer as the feed, so the shelf and the feed can't drift apart
  // the way the two hand-written copies here previously had.
  res.json(rows.map((r) => ({
    ...toDiscoverProduct(r.trendCard, true),
    savedAt: r.createdAt,
  })));
}));

async function requireActiveCard(id: string) {
  const cardId = typeof id === 'string' && id ? id : null;
  if (!cardId) throw new HttpError(400, 'card id is required');
  const found = await prisma.trendProduct.findFirst({ where: { id: cardId, status: 'ACTIVE' }, select: { id: true, slug: true } });
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
