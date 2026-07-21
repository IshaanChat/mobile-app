import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { assertOwnsBusiness } from '../core/auth';

export const graphRouter = Router();

// Single payload the frontend needs to render the force graph:
// business (center) -> channels (middle ring) -> contacts (outer nodes).
graphRouter.get('/', ah(async (req, res) => {
  const businessId = await assertOwnsBusiness(req.userId, req.query.businessId);

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) return res.status(404).json({ error: 'Business not found' });

  const channels = await prisma.channel.findMany({ where: { businessId }, orderBy: { createdAt: 'asc' } });
  const rawContacts = await prisma.contact.findMany({
    where: { businessId },
    orderBy: { createdAt: 'asc' },
    include: {
      interactions: { orderBy: { occurredAt: 'desc' }, take: 1, select: { occurredAt: true } },
    },
  });

  const contacts = rawContacts.map(({ interactions, ...contact }) => ({
    ...contact,
    lastInteractionAt: interactions[0]?.occurredAt ?? null,
  }));

  res.json({ business, channels, contacts });
}));
