import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { assertOwnsBusiness } from '../core/auth';

export const interactionsRouter = Router();

// Cross-contact activity feed for a business, most recent first.
interactionsRouter.get('/', ah(async (req, res) => {
  const { businessId: rawId, limit } = req.query;
  const businessId = await assertOwnsBusiness(req.userId, rawId);
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
}));
