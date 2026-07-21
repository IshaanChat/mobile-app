import type { Business, Channel, Contact, ContactDetail, ContactStatus, ChannelType, GraphPayload, InteractionType, FeedInteraction, DetectedChannel, NoLinkKind, DiscoverResult, DiscoverStatus, AppSettings, LlmTestResult, UserProfile, Gender, ExperienceLevel, MissionsPayload, SocialLink, SocialPlatform, Payment, PaymentsPayload, Product, ProductsPayload } from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
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

  getSocials: (businessId: string) => request<SocialLink[]>(`/socials?businessId=${businessId}`),
  saveSocials: (businessId: string, links: { platform: SocialPlatform; url: string }[]) =>
    request<SocialLink[]>('/socials', { method: 'PUT', body: JSON.stringify({ businessId, links }) }),
};
