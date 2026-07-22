export type ChannelType = 'ETSY' | 'INSTAGRAM' | 'REDDIT' | 'REFERRAL' | 'OTHER';
export type ContactStatus = 'PROSPECT' | 'ENGAGED' | 'CUSTOMER';
export type InteractionType = 'MESSAGE' | 'MEETING' | 'PURCHASE' | 'REVIEW' | 'OTHER';

export interface Business {
  id: string;
  name: string;
  niche: string;
  description: string;
  idealCustomer: string | null;
  audienceKeywords: string | null;
  salesAvenues: string | null;
  businessType: BusinessType | null;
  pageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SalesAvenue = 'ETSY' | 'SHOPIFY' | 'DEPOP' | 'AMAZON' | 'EBAY' | 'INSTAGRAM_SHOP' | 'OWN_WEBSITE' | 'IN_PERSON' | 'OTHER';
export type BusinessType = 'PRODUCT_SALES' | 'SERVICE' | 'KNOWLEDGE' | 'OTHER';

export interface Recommendation {
  title: string;
  platform: string;
  kind: 'community' | 'hashtag' | 'marketplace' | 'search' | 'event';
  url: string;
  reason: string;
}

export interface DiscoverResult {
  source: 'llm' | 'builtin';
  generatedAt: string;
  recommendations: Recommendation[];
}

export interface DiscoverStatus {
  llmConfigured: boolean;
  model: string | null;
}

export interface AppSettings {
  llmBaseUrl: string | null;
  llmModel: string | null;
  llmApiKeySet: boolean;
}

export interface LlmTestResult {
  ok: boolean;
  latencyMs?: number;
  model?: string;
  error?: string;
}

export type Gender = 'WOMAN' | 'MAN' | 'NON_BINARY' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type ExperienceLevel = 'FIRST_TIME' | 'SOME_EXPERIENCE' | 'EXPERIENCED';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  age: number;
  gender: Gender;
  location: string | null;
  phone: string | null;
  bio: string | null;
  experienceLevel: ExperienceLevel | null;
  goals: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MissionCategory = 'setup' | 'marketing' | 'outreach' | 'sales';
export type MissionCadence = 'once' | 'daily' | 'weekly' | 'monthly';

export interface Mission {
  id: string;
  category: MissionCategory;
  cadence: MissionCadence;
  title: string;
  description: string;
  xp: number;
  target: number;
  current: number;
  completed: boolean;
  completedAt: string | null;
  justCompleted: boolean;
}

export interface MissionSummary {
  xp: number;
  level: number;
  levelName: string;
  currentLevelXp: number;
  nextLevelXp: number | null;
}

export interface MissionsPayload {
  missions: Mission[];
  summary: MissionSummary;
  cadenceInfo: Record<MissionCadence, { title: string; blurb: string }>;
  justCompleted: string[];
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  // null = stock not tracked (services, digital, made-to-order)
  stock: number | null;
  sku: string | null;
  url: string | null;
  businessId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductsPayload {
  products: Product[];
  summary: {
    count: number;
    inventoryValue: number;
    lowStock: number;
    lowStockThreshold: number;
  };
}

export interface Payment {
  id: string;
  amount: number;
  note: string | null;
  quantity: number;
  occurredAt: string;
  createdAt: string;
  businessId: string;
  contactId: string | null;
  contact: { id: string; name: string } | null;
  productId: string | null;
  product: { id: string; name: string } | null;
}

export interface PaymentsPayload {
  payments: Payment[];
  summary: {
    total: number;
    thisMonth: number;
    count: number;
    average: number;
    topClient: { name: string; total: number } | null;
  };
}

export type SocialPlatform = 'TWITTER' | 'INSTAGRAM' | 'TIKTOK' | 'YOUTUBE' | 'REDDIT' | 'FACEBOOK' | 'PINTEREST';

export interface SocialLink {
  id: string;
  platform: SocialPlatform;
  url: string;
  businessId: string;
}

export interface Channel {
  id: string;
  type: ChannelType;
  label: string | null;
  url: string | null;
  businessId: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  notes: string | null;
  sourceUrl: string | null;
  status: ContactStatus;
  relationshipStrength: number;
  engagementScore: number;
  businessId: string;
  channelId: string;
  createdAt: string;
  updatedAt: string;
  // Present on /graph payloads; null if no interactions logged yet.
  lastInteractionAt?: string | null;
}

export interface DetectedChannel {
  type: ChannelType;
  label: string;
}

export type NoLinkKind = 'REFERRAL' | 'IN_PERSON' | 'OTHER';

export interface Interaction {
  id: string;
  type: InteractionType;
  note: string | null;
  weight: number;
  occurredAt: string;
  createdAt: string;
  contactId: string;
}

export interface ContactDetail extends Contact {
  interactions: Interaction[];
  channel: Channel;
}

export interface GraphPayload {
  business: Business;
  channels: Channel[];
  contacts: Contact[];
}

export interface FeedInteraction extends Interaction {
  contact: {
    id: string;
    name: string;
    status: ContactStatus;
    channel: { type: ChannelType; label: string | null };
  };
}
