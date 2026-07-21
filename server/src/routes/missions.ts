import { Router } from 'express';
import { prisma } from '../prisma';
import { MISSIONS, levelForXp, periodKeyFor, periodStartFor, CADENCE_INFO } from '../missions/definitions';
import { emitEvent } from '../core/events';

export const missionsRouter = Router();

const GLOBAL_SCOPE = 'global';

// Compute progress for every mission (per current period for repeatables),
// auto-award newly completed ones, and return the board + Wisdom summary.
missionsRouter.get('/', async (req, res) => {
  const { businessId } = req.query;
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'businessId query param is required' });
  }

  const now = new Date();
  const missions = [];
  const justCompleted: string[] = [];

  for (const def of MISSIONS) {
    const scopeId = def.scope === 'global' ? GLOBAL_SCOPE : businessId;
    const periodKey = periodKeyFor(def.cadence, now);
    const since = periodStartFor(def.cadence, now);
    const current = Math.min(await def.progress(businessId, since), def.target);

    let completion = await prisma.missionCompletion.findUnique({
      where: { missionId_businessId_periodKey: { missionId: def.id, businessId: scopeId, periodKey } },
    });

    if (!completion && current >= def.target) {
      try {
        completion = await prisma.missionCompletion.create({
          data: { missionId: def.id, businessId: scopeId, periodKey, xpAwarded: def.xp },
        });
        justCompleted.push(def.id);
        emitEvent('mission.completed', {
          businessId,
          payload: { missionId: def.id, cadence: def.cadence, xp: def.xp, periodKey },
        });
      } catch {
        // Unique-constraint race with a parallel request: fetch the winner.
        completion = await prisma.missionCompletion.findUnique({
          where: { missionId_businessId_periodKey: { missionId: def.id, businessId: scopeId, periodKey } },
        });
      }
    }

    missions.push({
      id: def.id,
      category: def.category,
      cadence: def.cadence,
      title: def.title,
      description: def.description,
      xp: def.xp,
      target: def.target,
      current,
      completed: Boolean(completion),
      completedAt: completion?.completedAt ?? null,
      justCompleted: justCompleted.includes(def.id),
    });
  }

  // Wisdom: every completion ever earned (global + this business), including
  // past periods of repeatable missions.
  const completions = await prisma.missionCompletion.findMany({
    where: { businessId: { in: [GLOBAL_SCOPE, businessId] } },
  });
  const xp = completions.reduce((sum, c) => sum + c.xpAwarded, 0);
  const lvl = levelForXp(xp);

  res.json({
    missions,
    summary: {
      xp,
      level: lvl.level,
      levelName: lvl.name,
      currentLevelXp: lvl.currentThreshold,
      nextLevelXp: lvl.nextThreshold,
    },
    cadenceInfo: CADENCE_INFO,
    justCompleted,
  });
});
