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
