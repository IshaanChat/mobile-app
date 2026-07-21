import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';

export const channelsRouter = Router();

const VALID_TYPES = ['ETSY', 'INSTAGRAM', 'REDDIT', 'REFERRAL', 'OTHER'];

channelsRouter.get('/', ah(async (req, res) => {
  const { businessId } = req.query;
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'businessId query param is required' });
  }
  const channels = await prisma.channel.findMany({
    where: { businessId },
    include: { _count: { select: { contacts: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(channels);
}));

channelsRouter.post('/', ah(async (req, res) => {
  const { businessId, type, label } = req.body ?? {};
  if (!businessId || !type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `businessId and a valid type (${VALID_TYPES.join(', ')}) are required` });
  }
  if (type === 'OTHER' && !label) {
    return res.status(400).json({ error: 'label is required for OTHER channels' });
  }

  const channel = await prisma.channel.create({
    data: { businessId, type, label: label || null },
  });
  res.status(201).json(channel);
}));

channelsRouter.delete('/:id', ah(async (req, res) => {
  await prisma.channel.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));
