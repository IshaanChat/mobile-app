// Account export and deletion.
//
// Deletion is not optional. App Store guideline 5.1.1(v) requires any app that
// lets people create an account to let them delete it *from inside the app* —
// there is no exemption, and "email us" does not satisfy it. Export is not
// required by Apple but is a GDPR right, and the two share almost all of their
// code, so building one without the other would be strange.
//
// Two things make deletion here more than a `DELETE` on one row:
//
// 1. **Two tables sit outside every cascade.** `AppEvent` and
//    `MissionCompletion` each carry a bare `businessId String` with an index
//    and *no relation*, so the foreign-key cascade that removes a business
//    leaves both behind — analytics about what the person did, and their
//    mission progress and XP. Both are about someone who just asked to be
//    forgotten. They have to be deleted explicitly, and *before* the businesses
//    whose ids identify them, or there is nothing left to match on.
//
//    `MissionCompletion` also stores the literal string `"global"` as a
//    businessId for missions not tied to a business, so those rows are shared
//    across accounts and must NOT be swept up by an account deletion.
//
// 2. **The Clerk identity outlives the local rows.** Deleting only our `User`
//    means the next sign-in silently recreates an empty account
//    (`resolveUser` is find-or-create), so from the user's point of view their
//    account still exists. Deleting it at Clerk is what actually makes it gone.

import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { HttpError } from '../core/auth';

export const accountRouter = Router();

/**
 * GET /api/account/export
 *
 * Everything held about the caller, as one JSON document.
 *
 * Includes the contacts and interactions they recorded about *other* people,
 * because that is their record of their own business, and excluding it would
 * make the export a partial answer to a question that deserves a complete one.
 */
accountRouter.get(
  '/export',
  ah(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        profile: true,
        settings: true,
        trendReactions: true,
        businesses: {
          include: {
            channels: true,
            socials: true,
            products: true,
            payments: true,
            contacts: { include: { interactions: true } },
          },
        },
      },
    });

    if (!user) throw new HttpError(404, 'Not found');

    const businessIds = user.businesses.map((b) => b.id);
    const [events, missions] = await Promise.all([
      businessIds.length
        ? prisma.appEvent.findMany({ where: { businessId: { in: businessIds } } })
        : Promise.resolve([]),
      businessIds.length
        ? prisma.missionCompletion.findMany({ where: { businessId: { in: businessIds } } })
        : Promise.resolve([]),
    ]);

    res.setHeader('Content-Disposition', 'attachment; filename="venturo-export.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email, createdAt: user.createdAt },
      profile: user.profile,
      businesses: user.businesses,
      savedProducts: user.trendReactions,
      settings: user.settings,
      activity: events,
      missionProgress: missions,
      note:
        'Curated catalogue content (products, communities, tips) is not included: ' +
        'it is the same for everyone and is not your data.',
    });
  })
);

/**
 * DELETE /api/account
 *
 * Irreversible. Removes every local row, then the Clerk identity.
 *
 * Ordering is deliberate and not interchangeable:
 *
 *   1. Read the business ids — after step 3 there is no way to find the
 *      orphaned rows, because neither `AppEvent.businessId` nor
 *      `MissionCompletion.businessId` is a foreign key, and nothing else on
 *      those rows identifies the account.
 *   2. Delete the analytics and mission-progress rows for those businesses.
 *   3. Delete the `User`, which cascades to profile, businesses, settings and
 *      saved products — and, through the businesses, to channels, contacts,
 *      interactions, products, payments and social links.
 *   4. Delete the Clerk user, so signing in again cannot resurrect an account.
 *
 * Step 4 is last and is allowed to fail without failing the request: if Clerk
 * is unreachable, the user's data is already gone and reporting an error would
 * invite them to press delete again on an account that no longer exists. The
 * failure is logged loudly instead, because it leaves an orphaned identity that
 * wants cleaning up.
 */
accountRouter.delete(
  '/',
  ah(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, externalId: true, businesses: { select: { id: true } } },
    });

    if (!user) throw new HttpError(404, 'Not found');

    const businessIds = user.businesses.map((b) => b.id);

    // Neither is covered by a cascade — see the note at the top of this file.
    // Scoped to this account's own business ids, which also keeps
    // MissionCompletion's shared "global" rows out of it.
    if (businessIds.length) {
      await Promise.all([
        prisma.appEvent.deleteMany({ where: { businessId: { in: businessIds } } }),
        prisma.missionCompletion.deleteMany({ where: { businessId: { in: businessIds } } }),
      ]);
    }

    await prisma.user.delete({ where: { id: user.id } });

    let identityRemoved = false;
    if (process.env.CLERK_SECRET_KEY && !user.externalId.startsWith('dev:')) {
      try {
        const { createClerkClient } = await import('@clerk/backend');
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        await clerk.users.deleteUser(user.externalId);
        identityRemoved = true;
      } catch (err) {
        // Deliberately not fatal. The data is already deleted; failing here
        // would tell the user their deletion failed when it did not.
        console.error(
          `[account] local data deleted but the Clerk identity ${user.externalId} remains — ` +
            `delete it by hand: ${err instanceof Error ? err.message : err}`
        );
      }
    }

    res.json({ deleted: true, identityRemoved });
  })
);
