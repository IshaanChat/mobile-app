// The journey: five named levels between an idea and a first sale.
//
//   GET  /api/journey                    the board
//   POST /api/journey/:slug/complete     mark one milestone done
//
// This replaces the older /api/missions model for new clients. That one serves
// 24 hardcoded missions grouped by cadence on a 100-level XP curve, which
// measures activity rather than progress — you could reach level 12 without
// ever having named a business. Levels here mean something: each unlocks the
// next, so where you are is where you actually are.
//
// /api/missions is left mounted so the older client keeps working.
//
// Progress is per USER, not per business. The journey is personal — an explorer
// has no business at all, and somebody running two ventures has not walked the
// path twice.

import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { HttpError } from '../core/auth';
import { emitEvent } from '../core/events';

export const journeyRouter = Router();

/**
 * Milestones the server can prove without being told.
 *
 * Fifteen of the thirty-four happen away from Venturo entirely — pricing
 * competitors, ordering a sample, taking photographs — and can only be
 * self-declared. But a handful leave evidence in the database, and asking
 * somebody to tick "name your business" when the business is right there is
 * the kind of small insult that makes an app feel like paperwork.
 *
 * Each returns true when the thing has demonstrably happened. They only ever
 * award; nothing here can un-complete a milestone.
 */
const PROVABLE: Record<string, (userId: string) => Promise<boolean>> = {
  'name-business': async (userId) =>
    (await prisma.business.count({ where: { userId } })) > 0,
  'start-business': async (userId) =>
    (await prisma.business.count({ where: { userId } })) > 0,
  'add-contact': async (userId) =>
    (await prisma.contact.count({ where: { business: { userId } } })) > 0,
  'log-interaction': async (userId) =>
    (await prisma.interaction.count({ where: { contact: { business: { userId } } } })) > 0,
  'add-shelf': async (userId) =>
    (await prisma.product.count({ where: { business: { userId } } })) > 0,
  'log-sale': async (userId) =>
    (await prisma.payment.count({ where: { business: { userId } } })) > 0,
  'five-sales': async (userId) =>
    (await prisma.payment.count({ where: { business: { userId } } })) >= 5,
  'add-social': async (userId) =>
    (await prisma.socialLink.count({ where: { business: { userId } } })) > 0,
  'bookmark-product': async (userId) =>
    (await prisma.savedTrend.count({ where: { userId, state: 'SAVED' } })) > 0,
};

/** Awards a milestone if it is not already held. Safe to call repeatedly. */
async function award(userId: string, slug: string, xp: number): Promise<boolean> {
  try {
    await prisma.milestoneCompletion.create({
      data: { userId, milestoneSlug: slug, xpAwarded: xp },
    });
    emitEvent('milestone.completed', { payload: { milestoneSlug: slug, xp } });
    return true;
  } catch {
    // Unique constraint: somebody else's request won the race, which is the
    // correct outcome and not an error.
    return false;
  }
}

journeyRouter.get(
  '/',
  ah(async (req, res) => {
    const [levels, playbooks, completions] = await Promise.all([
      prisma.journeyLevel.findMany({
        orderBy: { level: 'asc' },
        include: { milestones: { orderBy: { position: 'asc' } } },
      }),
      prisma.playbook.findMany({ orderBy: { position: 'asc' } }),
      prisma.milestoneCompletion.findMany({ where: { userId: req.userId } }),
    ]);

    if (!levels.length) {
      throw new HttpError(503, 'The journey has not been imported yet.');
    }

    const done = new Set(completions.map((c) => c.milestoneSlug));
    const justCompleted: string[] = [];

    // Award anything the database can already prove. Only for milestones that
    // exist and are not yet held, so this costs a handful of counts rather
    // than one per milestone.
    const provableSlugs = levels
      .flatMap((l) => l.milestones)
      .filter((m) => PROVABLE[m.slug] && !done.has(m.slug));

    for (const milestone of provableSlugs) {
      if (await PROVABLE[milestone.slug](req.userId)) {
        if (await award(req.userId, milestone.slug, milestone.xp)) {
          done.add(milestone.slug);
          justCompleted.push(milestone.slug);
        }
      }
    }

    // Levels unlock in order: level 1 always, and each subsequent one when the
    // previous is finished. Gating on the *previous* level rather than on an XP
    // total is what makes the level name honest — a Builder has actually set up
    // shop, rather than merely been busy.
    let previousComplete = true;
    const shaped = levels.map((level) => {
      const milestones = level.milestones.map((m) => ({
        slug: m.slug,
        title: m.title,
        detail: m.detail,
        where: m.where,
        trigger: m.trigger,
        tab: m.tab,
        xp: m.xp,
        completed: done.has(m.slug),
        /// True where the server proved it rather than the user declaring it.
        automatic: Boolean(PROVABLE[m.slug]),
      }));

      const completedCount = milestones.filter((m) => m.completed).length;
      const unlocked = previousComplete;
      const complete = completedCount === milestones.length;
      previousComplete = previousComplete && complete;

      return {
        level: level.level,
        name: level.name,
        title: level.title,
        unlocked,
        complete,
        completedCount,
        total: milestones.length,
        milestones,
      };
    });

    const all = shaped.flatMap((l) => l.milestones);
    const xp = completions.reduce((sum, c) => sum + c.xpAwarded, 0);
    // The current level is the first unfinished one — not the highest reached,
    // which would let a single skipped step read as further along than it is.
    const current = shaped.find((l) => !l.complete);

    res.json({
      levels: shaped,
      playbooks: playbooks.map((p) => ({
        slug: p.slug,
        name: p.name,
        blurb: p.blurb,
        steps: p.steps.split(',').filter(Boolean),
      })),
      summary: {
        xp,
        completed: all.filter((m) => m.completed).length,
        total: all.length,
        level: current?.level ?? shaped.length,
        levelName: current?.name ?? 'Owner',
        levelComplete: !current,
      },
      justCompleted,
    });
  })
);

journeyRouter.post(
  '/:slug/complete',
  ah(async (req, res) => {
    const milestone = await prisma.milestone.findUnique({
      where: { slug: req.params.slug },
      include: { journeyLevel: true },
    });
    if (!milestone) throw new HttpError(404, 'No such milestone');

    // A milestone in a locked level cannot be completed, or the sequence stops
    // meaning anything — someone could tick the final step on day one.
    const levels = await prisma.journeyLevel.findMany({
      where: { level: { lt: milestone.journeyLevel.level } },
      include: { milestones: { select: { slug: true } } },
    });
    const done = new Set(
      (await prisma.milestoneCompletion.findMany({
        where: { userId: req.userId },
        select: { milestoneSlug: true },
      })).map((c) => c.milestoneSlug)
    );
    const earlierIncomplete = levels
      .flatMap((l) => l.milestones)
      .some((m) => !done.has(m.slug));

    if (earlierIncomplete) {
      throw new HttpError(409, 'Finish the earlier levels first.');
    }

    const awarded = await award(req.userId, milestone.slug, milestone.xp);
    res.status(awarded ? 201 : 200).json({ completed: true, xp: milestone.xp, awarded });
  })
);
