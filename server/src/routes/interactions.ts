import { Router } from 'express';
import { prisma } from '../prisma';

export const interactionsRouter = Router();

// Cross-contact activity feed for a business, most recent first.
interactionsRouter.get('/', async (req, res) => {
  const { businessId, limit } = req.query;
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'businessId query param is required' });
  }
  const take = limit && typeof limit === 'string' ? Math.min(Number(limit) || 50, 200) : 50;

  const interactions = await prisma.interaction.findMany({
    where: { contact: { businessId } },
    orderBy: { occurredAt: 'desc' },
    take,
    include: {
      contact: {
        select: { id: true, name: true, status: true, channel: { select: { type: true, label: true } } },
      },
    },
  });

  res.json(interactions);
});
