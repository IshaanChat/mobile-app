import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { invalidateDiscoverCache } from './discover';
import { emitEvent } from '../core/events';
import { normalizeUrl } from '../channelDetect';

// pageUrl: empty string clears; anything else must normalize to a valid URL.
function parsePageUrl(raw: unknown): { value?: string | null; error?: string } {
  if (raw === undefined) return {};
  if (typeof raw !== 'string' || raw.trim() === '') return { value: null };
  const normalized = normalizeUrl(raw);
  if (!normalized) return { error: "pageUrl doesn't look like a valid link" };
  return { value: normalized };
}

export const businessRouter = Router();

// All businesses, oldest first (the client picks its active one).
businessRouter.get('/', ah(async (_req, res) => {
  const businesses = await prisma.business.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(businesses);
}));

businessRouter.post('/', ah(async (req, res) => {
  const { name, niche, description, salesAvenues, businessType, pageUrl } = req.body ?? {};
  if (!name || !niche || !description) {
    return res.status(400).json({ error: 'name, niche, and description are required' });
  }
  const page = parsePageUrl(pageUrl);
  if (page.error) return res.status(400).json({ error: page.error });
  const business = await prisma.business.create({
    data: {
      name, niche, description,
      salesAvenues: salesAvenues || null,
      businessType: businessType || null,
      pageUrl: page.value ?? null,
    },
  });
  emitEvent('business.created', { businessId: business.id, payload: { businessType: business.businessType } });
  res.status(201).json(business);
}));

businessRouter.patch('/:id', ah(async (req, res) => {
  const { name, niche, description, idealCustomer, audienceKeywords, salesAvenues, businessType, pageUrl } = req.body ?? {};
  const page = parsePageUrl(pageUrl);
  if (page.error) return res.status(400).json({ error: page.error });
  try {
    const business = await prisma.business.update({
      where: { id: req.params.id },
      data: {
        name, niche, description, idealCustomer, audienceKeywords, salesAvenues, businessType,
        ...(page.value !== undefined ? { pageUrl: page.value } : {}),
      },
    });
    // Targeting changes should immediately produce fresh recommendations.
    invalidateDiscoverCache(business.id);
    emitEvent('business.updated', { businessId: business.id });
    res.json(business);
  } catch {
    res.status(404).json({ error: 'Business not found' });
  }
}));

// Deletes the business and everything under it (channels/contacts/interactions cascade).
businessRouter.delete('/:id', ah(async (req, res) => {
  try {
    await prisma.business.delete({ where: { id: req.params.id } });
  } catch {
    return res.status(404).json({ error: 'Business not found' });
  }
  invalidateDiscoverCache(req.params.id);
  emitEvent('business.deleted', { businessId: req.params.id });
  res.status(204).end();
}));
