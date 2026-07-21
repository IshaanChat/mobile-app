import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { normalizeUrl } from '../channelDetect';
import { emitEvent } from '../core/events';

export const socialsRouter = Router();

export const SOCIAL_PLATFORMS = ['TWITTER', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'REDDIT', 'FACEBOOK', 'PINTEREST'] as const;

socialsRouter.get('/', ah(async (req, res) => {
  const { businessId } = req.query;
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'businessId query param is required' });
  }
  const socials = await prisma.socialLink.findMany({ where: { businessId } });
  res.json(socials);
}));

// (socials.saved event emitted at the end of PUT below)
// Bulk save: an entry with a url upserts; an entry with empty url removes.
socialsRouter.put('/', ah(async (req, res) => {
  const { businessId, links } = req.body ?? {};
  if (!businessId || !Array.isArray(links)) {
    return res.status(400).json({ error: 'businessId and links[] are required' });
  }

  for (const link of links) {
    const platform = link?.platform;
    if (!SOCIAL_PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: `platform must be one of ${SOCIAL_PLATFORMS.join(', ')}` });
    }
    const raw = typeof link.url === 'string' ? link.url.trim() : '';
    if (!raw) {
      await prisma.socialLink.deleteMany({ where: { businessId, platform } });
      continue;
    }
    const url = normalizeUrl(raw);
    if (!url) return res.status(400).json({ error: `"${raw}" doesn't look like a valid link` });
    await prisma.socialLink.upsert({
      where: { businessId_platform: { businessId, platform } },
      update: { url },
      create: { businessId, platform, url },
    });
  }

  const socials = await prisma.socialLink.findMany({ where: { businessId } });
  emitEvent('socials.saved', { businessId, payload: { connected: socials.length } });
  res.json(socials);
}));
