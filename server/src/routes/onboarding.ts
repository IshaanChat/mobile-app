// The onboarding script.
//
// Content, not code: the questions, the prompt options, the reveal copy and the
// closing lines all live in content/onboarding.json and are edited there like
// everything else in this repo. Serving it rather than compiling it into each
// client means the wording can change without an App Store release, which for
// the first four screens anybody ever sees is worth a route.
//
// Read once at startup. The file cannot change without a redeploy, so
// re-reading per request would be work with no possible different answer.

import { readFileSync } from 'fs';
import { join } from 'path';
import { Router } from 'express';
import { ah } from '../core/http';

export const onboardingRouter = Router();

let script: unknown = null;

try {
  script = JSON.parse(readFileSync(join('content', 'onboarding.json'), 'utf8'));
} catch (err) {
  // Loud: without this the first screen of the app has nothing to show, and a
  // silent empty object would look like a client bug rather than a missing file.
  console.error(
    '[onboarding] could not read content/onboarding.json — /api/onboarding will 503: ' +
      (err instanceof Error ? err.message : err)
  );
}

onboardingRouter.get(
  '/',
  ah(async (_req, res) => {
    if (!script) {
      return res.status(503).json({ error: 'Onboarding script unavailable' });
    }
    // Long-lived: it only changes on deploy, and a client that caches it can
    // start onboarding without waiting on a cold server.
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.json(script);
  })
);
