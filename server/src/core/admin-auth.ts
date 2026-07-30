// Auth for the curator endpoints.
//
// These routes write GLOBAL content — a bad write shows up in every user's
// feed, not one account's. So this is deliberately stricter than the app's
// own auth, and strict in the specific way the app's auth is not:
//
//   requireAuth (src/core/auth.ts) FAILS OPEN. With no CLERK_SECRET_KEY set it
//   reads an `x-dev-user` header and lets the request through, which is fine
//   for local development and a hole in production.
//
//   This FAILS CLOSED. No ADMIN_TOKEN set means every request is refused.
//   There is no dev-mode bypass, no header shortcut, and no way to turn it off
//   by forgetting to configure something.
//
// The token is compared in constant time. A naive `===` leaks the length of
// the matching prefix through timing, which is enough to recover a secret one
// character at a time given sufficient requests.

import { timingSafeEqual } from 'crypto';
import type { RequestHandler } from 'express';
import { HttpError } from './auth';

/** Short tokens are brute-forceable; refuse to run with one rather than pretend. */
const MIN_TOKEN_LENGTH = 24;

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, which would itself be a timing
  // signal. Compare lengths separately and always run the full comparison.
  if (a.length !== b.length) {
    // Still do a comparison of equal-length buffers so the failure path costs
    // roughly the same as a wrong-but-right-length token.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export const requireAdmin: RequestHandler = (req, _res, next) => {
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    // Deliberately the same generic 404-ish refusal as a wrong token: an
    // attacker learns nothing about whether the feature is configured.
    return next(new HttpError(404, 'Not found'));
  }
  if (expected.length < MIN_TOKEN_LENGTH) {
    console.error(
      `ADMIN_TOKEN is ${expected.length} characters; refusing to serve admin routes. ` +
        `Use at least ${MIN_TOKEN_LENGTH} — e.g. \`openssl rand -base64 32\`.`
    );
    return next(new HttpError(404, 'Not found'));
  }

  const header = req.header('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!provided || !tokensMatch(provided, expected)) {
    return next(new HttpError(404, 'Not found'));
  }

  return next();
};

/** True when the curator endpoints are usable. Reported by /api/health. */
export function adminConfigured(): boolean {
  const t = process.env.ADMIN_TOKEN;
  return Boolean(t && t.length >= MIN_TOKEN_LENGTH);
}
