// Authentication and per-user data isolation.
//
// Two modes, chosen by whether CLERK_SECRET_KEY is set:
//
//   dev  — no auth provider needed. The caller is identified by an
//          `x-dev-user` header (default "dev"), and the matching User row is
//          created on demand. This keeps local development frictionless and
//          lets the smoke test simulate two different accounts.
//   prod — verifies a Clerk session token from the Authorization header and
//          maps the Clerk user id onto a local User row.
//
// Routes never care which mode is active: they only read `req.userId`.

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Local User.id of the caller. Set by requireAuth. */
      userId: string;
    }
  }
}

export function clerkConfigured(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY);
}

/**
 * Find or create the local User row for an auth-provider identity.
 *
 * Race-safe: a brand-new account fires several requests at once (the app
 * loads the profile and businesses in parallel), and without care each
 * would see "no user" and try to INSERT, so all but one hit the unique
 * constraint on externalId and 409. Here the loser of that race simply
 * re-reads the row the winner created.
 */
async function resolveUser(externalId: string, email?: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { externalId }, select: { id: true } });
  if (existing) return existing.id;

  try {
    const created = await prisma.user.create({
      data: { externalId, email: email ?? null },
      select: { id: true },
    });
    return created.id;
  } catch (err) {
    // P2002 = another concurrent request created this same user first.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const winner = await prisma.user.findUnique({ where: { externalId }, select: { id: true } });
      if (winner) return winner.id;
    }
    throw err;
  }
}

/**
 * Verify a Clerk session token and return its user id.
 *
 * Imported lazily so the dependency is only needed when Clerk is actually
 * configured — local development and CI do not need it installed.
 */
async function verifyClerkToken(token: string): Promise<{ externalId: string } | null> {
  try {
    const { verifyToken } = await import('@clerk/backend');
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! });
    return payload?.sub ? { externalId: payload.sub } : null;
  } catch (err) {
    console.warn('[auth] token verification failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const run = async () => {
    if (clerkConfigured()) {
      const header = req.header('authorization') ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) return res.status(401).json({ error: 'Sign in to continue' });

      const verified = await verifyClerkToken(token);
      if (!verified) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });

      req.userId = await resolveUser(verified.externalId);
      return next();
    }

    // Dev mode: identity comes from a header, defaulting to a single user.
    const devUser = req.header('x-dev-user') || 'dev';
    req.userId = await resolveUser(`dev:${devUser}`);
    next();
  };

  run().catch(next);
};

/**
 * Confirm the caller owns this business before any read or write.
 *
 * Returns 404 rather than 403 for businesses owned by someone else, so the
 * API never confirms that an id exists to a stranger who guessed it.
 */
export async function assertOwnsBusiness(userId: string, businessId: unknown): Promise<string> {
  if (!businessId || typeof businessId !== 'string') {
    throw new HttpError(400, 'businessId is required');
  }
  const business = await prisma.business.findFirst({
    where: { id: businessId, userId },
    select: { id: true },
  });
  if (!business) throw new HttpError(404, 'Business not found');
  return business.id;
}

/** An error carrying an HTTP status, understood by the error middleware. */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Express type helper for handlers that require auth. */
export type AuthedHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
