import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { assertOwnsBusiness } from '../core/auth';

export const channelsRouter = Router();

const VALID_TYPES = ['ETSY', 'INSTAGRAM', 'REDDIT', 'REFERRAL', 'OTHER'];

channelsRouter.get('/', ah(async (req, res) => {
  const businessId = await assertOwnsBusiness(req.userId, req.query.businessId);
  const channels = await prisma.channel.findMany({
    where: { businessId },
    include: { _count: { select: { contacts: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(channels);
}));

channelsRouter.post('/', ah(async (req, res) => {
  const { businessId: rawId, type, label } = req.body ?? {};
  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `a valid type (${VALID_TYPES.join(', ')}) is required` });
  }
  const businessId = await assertOwnsBusiness(req.userId, rawId);
  if (type === 'OTHER' && !label) {
    return res.status(400).json({ error: 'label is required for OTHER channels' });
  }

  const channel = await prisma.channel.create({
    data: { businessId, type, label: label || null },
  });
  res.status(201).json(channel);
}));

channelsRouter.delete('/:id', ah(async (req, res) => {
  const channel = await prisma.channel.findFirst({
    where: { id: req.params.id, business: { userId: req.userId } },
    select: { id: true },
  });
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  await prisma.channel.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));
