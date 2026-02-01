import * as cheerio from 'cheerio';

export interface InstagramLocation {
  name: string;
  city?: string;
  state?: string;
  address?: string;
  taggedAccount?: string;
  source: 'instagram_location_tag' | 'tagged_account' | 'caption_parsing' | 'demo_data';
  confidence: number;
}

export interface InstagramPostData {
  instagramPostId: string;
  instagramShortcode: string;
  instagramUrl: string;
  instagramEmbedHtml: string;
  username: string;
  authorId?: string;
  profilePicUrl?: string;
  isVerified?: boolean;
  caption?: string;
  mediaType: 'image' | 'carousel' | 'video';
  mediaUrls: string[];
  thumbnailUrl?: string;
  timestamp?: string;
  location?: InstagramLocation;
}

export interface OEmbedResponse {
  version: string;
  title: string;
  author_name: string;
  author_url: string;
  author_id?: number;
  media_id: string;
  provider_name: string;
  provider_url: string;
  type: string;
  width: number;
  height: number | null;
  html: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
}

const DEMO_POSTS: Record<string, InstagramPostData> = {
  'DT76EU2AFgt': {
    instagramPostId: 'C_DT76EU2AFgt_demo',
    instagramShortcode: 'DT76EU2AFgt',
    instagramUrl: 'https://www.instagram.com/p/DT76EU2AFgt/',
    instagramEmbedHtml: '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/DT76EU2AFgt/"><a href="https://www.instagram.com/p/DT76EU2AFgt/">View on Instagram</a></blockquote><script async src="//www.instagram.com/embed.js"></script>',
    username: 'sistersnacking',
    authorId: '123456789',
    isVerified: true,
    caption: "Cozy snow day calls for the coziest diner food and we absolutely love @sherwooddinerct for their diner classics and some dishes that remind us of Hillstone! 👍what to get: spinach artichoke dip, chicken Caesar wrap, ribs (wow), peanut chicken salad, crispy kale, double blueberry pancakes and cinnamon roll pancakes",
    mediaType: 'carousel',
    mediaUrls: [
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=640',
      'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=640',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=640',
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=640',
    timestamp: '2026-01-25T12:00:00Z',
    location: {
      name: 'Sherwood Diner',
      city: 'Westport',
      state: 'CT',
      taggedAccount: 'sherwooddinerct',
      source: 'demo_data',
      confidence: 1.0,
    },
  },
};

export function validateInstagramUrl(url: string): boolean {
  return /instagram\.com\/(p|reel|tv)\/[\w-]+/.test(url);
}

export function extractShortcode(url: string): string | null {
  const match = url.match(/\/(p|reel|tv)\/([\w-]+)/);
  return match?.[2] || null;
}

export function normalizeInstagramUrl(url: string): string {
  const shortcode = extractShortcode(url);
  if (!shortcode) return url;
  return `https://www.instagram.com/p/${shortcode}/`;
}

export async function fetchOEmbed(url: string): Promise<OEmbedResponse> {
  const normalizedUrl = normalizeInstagramUrl(url);
  
  const appId = process.env.FACEBOOK_APP_ID;
  const clientToken = process.env.FACEBOOK_CLIENT_TOKEN;
  
  if (!appId || !clientToken) {
    throw new Error('MISSING_FACEBOOK_CREDENTIALS');
  }
  
  const accessToken = `${appId}|${clientToken}`;
  const oembedUrl = `https://graph.facebook.com/v21.0/instagram_oembed?url=${encodeURIComponent(normalizedUrl)}&access_token=${accessToken}`;
  
  console.log('Fetching Instagram oEmbed from Graph API...');
  
  const response = await fetch(oembedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BeliClone/1.0)',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Instagram oEmbed error:', response.status, errorText);
    if (response.status === 404) {
      throw new Error('POST_NOT_FOUND');
    }
    throw new Error('INSTAGRAM_API_ERROR');
  }
  
  return response.json();
}

