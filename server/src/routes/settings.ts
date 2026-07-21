import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { getLlmConfig, chatOnce } from '../discover/llm';

export const settingsRouter = Router();

const LLM_KEYS = ['llmBaseUrl', 'llmModel', 'llmApiKey'] as const;

// The API key is write-only: the client only learns whether one is set.
settingsRouter.get('/', ah(async (_req, res) => {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: [...LLM_KEYS] } } });
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({
    llmBaseUrl: stored.llmBaseUrl || process.env.LLM_BASE_URL || null,
    llmModel: stored.llmModel || process.env.LLM_MODEL || null,
    llmApiKeySet: Boolean(stored.llmApiKey || process.env.LLM_API_KEY),
  });
}));

// Partial update: undefined leaves a key unchanged, empty string clears it.
settingsRouter.put('/', ah(async (req, res) => {
  const body = req.body ?? {};
  for (const key of LLM_KEYS) {
    const value = body[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') return res.status(400).json({ error: `${key} must be a string` });
    if (value.trim() === '') {
      await prisma.appSetting.deleteMany({ where: { key } });
    } else {
      await prisma.appSetting.upsert({
        where: { key },
        update: { value: value.trim() },
        create: { key, value: value.trim() },
      });
    }
  }
  res.json({ ok: true });
}));

// Try a tiny completion against the currently saved config.
settingsRouter.post('/test-llm', ah(async (_req, res) => {
  const config = await getLlmConfig();
  if (!config) {
    return res.json({ ok: false, error: 'No model configured — set a base URL and model name first.' });
  }
  const started = Date.now();
  try {
    await chatOnce(config, 'Reply with the single word: OK', 15_000);
    res.json({ ok: true, latencyMs: Date.now() - started, model: config.model });
  } catch (err) {
    res.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}));
