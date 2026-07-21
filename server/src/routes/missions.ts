import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { assertOwnsBusiness } from '../core/auth';
import { MISSIONS, levelForXp, periodKeyFor, periodStartFor, CADENCE_INFO } from '../missions/definitions';
import { emitEvent } from '../core/events';

export const missionsRouter = Router();

// Profile-level missions are not tied to a business, but must still be
// scoped per account or one user's completions would satisfy another's.
const globalScopeFor = (userId: string) => `global:${userId}`;

// Compute progress for every mission (per current period for repeatables),
// auto-award newly completed ones, and return the board + Wisdom summary.
missionsRouter.get('/', ah(async (req, res) => {
  const businessId = await assertOwnsBusiness(req.userId, req.query.businessId);

  const now = new Date();
  const missions = [];
  const justCompleted: string[] = [];

  for (const def of MISSIONS) {
    const scopeId = def.scope === 'global' ? globalScopeFor(req.userId) : businessId;
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
    where: { businessId: { in: [globalScopeFor(req.userId), businessId] } },
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
}));
