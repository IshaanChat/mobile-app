// Load .env (LLM_* config etc). Optional — missing file is fine.
try {
  process.loadEnvFile();
} catch {}

import express from 'express';
import cors from 'cors';
import { businessRouter } from './routes/business';
import { channelsRouter } from './routes/channels';
import { contactsRouter } from './routes/contacts';
import { graphRouter } from './routes/graph';
import { interactionsRouter } from './routes/interactions';
import { discoverRouter } from './routes/discover';
import { settingsRouter } from './routes/settings';
import { profileRouter } from './routes/profile';
import { missionsRouter } from './routes/missions';
import { socialsRouter } from './routes/socials';
import { paymentsRouter } from './routes/payments';
import { analyticsRouter, registerAnalytics } from './modules/analytics';
import { productsRouter } from './routes/products';
import { trendsRouter } from './routes/trends';
import { growthRouter } from './routes/growth';
import { tipsRouter } from './routes/tips';
import { onboardingRouter } from './routes/onboarding';
import { journeyRouter } from './routes/journey';
import { accountRouter } from './routes/account';
import { adminRouter } from './routes/admin';
import { requireAdmin } from './core/admin-auth';
import { legalRouter } from './routes/legal';
import { errorHandler, notFoundHandler } from './core/http';
import { requireAuth, clerkConfigured } from './core/auth';

// Belt and braces: every async route is wrapped in ah() so rejections reach
// the error middleware, but if one ever slips through, log instead of letting
// Node 20+ terminate the process.
process.on('unhandledRejection', (err) => {
  console.error('[unhandled rejection]', err instanceof Error ? err.message : err);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaught exception]', err instanceof Error ? err.message : err);
});

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

// In production, only the deployed client may call the API. Locally (no
// CLIENT_ORIGIN set) allow anything, so the Vite dev server and the smoke
// test both work without configuration.
const clientOrigin = process.env.CLIENT_ORIGIN;
app.use(cors(clientOrigin ? { origin: clientOrigin.split(',').map((o) => o.trim()) } : {}));
app.use(express.json());

// Health is public; everything else requires an authenticated caller.
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, auth: clerkConfigured() ? 'clerk' : 'dev' })
);

// Public legal pages. Outside /api and above requireAuth: App Store Connect
// needs a Privacy Policy URL that anyone can open, and a URL that 401s is not
// a privacy policy.
app.use('/', legalRouter);

// Curator write endpoints. Mounted ABOVE requireAuth deliberately: these are
// not user routes and must not be reachable with a user's session token. They
// carry their own auth (ADMIN_TOKEN, fail-closed) — see core/admin-auth.ts.
app.use('/api/admin', requireAdmin, adminRouter);

app.use('/api', requireAuth);

app.use('/api/business', businessRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/graph', graphRouter);
app.use('/api/interactions', interactionsRouter);
app.use('/api/discover', discoverRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/missions', missionsRouter);
app.use('/api/socials', socialsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/products', productsRouter);
app.use('/api/trends', trendsRouter);
app.use('/api/growth', growthRouter);
app.use('/api/tips', tipsRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/journey', journeyRouter);
app.use('/api/account', accountRouter);

// Subscribe cross-cutting modules to the event bus.
registerAnalytics();

// Must come after all routes: unmatched /api paths return JSON, and any
// error thrown or rejected in a handler becomes a clean HTTP response.
app.use('/api', notFoundHandler);
app.use(errorHandler);

// Refuse to start in production without Clerk.
//
// requireAuth falls open by design: with no CLERK_SECRET_KEY it reads an
// `x-dev-user` header and lets the request through, which is what makes local
// development against a real database bearable. In production that same
// behaviour means anyone can read or write any account with one header, and
// CORS is no defence against a non-browser client.
//
// The failure mode this guards against is not "someone deleted the variable" —
// it is a fresh deploy from the blueprint, or a new environment, where nobody
// remembers it was ever set by hand. A server that refuses to boot is a five
// minute outage. A server that boots wide open is a breach nobody notices.
// Keyed off Render's own RENDER=true rather than NODE_ENV, which this service
// deliberately does not set: `npm ci` omits devDependencies under
// NODE_ENV=production, and typescript, prisma and tsx all live there, so
// setting it would break the build. NODE_ENV is still honoured for anywhere
// else this might run.
const isHosted = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';
if (isHosted && !clerkConfigured()) {
  console.error(
    'FATAL: CLERK_SECRET_KEY is not set on a hosted deploy.\n' +
      '  Without it every request is treated as the shared development account,\n' +
      '  so the API would accept any caller. Set it in the Render dashboard\n' +
      '  (Environment -> Add Environment Variable) and redeploy.'
  );
  process.exit(1);
}

// Bind on all interfaces, not just loopback: hosting platforms route
// external traffic to the container's public interface, and a server
// listening only on localhost is unreachable (requests hang rather than
// being refused, which makes it look like a slow start).
app.listen(port, '0.0.0.0', () => {
  console.log(`Venturo API listening on 0.0.0.0:${port}`);
  console.log(`  auth: ${clerkConfigured() ? 'clerk' : 'dev (no CLERK_SECRET_KEY set)'}`);
  console.log(`  database: ${process.env.DATABASE_URL ? 'configured' : 'MISSING — set DATABASE_URL'}`);
});
