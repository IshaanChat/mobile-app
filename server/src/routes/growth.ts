// The Growth feed (paid tier): coached community posts — where a business's
// next customers already gather, written up blog-post deep.
//
// Same content model as trends: posts are global curator-owned rows
// (`npm run growth:import`); the API only reads. Unlike Discover, Growth is
// inherently business-centric — the feed requires a business to personalize
// against, so explorers see it after they've set up shop.

import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { emitEvent } from '../core/events';
import { assertOwnsBusiness, HttpError } from '../core/auth';
import { rankCards, tokenize } from '../trends/rank';

export const growthRouter = Router();

const FEED_LIMIT = 30;

// Business type tilts matching toward how that kind of business finds
// customers (mirrors the Discover community engine).
const TYPE_TOKENS: Record<string, string[]> = {
  PRODUCT_SALES: ['handmade', 'shop', 'etsy', 'maker'],
  SERVICE: ['consulting', 'services', 'business', 'entrepreneur'],
  KNOWLEDGE: ['coach', 'coaching', 'course', 'entrepreneur'],
};

function toCard(p: {
  id: string; title: string; platform: string; kind: string; url: string;
  tagline: string; audience: string; imageUrl: string | null;
  memberCount: number | null; hotness: number;
}) {
  return {
    id: p.id,
    title: p.title,
    platform: p.platform,
    kind: p.kind,
    url: p.url,
    tagline: p.tagline,
    audience: p.audience,
    imageUrl: p.imageUrl,
    memberCount: p.memberCount,
    hotness: p.hotness,
  };
}

growthRouter.get('/', ah(async (req, res) => {
  const businessId = await assertOwnsBusiness(req.userId, req.query.businessId);
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new HttpError(404, 'Business not found');

  const tokens = new Set([
    ...tokenize(business.niche),
    ...tokenize(business.description),
    ...tokenize(business.idealCustomer ?? ''),
    ...tokenize(business.audienceKeywords ?? ''),
    ...(TYPE_TOKENS[business.businessType ?? ''] ?? []),
  ]);

  const posts = await prisma.communityPost.findMany({ where: { status: 'ACTIVE' } });

  // The ranker's `category` drives diversity — for Growth that's the
  // platform, so the feed never collapses into a wall of one network.
  const ranked = rankCards(
    posts.map((p) => ({ ...p, category: p.platform })),
    tokens
  ).slice(0, FEED_LIMIT);

  emitEvent('growth.generated', { businessId, payload: { count: ranked.length } });
  res.json({
    generatedAt: new Date().toISOString(),
    posts: ranked.map(toCard),
  });
}));

growthRouter.get('/:id', ah(async (req, res) => {
  const post = await prisma.communityPost.findFirst({
    where: { id: req.params.id, status: 'ACTIVE' },
  });
  if (!post) throw new HttpError(404, 'Post not found');

  emitEvent('growth.post_viewed', { payload: { postId: post.id, slug: post.slug } });
  res.json({ ...toCard(post), body: post.body });
}));
