import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { llmRecommendations, getLlmConfig } from '../discover/llm';
import { builtinRecommendations } from '../discover/builtin';
import type { DiscoverResult } from '../discover/types';
import { emitEvent } from '../core/events';
import { assertOwnsBusiness } from '../core/auth';

export const discoverRouter = Router();

// Recommendations change rarely; cache per business so tab switches feel instant.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { result: DiscoverResult; expires: number }>();

export function invalidateDiscoverCache(businessId: string) {
  cache.delete(businessId);
}

discoverRouter.get('/', ah(async (req, res) => {
  const { businessId: rawId, refresh } = req.query;
  const businessId = await assertOwnsBusiness(req.userId, rawId);

  if (refresh !== '1') {
    const hit = cache.get(businessId);
    if (hit && hit.expires > Date.now()) return res.json(hit.result);
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) return res.status(404).json({ error: 'Business not found' });

  const socials = await prisma.socialLink.findMany({ where: { businessId } });
  const context = {
    name: business.name,
    niche: business.niche,
    description: business.description,
    idealCustomer: business.idealCustomer,
    audienceKeywords: business.audienceKeywords,
    businessType: business.businessType,
    socials: socials.map((s) => ({ platform: s.platform, url: s.url })),
  };

  const fromLlm = await llmRecommendations(req.userId, context);
  const result: DiscoverResult = fromLlm
    ? { source: 'llm', generatedAt: new Date().toISOString(), recommendations: fromLlm }
    : { source: 'builtin', generatedAt: new Date().toISOString(), recommendations: builtinRecommendations(context) };

  cache.set(businessId, { result, expires: Date.now() + CACHE_TTL_MS });
  emitEvent('discover.generated', {
    businessId,
    payload: { source: result.source, count: result.recommendations.length },
  });
  res.json(result);
}));

// Lets the client show whether the user's own model is wired up.
discoverRouter.get('/status', ah(async (req, res) => {
  const config = await getLlmConfig(req.userId);
  res.json({ llmConfigured: Boolean(config), model: config?.model ?? null });
}));
