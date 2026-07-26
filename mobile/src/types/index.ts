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

// A curated Discover-feed card: a product source / trend worth a look.
export type SourcingType =
  | 'DROPSHIP'
  | 'WHOLESALE'
  | 'PRINT_ON_DEMAND'
  | 'MATERIALS'
  | 'MAKE_YOUR_OWN';

export type Audience = 'maker' | 'reseller' | 'both';

/**
 * What the ingest pipeline actually measured. Null on the product when
 * nothing has been — which is every product until an API key exists — and
 * the card shows no evidence at all rather than dressing up the curator's
 * editorial `hotness` as data.
 */
export interface DiscoverEvidence {
  heat: number | null;
  /** Change since the previous poll. Null until there are two readings. */
  heatDelta: number | null;
  unitsSold: number | null;
  listings: number | null;
  saturation: 'low' | 'medium' | 'high' | null;
  priceLow: number | null;
  priceHigh: number | null;
  adCount: number | null;
  adDaysLive: number | null;
  adReach: number | null;
  /** Mean daily readers of the subject. Attention, not purchases. */
  interest: number | null;
  /**
   * Recent month's readership over the previous month's. Below 1 is a
   * decline — and most subjects decline most of the time, so this is only
   * meaningful next to what its peers are doing.
   */
  interestTrend: number | null;
  /** A live merchant listing, when one was found, and who sells it. */
  liveSourcingUrl: string | null;
  liveMerchant: string | null;
  /** 'meta' (the API) or 'manual' (logged at the research bench). */
  adSource: string | null;
  /** 'EU' when the ad data covers EU-reaching ads only, as Meta's does. */
  adCoverage: string | null;
  adEvidenceUrl: string | null;
  adAdvertiser: string | null;
  sources: string[];
  polledAt: string | null;
}

export interface DiscoverProduct {
  id: string;
  slug: string;
  title: string;
  blurb: string;
  category: string;
  niche: { slug: string; name: string; domain: string; audience: Audience } | null;
  sourcingType: SourcingType | null;
  sourceName: string | null;
  sourcingUrl: string | null;
  sourceCost: string | null;
  typicalResale: string | null;
  priceRange: string | null;
  imageUrl: string | null;
  imageCredit: string | null;
  hotness: number;
  evidence: DiscoverEvidence | null;
  saved: boolean;
  // Present on the saved shelf only.
  savedAt?: string;
}

/** A domain shelf. `productIds` index into `products` rather than copying. */
export interface DiscoverSection {
  key: string;
  title: string;
  productIds: string[];
}

export interface TrendsPayload {
  generatedAt: string;
  sort: 'niche' | 'trending';
  /** Empty when sort is 'trending' — the feed is flat there. */
  sections: DiscoverSection[];
  products: DiscoverProduct[];
}

// A Growth-feed post: a community where this business finds customers,
// written up blog-post deep.
export interface GrowthPost {
  id: string;
  title: string;
  platform: string;
  kind: 'community' | 'hashtag' | 'marketplace' | 'search' | 'event';
  url: string;
  tagline: string;
  audience: string;
  imageUrl: string | null;
  memberCount: number | null;
  hotness: number;
}

// Detail sections: the post reads as a profile of the community, with the
// how-to-approach guidance as a side element at the end. List-like fields
// (discussions/loves/dislikes/rules) are newline-separated items.
export interface GrowthPostDetail extends GrowthPost {
  overview: string;
  discussions: string;
  loves: string;
  dislikes: string;
  rules: string;
  approach: string;
}

export interface GrowthPayload {
  generatedAt: string;
  // The feed carries full sections so cards expand in place (accordion).
  posts: GrowthPostDetail[];
}

export interface FeedInteraction extends Interaction {
  contact: {
    id: string;
    name: string;
    status: ContactStatus;
    channel: { type: ChannelType; label: string | null };
  };
}
