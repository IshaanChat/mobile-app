// Client for a self-hosted LLM speaking the OpenAI-compatible chat API
// (Ollama, vLLM, LM Studio, llama.cpp server, etc).
//
// Config precedence: AppSetting rows (editable in the UI) > .env fallback:
//   llmBaseUrl / LLM_BASE_URL   e.g. http://localhost:11434/v1
//   llmModel   / LLM_MODEL      e.g. qwen2.5:7b
//   llmApiKey  / LLM_API_KEY    optional; sent as Bearer token if set
//
// If unconfigured or the call fails, callers fall back to the built-in
// recommender — the feature never breaks.

import { prisma } from '../prisma';
import type { Recommendation } from './types';

const TIMEOUT_MS = 60_000;

export interface LlmConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export async function getLlmConfig(userId: string): Promise<LlmConfig | null> {
  const rows = await prisma.appSetting.findMany({
    where: { userId, key: { in: ['llmBaseUrl', 'llmModel', 'llmApiKey'] } },
  });
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const baseUrl = stored.llmBaseUrl || process.env.LLM_BASE_URL;
  const model = stored.llmModel || process.env.LLM_MODEL;
  if (!baseUrl || !model) return null;

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    model,
    apiKey: stored.llmApiKey || process.env.LLM_API_KEY || undefined,
  };
}

// Single chat-completion call. Returns the assistant message or throws.
export async function chatOnce(config: LlmConfig, prompt: string, timeoutMs = TIMEOUT_MS): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM server returned ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
    }
    const data: any = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM response had no message content');
    return content;
  } finally {
    clearTimeout(timer);
  }
}

interface BusinessContext {
  name: string;
  niche: string;
  description: string;
  idealCustomer: string | null;
  audienceKeywords: string | null;
  businessType?: string | null;
  socials?: { platform: string; url: string }[];
}

const TYPE_LABELS: Record<string, string> = {
  PRODUCT_SALES: 'sells physical or digital products',
  SERVICE: 'sells services (consulting, contracting, freelance, AI services)',
  KNOWLEDGE: 'sells knowledge (courses, coaching, guides)',
  OTHER: 'unspecified',
};

function buildPrompt(biz: BusinessContext): string {
  const socialsLine = biz.socials?.length
    ? biz.socials.map((s) => `${s.platform}: ${s.url}`).join(', ')
    : 'none connected yet';

  return `You are a prospecting research assistant for a very small business owner with no sales background. Recommend specific online communities and places where they can find potential customers.

THE BUSINESS:
- Name: ${biz.name}
- Business type: ${TYPE_LABELS[biz.businessType ?? 'OTHER'] ?? TYPE_LABELS.OTHER}
- Product/niche: ${biz.niche}
- Description: ${biz.description}
- Ideal customer: ${biz.idealCustomer || 'not specified'}
- Audience keywords: ${biz.audienceKeywords || 'not specified'}
- Their social accounts: ${socialsLine}

Respond with ONLY a JSON array (no markdown fences, no commentary) of 8-12 recommendation objects with these exact keys:
- "title": short name of the community/place (e.g. "r/Pottery", "#handmademugs", "#SmallBusinessCheck")
- "platform": one of "Reddit", "Instagram", "X", "TikTok", "YouTube", "Etsy", "Facebook", "Pinterest", "Discord", "Forum", "Local", "Other"
- "kind": one of "community", "hashtag", "marketplace", "search", "event"
- "url": a real, working URL directly to it (for hashtags use the platform's tag URL; for searches use a real search URL)
- "reason": one sentence, second person, on why their ideal customers hang out there and how to approach (max 25 words)

Rules:
- Only real communities and URLs you are confident exist. Prefer large, active ones.
- Diversify: at most 2 per platform, and include X (Twitter) and TikTok options when relevant.
- Favor platforms where they already have an account (listed above) — meeting customers where you already exist is easier.
- No scraping tools, no purchased lead lists, no cold-email vendors.`;
}

export async function llmRecommendations(userId: string, biz: BusinessContext): Promise<Recommendation[] | null> {
  const config = await getLlmConfig(userId);
  if (!config) return null;

  try {
    const content = await chatOnce(config, buildPrompt(biz));
    return parseRecommendations(content);
  } catch (err) {
    console.warn(`[discover] LLM call failed (${err instanceof Error ? err.message : err}); falling back to built-in`);
    return null;
  }
}

const VALID_KINDS = new Set(['community', 'hashtag', 'marketplace', 'search', 'event']);

function parseRecommendations(content: string): Recommendation[] | null {
  // Models often wrap JSON in fences or add prose — extract the first array.
  const start = content.indexOf('[');
  const end = content.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const recs: Recommendation[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const { title, platform, kind, url, reason } = item as Record<string, unknown>;
    if (typeof title !== 'string' || typeof url !== 'string' || typeof reason !== 'string') continue;
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') continue;
    } catch {
      continue;
    }
    recs.push({
      title: title.slice(0, 80),
      platform: typeof platform === 'string' ? platform.slice(0, 20) : 'Other',
      kind: typeof kind === 'string' && VALID_KINDS.has(kind) ? (kind as Recommendation['kind']) : 'community',
      url,
      reason: reason.slice(0, 200),
    });
  }
  return recs.length > 0 ? recs.slice(0, 12) : null;
}
