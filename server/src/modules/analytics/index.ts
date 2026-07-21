// Analytics module — subscribes to the app event bus and persists every
// event locally. Nothing here leaves the user's machine; this exists so the
// product can learn what's used and the user can see their own history.

import { Router } from 'express';
import { ah } from '../../core/http';
import { prisma } from '../../prisma';
import { onEvent } from '../../core/events';

let registered = false;

export function registerAnalytics() {
  if (registered) return;
  registered = true;
  onEvent((event) => {
    prisma.appEvent
      .create({
        data: {
          type: event.type,
          businessId: event.businessId ?? null,
          payload: event.payload ? JSON.stringify(event.payload) : null,
        },
      })
      .catch((err) => console.warn(`[analytics] failed to record ${event.type}: ${err?.message ?? err}`));
  });
}

export const analyticsRouter = Router();

// Event counts by type + recent stream, for future insight surfaces.
analyticsRouter.get('/', ah(async (req, res) => {
  const { businessId } = req.query;
  const where = typeof businessId === 'string' && businessId ? { businessId } : {};

  const [total, recent, all] = await Promise.all([
    prisma.appEvent.count({ where }),
    prisma.appEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.appEvent.findMany({ where, select: { type: true } }),
  ]);

  const byType: Record<string, number> = {};
  for (const e of all) byType[e.type] = (byType[e.type] ?? 0) + 1;

  res.json({ total, byType, recent });
}));
