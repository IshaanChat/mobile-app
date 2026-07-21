// Built-in recommendation engine: a curated dataset of real, large, active
// communities tagged by niche, matched against the business's keywords.
// Guaranteed to return something via dynamically generated search links,
// so Discover always works even with no LLM configured.

import type { Recommendation } from './types';

interface CuratedEntry extends Recommendation {
  tags: string[];
}

const CURATED: CuratedEntry[] = [
  // --- Ceramics / pottery ---
  { title: 'r/Pottery', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/Pottery/', reason: 'Active potters and pottery lovers share work daily — join conversations before mentioning your shop.', tags: ['pottery', 'ceramics', 'ceramic', 'stoneware', 'mug', 'mugs', 'clay', 'handmade'] },
  { title: 'r/mugs', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/mugs/', reason: 'People who genuinely collect mugs — your exact buyer if you make drinkware.', tags: ['mug', 'mugs', 'ceramics', 'pottery', 'coffee', 'drinkware'] },
  { title: '#ceramicsofinstagram', platform: 'Instagram', kind: 'hashtag', url: 'https://www.instagram.com/explore/tags/ceramicsofinstagram/', reason: 'Huge ceramics tag — engage with commenters on similar work; they already buy handmade.', tags: ['ceramics', 'pottery', 'clay', 'stoneware', 'handmade'] },
  // --- Jewelry ---
  { title: 'r/jewelrymaking', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/jewelrymaking/', reason: 'Makers and admirers of handmade jewelry; great for feedback and quiet prospecting.', tags: ['jewelry', 'jewellery', 'earrings', 'necklace', 'rings', 'beads', 'silver'] },
  { title: '#handmadejewelry', platform: 'Instagram', kind: 'hashtag', url: 'https://www.instagram.com/explore/tags/handmadejewelry/', reason: 'Buyers browse this tag looking for exactly what you make.', tags: ['jewelry', 'jewellery', 'earrings', 'necklace', 'handmade'] },
  // --- Candles / soap / skincare ---
  { title: 'r/candlemaking', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/candlemaking/', reason: 'Fellow makers share suppliers and customers ask for recommendations here.', tags: ['candle', 'candles', 'wax', 'scent', 'fragrance'] },
  { title: 'r/soapmaking', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/soapmaking/', reason: 'Soap and skincare community with frequent "where to buy" threads.', tags: ['soap', 'skincare', 'bath', 'handmade', 'natural'] },
  // --- Fiber arts ---
  { title: 'r/knitting', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/knitting/', reason: 'One of the largest fiber-arts communities; yarn buyers and pattern customers gather here.', tags: ['knitting', 'yarn', 'wool', 'fiber', 'knit'] },
  { title: 'r/crochet', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/crochet/', reason: 'Massive, friendly community that celebrates finished pieces and asks where to buy.', tags: ['crochet', 'yarn', 'amigurumi', 'fiber'] },
  { title: 'Ravelry', platform: 'Forum', kind: 'community', url: 'https://www.ravelry.com/', reason: 'The home of knitters and crocheters — forums, groups, and pattern sales in one place.', tags: ['knitting', 'crochet', 'yarn', 'pattern', 'fiber', 'wool'] },
  // --- Art / prints / stickers ---
  { title: 'r/ArtBusiness', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/ArtBusiness/', reason: 'Artists selling their work trade real tactics — learn and connect with peers who refer customers.', tags: ['art', 'artist', 'prints', 'painting', 'illustration', 'drawing'] },
  { title: '#artprintsforsale', platform: 'Instagram', kind: 'hashtag', url: 'https://www.instagram.com/explore/tags/artprintsforsale/', reason: 'Collectors actively browse this tag with wallets open.', tags: ['art', 'prints', 'painting', 'illustration'] },
  { title: 'r/stickers', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/stickers/', reason: 'Sticker collectors and trade threads — soft-launch new designs here.', tags: ['sticker', 'stickers', 'stationery', 'vinyl'] },
  // --- Woodworking ---
  { title: 'r/woodworking', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/woodworking/', reason: 'Millions of members; finished-work posts routinely get "do you sell these?" comments.', tags: ['wood', 'woodworking', 'furniture', 'carving', 'cutting board'] },
  // --- Baking / food ---
  { title: 'r/Baking', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/Baking/', reason: 'Home bakers and dessert lovers; local buyers often ask for custom orders.', tags: ['baking', 'cake', 'cookies', 'dessert', 'bakery', 'food'] },
  { title: '#customcakes', platform: 'Instagram', kind: 'hashtag', url: 'https://www.instagram.com/explore/tags/customcakes/', reason: 'People planning events search this tag to find bakers near them.', tags: ['cake', 'baking', 'bakery', 'dessert', 'wedding'] },
  // --- Coaching / services ---
  { title: 'r/Entrepreneur', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/Entrepreneur/', reason: 'Early-stage founders looking for coaches, accountability, and services — answer questions to build trust.', tags: ['coach', 'coaching', 'business', 'consulting', 'entrepreneur', 'startup'] },
  { title: 'r/smallbusiness', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/smallbusiness/', reason: 'Small-business owners ask for help daily; genuinely useful answers convert to clients.', tags: ['coach', 'coaching', 'business', 'consulting', 'services', 'marketing'] },
  { title: 'r/GetMotivated', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/GetMotivated/', reason: 'People actively working on themselves — a natural audience for life and fitness coaching.', tags: ['coach', 'coaching', 'fitness', 'life coach', 'motivation', 'wellness'] },
  // --- Fitness / wellness ---
  { title: 'r/xxfitness', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/xxfitness/', reason: 'Engaged fitness community; personal trainers who contribute genuinely get noticed.', tags: ['fitness', 'training', 'workout', 'wellness', 'health', 'yoga'] },
  { title: '#yogaeverydamnday', platform: 'Instagram', kind: 'hashtag', url: 'https://www.instagram.com/explore/tags/yogaeverydamnday/', reason: 'One of the biggest yoga tags — your students are scrolling it right now.', tags: ['yoga', 'wellness', 'fitness', 'meditation'] },
  // --- Plants ---
  { title: 'r/houseplants', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/houseplants/', reason: 'Plant people buy pots, propagation stations, and plant art constantly.', tags: ['plants', 'houseplants', 'planters', 'pots', 'garden', 'succulents'] },
  // --- Pets ---
  { title: 'r/dogs', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/dogs/', reason: 'Dog owners spend generously on custom gear, treats, and portraits.', tags: ['dog', 'dogs', 'pet', 'pets', 'collar', 'treats'] },
  // --- Vintage ---
  { title: 'r/vintage', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/vintage/', reason: 'Vintage lovers who hunt for curated finds like yours.', tags: ['vintage', 'antique', 'retro', 'thrift', 'secondhand'] },
  // --- Generic handmade / marketplace ---
  { title: 'Etsy Community Forums', platform: 'Etsy', kind: 'community', url: 'https://community.etsy.com/', reason: 'Fellow sellers share what channels work; buyers browse the showcase threads.', tags: ['handmade', 'etsy', 'craft', 'shop', 'seller'] },
  { title: 'r/somethingimade', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/somethingimade/', reason: 'Show-and-tell for makers — posts here regularly turn commenters into customers.', tags: ['handmade', 'craft', 'maker', 'diy'] },
  { title: 'r/handmade', platform: 'Reddit', kind: 'community', url: 'https://www.reddit.com/r/handmade/', reason: 'Dedicated to handmade goods, with selling threads and buyer traffic.', tags: ['handmade', 'craft', 'maker', 'etsy'] },

  // --- X (Twitter) ---
  { title: '#SmallBusiness on X', platform: 'X', kind: 'hashtag', url: 'https://x.com/search?q=%23SmallBusiness&f=live', reason: 'Constant stream of people celebrating and supporting small businesses — join conversations, don’t just post.', tags: ['handmade', 'business', 'shop', 'craft', 'seller', 'etsy'] },
  { title: '#BuildInPublic on X', platform: 'X', kind: 'hashtag', url: 'https://x.com/search?q=%23buildinpublic&f=live', reason: 'Founders sharing their journey openly attract customers who root for them — your story is your marketing.', tags: ['coach', 'coaching', 'business', 'startup', 'entrepreneur', 'consulting', 'app'] },
  { title: '#ShopSmall on X', platform: 'X', kind: 'hashtag', url: 'https://x.com/search?q=%23ShopSmall&f=live', reason: 'Buyers who deliberately choose small over corporate — exactly the people who’ll love what you do.', tags: ['handmade', 'craft', 'shop', 'etsy', 'vintage', 'maker'] },
  { title: '#WomenInBusiness on X', platform: 'X', kind: 'hashtag', url: 'https://x.com/search?q=%23WomenInBusiness&f=live', reason: 'A generous, active community of founders lifting each other up — support flows both ways here.', tags: ['coach', 'coaching', 'business', 'entrepreneur', 'consulting', 'services', 'wellness'] },

  // --- TikTok ---
  { title: '#SmallBusinessCheck', platform: 'TikTok', kind: 'hashtag', url: 'https://www.tiktok.com/tag/smallbusinesscheck', reason: 'Billions of views of people showing off small-business finds — behind-the-scenes videos do incredibly well.', tags: ['handmade', 'craft', 'shop', 'etsy', 'seller', 'business'] },
  { title: '#CraftTok', platform: 'TikTok', kind: 'hashtag', url: 'https://www.tiktok.com/tag/crafttok', reason: 'Craft lovers binge process videos here — show how it’s made and watch orders follow.', tags: ['craft', 'handmade', 'pottery', 'ceramics', 'knitting', 'crochet', 'candle', 'soap', 'art'] },
  { title: '#TikTokMadeMeBuyIt', platform: 'TikTok', kind: 'hashtag', url: 'https://www.tiktok.com/tag/tiktokmademebuyit', reason: 'The internet’s biggest impulse-buy aisle — one authentic video can change your month.', tags: ['handmade', 'shop', 'candle', 'skincare', 'jewelry', 'food', 'gift'] },

  // --- YouTube ---
  { title: 'YouTube: studio vlogs', platform: 'YouTube', kind: 'search', url: 'https://www.youtube.com/results?search_query=studio+vlog+small+business', reason: 'Studio-vlog viewers become loyal customers — comment genuinely on creators in your niche to get discovered.', tags: ['handmade', 'craft', 'art', 'pottery', 'ceramics', 'maker'] },

  // --- Pinterest ---
  { title: 'Pinterest for handmade goods', platform: 'Pinterest', kind: 'community', url: 'https://www.pinterest.com/search/pins/?q=handmade%20gifts', reason: 'People plan purchases here months ahead — pins keep selling for you long after you post them.', tags: ['handmade', 'craft', 'gift', 'wedding', 'decor', 'jewelry', 'art'] },
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9#]+/)
    .filter((t) => t.length > 2);
}

// Tags so broad they match almost any handmade business; they shouldn't be
// enough on their own to surface a niche-specific community.
const GENERIC_TAGS = new Set(['handmade', 'craft', 'maker', 'diy', 'etsy', 'shop', 'seller', 'business']);

// Business type tilts curated matching toward communities that fit how this
// kind of business actually finds customers.
const TYPE_TOKENS: Record<string, string[]> = {
  PRODUCT_SALES: ['handmade', 'shop', 'etsy', 'maker'],
  SERVICE: ['consulting', 'services', 'business', 'entrepreneur'],
  KNOWLEDGE: ['coach', 'coaching', 'course', 'entrepreneur'],
};

export function builtinRecommendations(biz: {
  niche: string;
  description: string;
  idealCustomer: string | null;
  audienceKeywords: string | null;
  businessType?: string | null;
}): Recommendation[] {
  const tokens = new Set([
    ...tokenize(biz.niche),
    ...tokenize(biz.description),
    ...tokenize(biz.idealCustomer ?? ''),
    ...tokenize(biz.audienceKeywords ?? ''),
    ...(TYPE_TOKENS[biz.businessType ?? ''] ?? []),
  ]);

  const scored = CURATED.map((entry) => {
    let score = 0;
    for (const tag of entry.tags) {
      // Tag can be multi-word ("cutting board"); only count full matches —
      // partial-word credit surfaces unrelated niches.
      const words = tag.split(' ');
      if (!words.every((w) => tokens.has(w))) continue;
      if (words.length > 1) score += 3;
      else score += GENERIC_TAGS.has(tag) ? 1 : 2;
    }
    return { entry, score };
  })
    .filter(({ score }) => score >= 2)
    .sort((a, b) => b.score - a.score);

  // Platform diversity: round-robin across platforms (max 2 each) so results
  // never collapse into a wall of one network.
  const byPlatform = new Map<string, typeof scored>();
  for (const item of scored) {
    const list = byPlatform.get(item.entry.platform) ?? [];
    if (list.length < 2) {
      list.push(item);
      byPlatform.set(item.entry.platform, list);
    }
  }
  const curatedPicks: Recommendation[] = [];
  let round = 0;
  while (curatedPicks.length < 8) {
    let added = false;
    for (const list of byPlatform.values()) {
      const item = list[round];
      if (item && curatedPicks.length < 8) {
        curatedPicks.push({
          title: item.entry.title,
          platform: item.entry.platform,
          kind: item.entry.kind,
          url: item.entry.url,
          reason: item.entry.reason,
        });
        added = true;
      }
    }
    if (!added) break;
    round++;
  }

  // Dynamic search recipes from the user's own keywords — always available,
  // spread across platforms so each keyword gets a different lens.
  const keywords = (biz.audienceKeywords ?? biz.niche)
    .split(/[,;]+/)
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 3);

  const recipeBuilders = [
    (kw: string, enc: string, tag: string): Recommendation => ({
      title: `Reddit: communities about "${kw}"`,
      platform: 'Reddit', kind: 'search',
      url: `https://www.reddit.com/search/?q=${enc}&type=sr`,
      reason: `Find every subreddit about ${kw} — sort by members and join the top three.`,
    }),
    (kw: string, _enc: string, tag: string): Recommendation => ({
      title: `#${tag} on Instagram`,
      platform: 'Instagram', kind: 'hashtag',
      url: `https://www.instagram.com/explore/tags/${tag}/`,
      reason: `People posting under #${tag} are your warmest possible audience — comment genuinely first.`,
    }),
    (kw: string, enc: string): Recommendation => ({
      title: `X: live talk about "${kw}"`,
      platform: 'X', kind: 'search',
      url: `https://x.com/search?q=${enc}&f=live`,
      reason: `Real-time conversations about ${kw} — reply helpfully and people check your profile.`,
    }),
    (kw: string, _enc: string, tag: string): Recommendation => ({
      title: `#${tag} on TikTok`,
      platform: 'TikTok', kind: 'hashtag',
      url: `https://www.tiktok.com/tag/${tag}`,
      reason: `See what ${kw} content takes off on TikTok — then make your own version.`,
    }),
    (kw: string, enc: string): Recommendation => ({
      title: `YouTube: ${kw} community`,
      platform: 'YouTube', kind: 'search',
      url: `https://www.youtube.com/results?search_query=${enc}`,
      reason: `Comment thoughtfully on ${kw} videos — creators and their audiences both notice.`,
    }),
    (kw: string, enc: string): Recommendation => ({
      title: `Facebook groups: "${kw}"`,
      platform: 'Facebook', kind: 'search',
      url: `https://www.facebook.com/search/groups/?q=${enc}`,
      reason: `Local and hobby groups around ${kw} are where word-of-mouth referrals start.`,
    }),
  ];

  const dynamic: Recommendation[] = [];
  let builderIdx = 0;
  for (const kw of keywords) {
    const enc = encodeURIComponent(kw);
    const tag = kw.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Two different platform lenses per keyword.
    for (let i = 0; i < 2; i++) {
      dynamic.push(recipeBuilders[builderIdx % recipeBuilders.length](kw, enc, tag));
      builderIdx++;
    }
  }

  // Dedupe by URL, curated entries first.
  const seen = new Set<string>();
  const merged: Recommendation[] = [];
  for (const rec of [...curatedPicks, ...dynamic]) {
    if (seen.has(rec.url)) continue;
    seen.add(rec.url);
    merged.push(rec);
  }
  return merged.slice(0, 14);
}
