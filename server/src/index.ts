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
import { errorHandler, notFoundHandler } from './core/http';

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

app.use(cors());
app.use(express.json());

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

// Subscribe cross-cutting modules to the event bus.
registerAnalytics();

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Must come after all routes: unmatched /api paths return JSON, and any
// error thrown or rejected in a handler becomes a clean HTTP response.
app.use('/api', notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Sales Mechanic API listening on http://localhost:${port}`);
});
