import type { Business, Channel, Contact, ContactDetail, ContactStatus, ChannelType, GraphPayload, InteractionType, FeedInteraction, DetectedChannel, NoLinkKind, DiscoverResult, DiscoverStatus, AppSettings, LlmTestResult, UserProfile, Gender, ExperienceLevel, MissionsPayload, SocialLink, SocialPlatform, Payment, PaymentsPayload, Product, ProductsPayload, DiscoverProduct, TrendsPayload, GrowthPayload, GrowthPostDetail } from '../types';

// The native app always talks to a full API origin (there is no dev proxy like
// the web client's Vite server). Set EXPO_PUBLIC_API_URL in .env — no trailing
// slash, no /api. Falls back to the deployed Render API so a fresh clone runs.
const ORIGIN = (process.env.EXPO_PUBLIC_API_URL || 'https://sales-mechanic-api.onrender.com').replace(/\/+$/, '');
const BASE = `${ORIGIN}/api`;

// Carries the HTTP status and response body so callers can recover from
// specific failures (e.g. a 409 that already contains the existing record)
// instead of only being able to show a message.
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: any) {
    super(message);
    this.name = 'ApiError';
  }
}

// When Clerk is active, the app installs a getter here so every request
// carries the caller's session token. Without it (should not happen on
// native, where auth is required) the server rejects the call.
type TokenGetter = () => Promise<string | null>;
let authTokenGetter: TokenGetter | null = null;
export function setAuthTokenGetter(fn: TokenGetter | null) {
  authTokenGetter = fn;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authTokenGetter) {
    try {
      const token = await authTokenGetter();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      // Token fetch failed (expired/offline); let the request 401 naturally.
    }
  }

  let res: Response;
  try {
    // headers after options so ours (incl. Authorization) always win.
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    // Network-level failure: server down, connection refused, offline. The
    // Render free tier also cold-starts (~1 min) after idling, which surfaces
    // here as a timeout the first time.
    throw new ApiError("Can't reach the server. It may be waking up — try again in a moment.", 0, null);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `Request failed: ${res.status}`, res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getBusinesses: () => request<Business[]>('/business'),
  createBusiness: (data: { name: string; niche: string; description: string; salesAvenues?: string; businessType?: string }) =>
    request<Business>('/business', { method: 'POST', body: JSON.stringify(data) }),
  deleteBusiness: (id: string) => request<void>(`/business/${id}`, { method: 'DELETE' }),

  getChannels: (businessId: string) => request<(Channel & { _count: { contacts: number } })[]>(`/channels?businessId=${businessId}`),
  createChannel: (data: { businessId: string; type: ChannelType; label?: string }) =>
    request<Channel>('/channels', { method: 'POST', body: JSON.stringify(data) }),
  deleteChannel: (id: string) => request<void>(`/channels/${id}`, { method: 'DELETE' }),

  getContacts: (businessId: string, channelId?: string) =>
    request<Contact[]>(`/contacts?businessId=${businessId}${channelId ? `&channelId=${channelId}` : ''}`),
  getContact: (id: string) => request<ContactDetail>(`/contacts/${id}`),
  createContact: (data: {
    businessId: string;
    name: string;
    status?: ContactStatus;
    sourceUrl?: string;
    noLinkKind?: NoLinkKind;
    channelId?: string;
    firstNote?: string;
  }) => request<ContactDetail>('/contacts', { method: 'POST', body: JSON.stringify(data) }),

  detectChannel: (url: string) =>
    request<DetectedChannel | null>(`/contacts/detect-channel/preview?url=${encodeURIComponent(url)}`),
  updateContact: (id: string, data: Partial<{ name: string; notes: string; status: ContactStatus }>) =>
    request<Contact>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteContact: (id: string) => request<void>(`/contacts/${id}`, { method: 'DELETE' }),

  logInteraction: (contactId: string, data: { type: InteractionType; note?: string; weight?: number; occurredAt?: string }) =>
    request<ContactDetail>(`/contacts/${contactId}/interactions`, { method: 'POST', body: JSON.stringify(data) }),

  getGraph: (businessId: string) => request<GraphPayload>(`/graph?businessId=${businessId}`),

  getActivityFeed: (businessId: string, limit = 50) =>
    request<FeedInteraction[]>(`/interactions?businessId=${businessId}&limit=${limit}`),

  updateBusiness: (id: string, data: Partial<{ name: string; niche: string; description: string; idealCustomer: string; audienceKeywords: string; salesAvenues: string; businessType: string; pageUrl: string }>) =>
    request<Business>(`/business/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getDiscover: (businessId: string, refresh = false) =>
    request<DiscoverResult>(`/discover?businessId=${businessId}${refresh ? '&refresh=1' : ''}`),

  getDiscoverStatus: () => request<DiscoverStatus>('/discover/status'),

  getSettings: () => request<AppSettings>('/settings'),
  updateSettings: (data: Partial<{ llmBaseUrl: string; llmModel: string; llmApiKey: string }>) =>
    request<{ ok: boolean }>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  testLlm: () => request<LlmTestResult>('/settings/test-llm', { method: 'POST' }),

  getProfile: () => request<UserProfile | null>('/profile'),
  createProfile: (data: {
    name: string; email: string; age: number; gender: Gender;
    location?: string; phone?: string; bio?: string; experienceLevel?: ExperienceLevel; goals?: string;
  }) => request<UserProfile>('/profile', { method: 'POST', body: JSON.stringify(data) }),
  updateProfile: (id: string, data: Partial<{
    name: string; email: string; age: number; gender: Gender;
    location: string; phone: string; bio: string; experienceLevel: ExperienceLevel; goals: string;
  }>) => request<UserProfile>(`/profile/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getMissions: (businessId: string) => request<MissionsPayload>(`/missions?businessId=${businessId}`),

  getPayments: (businessId: string) => request<PaymentsPayload>(`/payments?businessId=${businessId}`),
  createPayment: (data: { businessId: string; amount: number; note?: string; contactId?: string | null; productId?: string | null; quantity?: number; occurredAt?: string }) =>
    request<Payment>('/payments', { method: 'POST', body: JSON.stringify(data) }),
  deletePayment: (id: string) => request<void>(`/payments/${id}`, { method: 'DELETE' }),

  getProducts: (businessId: string) => request<ProductsPayload>(`/products?businessId=${businessId}`),
  createProduct: (data: { businessId: string; name: string; description?: string; price?: number | null; stock?: number | null; sku?: string; url?: string }) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: Partial<{ name: string; description: string | null; price: number | null; stock: number | null; sku: string | null; url: string | null }>) =>
    request<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProduct: (id: string) => request<void>(`/products/${id}`, { method: 'DELETE' }),

  // Personalize by businessId (owners) or interests (explorers, no business
  // yet). Neither = hotness-ranked feed for a brand-new account.
  getTrends: (params: {
    businessId?: string;
    interests?: string[];
    sort?: 'niche' | 'trending';
    audience?: string;
    nicheSlug?: string;
  }) => {
    const q = new URLSearchParams();
    // businessId and interests are alternatives, never both — the server
    // reads whichever it finds and a business always wins.
    if (params.businessId) q.set('businessId', params.businessId);
    else if (params.interests?.length) q.set('interests', params.interests.join(','));
    if (params.sort) q.set('sort', params.sort);
    if (params.audience) q.set('audience', params.audience);
    if (params.nicheSlug) q.set('nicheSlug', params.nicheSlug);
    const s = q.toString();
    return request<TrendsPayload>(`/trends${s ? `?${s}` : ''}`);
  },
  getSavedTrends: () => request<DiscoverProduct[]>('/trends/saved'),

  getGrowth: (businessId: string) => request<GrowthPayload>(`/growth?businessId=${businessId}`),
  getGrowthPost: (id: string) => request<GrowthPostDetail>(`/growth/${id}`),
  saveTrend: (id: string) => request<{ saved: boolean }>(`/trends/${id}/save`, { method: 'POST' }),
  unsaveTrend: (id: string) => request<void>(`/trends/${id}/save`, { method: 'DELETE' }),
  dismissTrend: (id: string) => request<{ dismissed: boolean }>(`/trends/${id}/dismiss`, { method: 'POST' }),

  getSocials: (businessId: string) => request<SocialLink[]>(`/socials?businessId=${businessId}`),
  saveSocials: (businessId: string, links: { platform: SocialPlatform; url: string }[]) =>
    request<SocialLink[]>('/socials', { method: 'PUT', body: JSON.stringify({ businessId, links }) }),
};