export async function scrapeInstagramPost(url: string): Promise<{
  caption?: string;
  username?: string;
  timestamp?: string;
  imageUrls?: string[];
  location?: {
    name?: string;
    address?: {
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
    };
  };
}> {
  const normalizedUrl = normalizeInstagramUrl(url);
  
  const response = await fetch(normalizedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch Instagram post');
  }
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const jsonLdScript = $('script[type="application/ld+json"]').html();
  
  if (jsonLdScript) {
    try {
      const data = JSON.parse(jsonLdScript);
      return {
        caption: data.headline || data.articleBody,
        username: data.author?.name || data.author?.identifier,
        timestamp: data.datePublished || data.uploadDate,
        imageUrls: Array.isArray(data.image) ? data.image : data.image ? [data.image] : undefined,
        location: data.contentLocation ? {
          name: data.contentLocation.name,
          address: data.contentLocation.address,
        } : undefined,
      };
    } catch {
      // JSON parsing failed, continue without scraped data
    }
  }
  
  const metaDescription = $('meta[property="og:description"]').attr('content');
  const metaImage = $('meta[property="og:image"]').attr('content');
  
  return {
    caption: metaDescription,
    imageUrls: metaImage ? [metaImage] : undefined,
  };
}

export function extractLocationFromCaption(caption: string): InstagramLocation | null {
  const locationPatterns = [
    { regex: /📍\s*([^•\n]+)/, group: 1, source: 'caption_parsing' as const },
    { regex: /at\s+([A-Z][^,\n]+),\s*([A-Z]{2})/, group: 0, source: 'caption_parsing' as const },
    { regex: /([A-Z][^🥞\n]+)\s*🥞\s*([^,\n]+),\s*([A-Z]{2})/, group: 0, source: 'caption_parsing' as const },
    { regex: /^([A-Z][a-zA-Z\s'&]+(?:Diner|Restaurant|Cafe|Café|Bar|Grill|Kitchen|Bistro|Eatery|Pizzeria|Tavern))\s*[🍕🍝🍔🍟🌮🌯🥗🍣🍱🍛🍜🍲🥘🍳]?\s*([A-Za-z\s]+),\s*([A-Z]{2})/m, group: 0, source: 'caption_parsing' as const },
  ];
  
  for (const pattern of locationPatterns) {
    const match = caption.match(pattern.regex);
    if (match) {
      if (pattern.regex.toString().includes('🥞') && match[1] && match[2] && match[3]) {
        return {
          name: match[1].trim(),
          city: match[2].trim(),
          state: match[3].trim(),
          source: pattern.source,
          confidence: 0.85,
        };
      }
      
      if (pattern.regex.toString().includes('at\\s+') && match[1] && match[2]) {
        const parts = match[1].split(',');
        return {
          name: parts[0].trim(),
          city: parts.length > 1 ? parts[1].trim() : undefined,
          state: match[2].trim(),
          source: pattern.source,
          confidence: 0.8,
        };
      }
      
      if (match[1]) {
        return {
          name: match[1].trim(),
          source: pattern.source,
          confidence: 0.7,
        };
      }
    }
  }
  
  return null;
}

export function extractTaggedAccounts(caption: string): string[] {
  const tags = caption.match(/@([\w.]+)/g);
  return tags ? tags.map(tag => tag.replace('@', '')) : [];
}

export function extractLocationFromTags(caption: string): InstagramLocation | null {
  const tags = extractTaggedAccounts(caption);
  
  const restaurantPatterns = [
    /diner/i, /restaurant/i, /cafe/i, /bar/i, /grill/i, 
    /kitchen/i, /bistro/i, /eatery/i, /pizzeria/i, /tavern/i,
    /bakery/i, /coffee/i, /food/i, /ct$/i, /ny$/i, /nyc$/i
  ];
  
  for (const tag of tags) {
    if (restaurantPatterns.some(pattern => pattern.test(tag))) {
      const name = tag
        .replace(/ct$/i, '')
        .replace(/ny$/i, '')
        .replace(/nyc$/i, '')
        .split(/(?=[A-Z])/)
        .join(' ')
        .trim();
      
      return {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        taggedAccount: tag,
        source: 'tagged_account',
        confidence: 0.9,
      };
    }
  }
  
  return null;
}

export async function extractLocation(
  scrapedData: Awaited<ReturnType<typeof scrapeInstagramPost>>,
  caption?: string
): Promise<InstagramLocation | null> {
  if (scrapedData.location?.name) {
    const addr = scrapedData.location.address;
    return {
      name: scrapedData.location.name,
      city: addr?.addressLocality,
      state: addr?.addressRegion,
      address: addr?.streetAddress,
      source: 'instagram_location_tag',
      confidence: 1.0,
    };
  }
  
  if (caption) {
    const tagLocation = extractLocationFromTags(caption);
    if (tagLocation) {
      return tagLocation;
    }
    
    const captionLocation = extractLocationFromCaption(caption);
    if (captionLocation) {
      return captionLocation;
    }
  }
  
  return null;
}

export async function importInstagramPost(url: string): Promise<InstagramPostData> {
  const shortcode = extractShortcode(url);
  if (!shortcode) {
    throw new Error('INVALID_URL');
  }
  
  if (DEMO_POSTS[shortcode]) {
    console.log(`Using demo data for shortcode: ${shortcode}`);
    return DEMO_POSTS[shortcode];
  }
  
  let oembedData: OEmbedResponse | null = null;
  let oembedError: Error | null = null;
  try {
    oembedData = await fetchOEmbed(url);
    console.log('oEmbed data fetched successfully:', oembedData?.author_name);
  } catch (error) {
    oembedError = error as Error;
    console.warn('oEmbed fetch failed:', error);
  }
  
  let scrapedData: Awaited<ReturnType<typeof scrapeInstagramPost>> = {};
  try {
    scrapedData = await scrapeInstagramPost(url);
  } catch (error) {
    console.warn('Scraping failed:', error);
  }
  
  if (!oembedData && !scrapedData.caption && !scrapedData.username) {
    if (oembedError?.message === 'MISSING_FACEBOOK_CREDENTIALS') {
      throw new Error('MISSING_FACEBOOK_CREDENTIALS');
    }
    throw new Error('INSTAGRAM_API_ERROR');
  }
  
  const caption = scrapedData.caption || (oembedData ? extractCaptionFromTitle(oembedData.title) : undefined);
  const location = await extractLocation(scrapedData, caption);
  
  const mediaUrls = scrapedData.imageUrls && scrapedData.imageUrls.length > 0
    ? scrapedData.imageUrls
    : oembedData?.thumbnail_url ? [oembedData.thumbnail_url] : [];
  
  const isCarousel = mediaUrls.length > 1;
  
  const embedHtml = oembedData?.html || 
    `<blockquote class="instagram-media" data-instgrm-permalink="${normalizeInstagramUrl(url)}"><a href="${normalizeInstagramUrl(url)}">View on Instagram</a></blockquote><script async src="//www.instagram.com/embed.js"></script>`;
  
  return {
    instagramPostId: oembedData?.media_id || `instagram_${shortcode}_${Date.now()}`,
    instagramShortcode: shortcode,
    instagramUrl: normalizeInstagramUrl(url),
    instagramEmbedHtml: embedHtml,
    username: scrapedData.username || oembedData?.author_name || 'unknown',
    authorId: oembedData?.author_id?.toString(),
    thumbnailUrl: oembedData?.thumbnail_url || mediaUrls[0],
    caption,
    mediaType: isCarousel ? 'carousel' : 'image',
    mediaUrls: mediaUrls.length > 0 ? mediaUrls : ['https://via.placeholder.com/640'],
    timestamp: scrapedData.timestamp,
    location: location ?? undefined,
  };
}

function extractCaptionFromTitle(title: string): string | undefined {
  const match = title.match(/on Instagram: [""](.+)[""]$/);
  if (match) {
    return match[1];
  }
  
  const colonIndex = title.indexOf(': ');
  if (colonIndex > 0) {
    return title.slice(colonIndex + 2).replace(/^[""]|[""]$/g, '');
  }
  
  return undefined;
}

export type { OEmbedResponse as InstagramOEmbedResponse };
