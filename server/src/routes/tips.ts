// Tips: the two things a mission cannot carry.
//
// A mission is a step you complete and get credit for. A tip is either a small
// practical detail nobody thought to tell you (`kind: "know"`) or a line that
// exists purely to be on your side (`kind: "lift"`). Neither is worth a step,
// and both are worth saying.
//
// Curator-owned global rows (`npm run tips:import`); the API only reads. There
// is no per-user state here and deliberately so — which tips somebody has
// already seen is high-churn, low-value, and belongs on the device. Sending a
// write per tap would cost a round trip to record that a sentence was read.
//
// The whole eligible set is returned in one call, not one tip at a time. It is
// a few KB, the client already needs to pick between them without a round trip
// (the bubble changes on tap), and rotation logic that lives on the client
// cannot disagree with itself about what has been shown.

import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';

export const tipsRouter = Router();

const TABS = new Set(['discover', 'grow', 'shop', 'you', 'any']);

/**
 * GET /api/tips?tab=discover&level=2
 *
 * Both filters are optional and both are widening rather than narrowing in the
 * absence of a value: no `tab` means every tab, and no `level` means level 1
 * — the floor, not the ceiling, so a client that forgets to send it gets the
 * beginner-safe set rather than everything including advice that assumes a
 * shop already exists.
 */
tipsRouter.get(
  '/',
  ah(async (req, res) => {
    const tabParam = typeof req.query.tab === 'string' ? req.query.tab : undefined;
    // An unrecognised tab is ignored rather than rejected. A tip is a nicety;
    // a 400 that blanks the bubble because a tab was renamed in the client is
    // a worse outcome than showing the `any` tips.
    const tab = tabParam && TABS.has(tabParam) ? tabParam : undefined;

    const parsedLevel = Number(req.query.level);
    const level = Number.isInteger(parsedLevel) && parsedLevel >= 1 ? parsedLevel : 1;

    const tips = await prisma.tip.findMany({
      where: {
        status: 'ACTIVE',
        level: { lte: level },
        // `any` tips belong on every tab, so they always come along.
        ...(tab && tab !== 'any' ? { tab: { in: [tab, 'any'] } } : {}),
      },
      select: { id: true, slug: true, kind: true, text: true, tab: true, level: true },
      // Stable order so a client that caches by index doesn't reshuffle
      // between fetches. Actual rotation is the client's job.
      orderBy: { slug: 'asc' },
    });

    res.json({ tips });
  })
);
