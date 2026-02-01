# Instagram Import Spec - Addendum: Real-World Examples & Multi-Platform

## Real Example: @sistersnacking Post

**URL:** `https://www.instagram.com/p/DT76EU2AFgt/`

### What We Need to Extract

```json
{
  "instagram_user": {
    "username": "sistersnacking",
    "is_verified": true,
    "profile_pic_url": "https://...",
    "instagram_id": "123456789"
  },
  "post": {
    "shortcode": "DT76EU2AFgt",
    "caption": "Cozy snow day calls for the coziest diner food and we absolutely love @sherwooddinerct for their diner classics and some dishes that remind us of Hillstone! 👍what to get: spinach artichoke dip, chicken Caesar wrap, ribs (wow), peanut chicken salad, crispy kale, double blueberry pancakes and cinnamon roll pancakes",
    "likes": 2522,
    "posted_at": "2026-01-25T...",
    "media_type": "carousel", // Multiple images
    "media_urls": [
      "https://instagram.com/photo1.jpg",
      "https://instagram.com/photo2.jpg",
      "https://instagram.com/photo3.jpg"
    ]
  },
  "location": {
    "name": "Sherwood Diner",
    "city": "Westport",
    "state": "CT",
    "tagged_account": "@sherwooddinerct"
  }
}
```

### Challenges with This Post

#### ❌ No Formal Location Tag
This post doesn't use Instagram's built-in location tag feature. The location is only mentioned in:
1. The caption text ("Sherwood Diner 🥞 Westport, CT")
2. The tagged account (@sherwooddinerct)

#### ✅ Solution: Multi-Strategy Location Extraction

```javascript
async function extractLocation(postData) {
  // Strategy 1: Check for formal Instagram location tag
  if (postData.location) {
    return {
      name: postData.location.name,
      address: postData.location.address,
      source: 'instagram_location_tag',
      confidence: 1.0
    };
  }
  
  // Strategy 2: Extract from tagged accounts
  const restaurantTags = postData.caption.match(/@(\w+)/g);
  if (restaurantTags) {
    for (const tag of restaurantTags) {
      const accountInfo = await fetchInstagramAccount(tag);
      if (accountInfo.category === 'Restaurant' || 
          accountInfo.category === 'Diner' ||
          accountInfo.bio.includes('food') ||
          accountInfo.bio.includes('restaurant')) {
        return {
          name: accountInfo.name,
          address: accountInfo.address || extractAddressFromBio(accountInfo.bio),
          instagram_handle: tag.replace('@', ''),
          source: 'tagged_account',
          confidence: 0.9
        };
      }
    }
  }
  
  // Strategy 3: Parse caption for location patterns
  const locationPatterns = [
    /📍\s*([^•\n]+)/,  // Pin emoji followed by location
    /at\s+([A-Z][^,\n]+,\s*[A-Z]{2})/,  // "at Place Name, ST"
    /([A-Z][^🥞\n]+)\s*🥞\s*([^,\n]+,\s*[A-Z]{2})/,  // "Place 🥞 City, ST"
  ];
  
  for (const pattern of locationPatterns) {
    const match = postData.caption.match(pattern);
    if (match) {
      return {
        name: match[1].trim(),
        raw_text: match[0],
        source: 'caption_parsing',
        confidence: 0.7
      };
    }
  }
  
  return null;
}
```

#### For This Specific Post:

```javascript
// Would extract:
{
  name: "Sherwood Diner",
  city: "Westport",
  state: "CT",
  tagged_account: "sherwooddinerct",
  source: "caption_parsing",
  confidence: 0.85
}
```

---

## Enhanced Schema: Support Multiple Images

### Update `photos` table

```sql
-- Add carousel position for multi-image posts
ALTER TABLE photos ADD COLUMN carousel_position INTEGER DEFAULT 0;
ALTER TABLE photos ADD COLUMN is_carousel BOOLEAN DEFAULT false;

-- Update index to include position
CREATE INDEX idx_photos_review_position ON photos(review_id, carousel_position);
```

### Import Multiple Images

```javascript
async function importInstagramMedia(postData, reviewId, userId, placeId) {
  const photos = [];
  
  if (postData.media_type === 'carousel') {
    // Multiple images
    for (let i = 0; i < postData.media_urls.length; i++) {
      const photo = await db.photos.create({
        id: generateId(),
        user_id: userId,
        place_id: placeId,
        review_id: reviewId,
        url: postData.media_urls[i],
        carousel_position: i,
        is_carousel: true,
        created_at: new Date(),
      });
      photos.push(photo);
    }
  } else {
    // Single image
    const photo = await db.photos.create({
      id: generateId(),
      user_id: userId,
      place_id: placeId,
      review_id: reviewId,
      url: postData.media_url,
      carousel_position: 0,
      is_carousel: false,
      created_at: new Date(),
    });
    photos.push(photo);
  }
  
  return photos;
}
```

---

## Complete Flow for This Example

### Step 1: User Pastes URL

```
URL: https://www.instagram.com/p/DT76EU2AFgt/
```

### Step 2: System Fetches Data

```javascript
const postData = await importInstagramPost('https://www.instagram.com/p/DT76EU2AFgt/');

// Result:
{
  username: "sistersnacking",
  is_verified: true,
  caption: "Cozy snow day calls for the coziest diner...",
  media_type: "carousel",
  media_urls: [...], // 3 images
  location: {
    name: "Sherwood Diner",
    city: "Westport",
    state: "CT",
    source: "caption_parsing"
  }
}
```

### Step 3: Create/Find User

```javascript
// Check if user exists
let user = await db.users.findFirst({
  where: { instagram_handle: 'sistersnacking' }
});

if (!user) {
  // Create new user
  user = await db.users.create({
    id: 'user-6',
    username: 'sistersnacking',
    instagram_handle: 'sistersnacking',
    first_name: 'Sisters',
    last_name: 'Nacking',
    is_verified: true,
    is_instagram_import: true,
    profile_image_url: '...',
    bio: 'Food content creators',
    location: 'Connecticut',
    created_at: new Date(),
  });
}
```

### Step 4: Create/Find Place

```javascript
// Search for "Sherwood Diner" in Westport, CT
let place = await findPlaceByLocation({
  name: 'Sherwood Diner',
  city: 'Westport',
  state: 'CT'
});

if (!place) {
  // Create new place
  place = await db.places.create({
    id: 'place-26',
    google_place_id: 'ChIJfakeSherwoodDiner',
    name: 'Sherwood Diner',
    formatted_address: 'Westport, CT 06880',
    lat: 41.1415,
    lng: -73.3579,
    primary_type: 'restaurant',
    types: JSON.stringify(['restaurant', 'diner', 'american']),
    price_level: 'PRICE_LEVEL_MODERATE',
    created_at: new Date(),
  });
}
```

### Step 5: Create Review

```javascript
const review = await db.reviews.create({
  id: 'review-22',
  user_id: 'user-6', // sistersnacking
  place_id: 'place-26', // Sherwood Diner
  rating: null, // No rating in Instagram post
  note: "Cozy snow day calls for the coziest diner food and we absolutely love @sherwooddinerct for their diner classics and some dishes that remind us of Hillstone! 👍what to get: spinach artichoke dip, chicken Caesar wrap, ribs (wow), peanut chicken salad, crispy kale, double blueberry pancakes and cinnamon roll pancakes",
  visited_at: new Date('2026-01-25'),
  instagram_post_id: 'C_DT76EU2AFgt',
  instagram_url: 'https://www.instagram.com/p/DT76EU2AFgt/',
  instagram_shortcode: 'DT76EU2AFgt',
  instagram_embed_html: '<blockquote class="instagram-media">...</blockquote>',
  source: 'instagram',
  created_at: new Date(),
});
```

### Step 6: Create Photos (Carousel)

```javascript
const photos = [
  {
    id: 'photo-10',
    user_id: 'user-6',
    place_id: 'place-26',
    review_id: 'review-22',
    url: 'https://instagram.com/image1.jpg', // Chicken Caesar wrap
    carousel_position: 0,
    is_carousel: true,
  },
  {
    id: 'photo-11',
    user_id: 'user-6',
    place_id: 'place-26',
    review_id: 'review-22',
    url: 'https://instagram.com/image2.jpg', // Ribs
    carousel_position: 1,
    is_carousel: true,
  },
  {
    id: 'photo-12',
    user_id: 'user-6',
    place_id: 'place-26',
    review_id: 'review-22',
    url: 'https://instagram.com/image3.jpg', // Pancakes
    carousel_position: 2,
    is_carousel: true,
  },
];

await db.photos.createMany({ data: photos });
```

### Step 7: Result

```
✅ User created: @sistersnacking (verified)
✅ Place created: Sherwood Diner, Westport, CT
✅ Review created with:
   - Full caption as review note
   - 3 carousel images
   - Instagram embed
   - Source: instagram
```

---

## Multi-Platform Support Architecture

### Phase 1: Instagram (Current)

Already specified in main document.

---

### Phase 2: TikTok Support

#### Schema Changes

```sql
-- Add TikTok-specific columns to reviews
ALTER TABLE reviews ADD COLUMN tiktok_video_id TEXT UNIQUE;
ALTER TABLE reviews ADD COLUMN tiktok_url TEXT;
ALTER TABLE reviews ADD COLUMN tiktok_embed_html TEXT;
ALTER TABLE reviews ADD COLUMN tiktok_video_url TEXT;

-- Update source enum
-- source can now be: 'manual', 'instagram', 'tiktok'

-- Add index
CREATE INDEX idx_reviews_tiktok_video_id ON reviews(tiktok_video_id);
```

#### TikTok oEmbed API

TikTok also provides an oEmbed endpoint:

```
GET https://www.tiktok.com/oembed?url={VIDEO_URL}
```

**Example Response:**
```json
{
  "version": "1.0",
  "type": "video",
  "title": "Best diner food in CT! 🥞 #foodtiktok #diner",
  "author_url": "https://www.tiktok.com/@sistersnacking",
  "author_name": "sistersnacking",
  "width": "340",
  "height": "700",
  "html": "<blockquote class=\"tiktok-embed\">...</blockquote>",
  "thumbnail_width": 720,
  "thumbnail_height": 1280,
  "thumbnail_url": "https://p16-sign-va.tiktokcdn.com/...",
  "provider_url": "https://www.tiktok.com",
  "provider_name": "TikTok"
}
```

#### TikTok Location Extraction

TikTok posts often have:
1. Location in caption/hashtags
2. Location in video overlay text
3. Tagged location (similar to Instagram)

```javascript
async function extractTikTokLocation(videoData) {
  // Check caption for location patterns
  const locationPatterns = [
    /#([A-Z][a-z]+(?:[A-Z][a-z]+)?(?:CT|NY|MA|etc))/g,
    /📍\s*([^#\n]+)/,
    /@([^@]+(?:restaurant|diner|cafe))/i
  ];
  
  for (const pattern of locationPatterns) {
    const match = videoData.caption.match(pattern);
    if (match) {
      return parseLocation(match[1]);
    }
  }
  
  return null;
}
```

---

### Phase 3: Twitter/X Support

#### Schema Changes

```sql
ALTER TABLE reviews ADD COLUMN twitter_tweet_id TEXT UNIQUE;
ALTER TABLE reviews ADD COLUMN twitter_url TEXT;
ALTER TABLE reviews ADD COLUMN twitter_embed_html TEXT;

CREATE INDEX idx_reviews_twitter_tweet_id ON reviews(twitter_tweet_id);
```

#### Twitter/X API

Twitter requires API authentication, but oEmbed is public:

```
GET https://publish.twitter.com/oembed?url={TWEET_URL}
```

---

### Phase 4: YouTube Support

For food vlogs and restaurant reviews.

```sql
ALTER TABLE reviews ADD COLUMN youtube_video_id TEXT UNIQUE;
ALTER TABLE reviews ADD COLUMN youtube_url TEXT;
ALTER TABLE reviews ADD COLUMN youtube_embed_html TEXT;
ALTER TABLE reviews ADD COLUMN youtube_timestamp TEXT; -- For time-stamped reviews
```

---

## Unified Import Interface

### Create Abstract Importer

```typescript
interface SocialMediaImporter {
  platform: 'instagram' | 'tiktok' | 'twitter' | 'youtube';
  
  validateUrl(url: string): boolean;
  extractPostId(url: string): string;
  fetchPostData(url: string): Promise<PostData>;
  extractLocation(postData: PostData): Promise<Location>;
  getEmbedHtml(url: string): Promise<string>;
}

class InstagramImporter implements SocialMediaImporter {
  platform = 'instagram' as const;
  
  validateUrl(url: string): boolean {
    return /instagram\.com\/(p|reel|tv)\/[\w-]+/.test(url);
  }
  
  extractPostId(url: string): string {
    const match = url.match(/\/(p|reel|tv)\/([\w-]+)/);
    return match?.[2] || '';
  }
  
  async fetchPostData(url: string): Promise<PostData> {
    // Implementation from main spec
  }
  
  async extractLocation(postData: PostData): Promise<Location> {
    // Multi-strategy extraction from addendum
  }
  
  async getEmbedHtml(url: string): Promise<string> {
    const response = await fetch(
      `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`
    );
    const data = await response.json();
    return data.html;
  }
}

class TikTokImporter implements SocialMediaImporter {
  platform = 'tiktok' as const;
  
  validateUrl(url: string): boolean {
    return /tiktok\.com\/@[\w.]+\/video\/\d+/.test(url);
  }
  
  // ... similar implementation
}
```

### Unified Import Function

```typescript
async function importSocialMediaPost(url: string, userId: string) {
  // Detect platform
  const importer = detectPlatform(url);
  if (!importer) {
    throw new Error('UNSUPPORTED_PLATFORM');
  }
  
  // Validate URL
  if (!importer.validateUrl(url)) {
    throw new Error('INVALID_URL');
  }
  
  // Check if already imported
  const postId = importer.extractPostId(url);
  const existing = await checkIfImported(importer.platform, postId);
  if (existing) {
    throw new Error('ALREADY_IMPORTED');
  }
  
  // Fetch data
  const postData = await importer.fetchPostData(url);
  const location = await importer.extractLocation(postData);
  const embedHtml = await importer.getEmbedHtml(url);
  
  // Create/find entities
  const user = await createOrFindUser(postData.author, importer.platform);
  const place = await createOrFindPlace(location);
  const review = await createReview({
    user,
    place,
    postData,
    embedHtml,
    platform: importer.platform,
  });
  
  return { user, place, review };
}

function detectPlatform(url: string): SocialMediaImporter | null {
  if (/instagram\.com/.test(url)) return new InstagramImporter();
  if (/tiktok\.com/.test(url)) return new TikTokImporter();
  if (/twitter\.com|x\.com/.test(url)) return new TwitterImporter();
  if (/youtube\.com|youtu\.be/.test(url)) return new YouTubeImporter();
  return null;
}
```

---

## Updated UI: Platform Detection

```tsx
export function SocialMediaImportDialog({ open, onOpenChange }) {
  const [url, setUrl] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);
  
  const handleUrlChange = (value: string) => {
    setUrl(value);
    
    // Auto-detect platform
    if (/instagram\.com/.test(value)) {
      setDetectedPlatform('Instagram');
    } else if (/tiktok\.com/.test(value)) {
      setDetectedPlatform('TikTok');
    } else if (/twitter\.com|x\.com/.test(value)) {
      setDetectedPlatform('Twitter/X');
    } else if (/youtube\.com|youtu\.be/.test(value)) {
      setDetectedPlatform('YouTube');
    } else {
      setDetectedPlatform(null);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from Social Media</DialogTitle>
          <DialogDescription>
            Paste a link from Instagram, TikTok, Twitter, or YouTube
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Input
              placeholder="https://www.instagram.com/p/ABC123/"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
            />
            
            {detectedPlatform && (
              <Badge 
                variant="secondary" 
                className="absolute right-2 top-2"
              >
                {detectedPlatform}
              </Badge>
            )}
          </div>
          
          {/* Platform icons as hints */}
          <div className="flex gap-2 justify-center">
            <Button variant="ghost" size="sm" className="opacity-50">
              <Instagram className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="opacity-50">
              <Video className="h-4 w-4" /> {/* TikTok */}
            </Button>
            <Button variant="ghost" size="sm" className="opacity-50">
              <Twitter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="opacity-50">
              <Youtube className="h-4 w-4" />
            </Button>
          </div>
          
          <Button onClick={handleImport} disabled={!detectedPlatform}>
            Import {detectedPlatform} Post
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Review Card: Multi-Platform Embeds

```tsx
export function ReviewCard({ review }) {
  const renderEmbed = () => {
    switch (review.source) {
      case 'instagram':
        return <InstagramEmbedPost html={review.instagram_embed_html} />;
      
      case 'tiktok':
        return <TikTokEmbedVideo html={review.tiktok_embed_html} />;
      
      case 'twitter':
        return <TwitterEmbedTweet html={review.twitter_embed_html} />;
      
      case 'youtube':
        return <YouTubeEmbedVideo html={review.youtube_embed_html} />;
      
      default:
        return null;
    }
  };
  
  return (
    <div className="border rounded-lg p-4">
      {/* User header */}
      <div className="flex items-center gap-2 mb-3">
        <Avatar>
          <AvatarImage src={review.user.profile_image_url} />
        </Avatar>
        <div className="flex-1">
          <p className="font-semibold">{review.user.first_name}</p>
          <p className="text-sm text-muted-foreground">
            {formatDate(review.visited_at)}
          </p>
        </div>
        
        {/* Platform badge */}
        <Badge variant="secondary">
          {review.source === 'instagram' && <Instagram className="h-3 w-3 mr-1" />}
          {review.source === 'tiktok' && <Video className="h-3 w-3 mr-1" />}
          {review.source === 'twitter' && <Twitter className="h-3 w-3 mr-1" />}
          {review.source === 'youtube' && <Youtube className="h-3 w-3 mr-1" />}
          {review.source}
        </Badge>
      </div>
      
      {/* Caption/review text */}
      {review.note && (
        <p className="text-sm mb-3">{review.note}</p>
      )}
      
      {/* Embedded content */}
      {renderEmbed()}
      
      {/* Carousel photos (if multiple) */}
      {review.photos?.length > 1 && (
        <div className="grid grid-cols-3 gap-2 mt-3">
          {review.photos.map((photo) => (
            <img
              key={photo.id}
              src={photo.url}
              alt=""
              className="rounded aspect-square object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Implementation Checklist: @sistersnacking Example

### Database
- [ ] Add `carousel_position` and `is_carousel` to photos table
- [ ] Add platform-specific columns to reviews table
- [ ] Update source enum to include all platforms

### Location Extraction
- [ ] Implement multi-strategy location extraction
- [ ] Add caption parsing for location patterns
- [ ] Add tagged account lookup
- [ ] Test with "@sherwooddinerct" example

### Media Handling
- [ ] Support carousel posts (multiple images)
- [ ] Store all images with position index
- [ ] Handle video posts (TikTok, Instagram Reels)

### User Creation
- [ ] Handle verified accounts (blue checkmark)
- [ ] Create user from Instagram handle
- [ ] Store verification status

### Testing
- [ ] Test with URL: https://www.instagram.com/p/DT76EU2AFgt/
- [ ] Verify creates @sistersnacking user
- [ ] Verify creates Sherwood Diner place
- [ ] Verify creates review with full caption
- [ ] Verify stores all 3 carousel images

---

## SQL for @sistersnacking Example

```sql
-- After import, your database would have:

-- New user
INSERT INTO users (id, username, instagram_handle, first_name, last_name, is_verified, is_instagram_import, created_at)
VALUES ('user-6', 'sistersnacking', 'sistersnacking', 'Sisters', 'Nacking', true, true, now());

-- New place
INSERT INTO places (id, google_place_id, name, formatted_address, lat, lng, primary_type, types, price_level)
VALUES ('place-26', 'ChIJfakeSherwoodDiner', 'Sherwood Diner', 'Westport, CT 06880', 41.1415, -73.3579, 'restaurant', '["restaurant", "diner", "american"]', 'PRICE_LEVEL_MODERATE');

-- New review
INSERT INTO reviews (id, user_id, place_id, note, visited_at, instagram_post_id, instagram_url, instagram_shortcode, source, created_at)
VALUES (
  'review-22',
  'user-6',
  'place-26',
  'Cozy snow day calls for the coziest diner food and we absolutely love @sherwooddinerct for their diner classics and some dishes that remind us of Hillstone! 👍what to get: spinach artichoke dip, chicken Caesar wrap, ribs (wow), peanut chicken salad, crispy kale, double blueberry pancakes and cinnamon roll pancakes',
  '2026-01-25 12:00:00',
  'C_DT76EU2AFgt',
  'https://www.instagram.com/p/DT76EU2AFgt/',
  'DT76EU2AFgt',
  'instagram',
  now()
);

-- 3 carousel photos
INSERT INTO photos (id, user_id, place_id, review_id, url, carousel_position, is_carousel)
VALUES 
  ('photo-10', 'user-6', 'place-26', 'review-22', 'https://instagram.com/image1.jpg', 0, true),
  ('photo-11', 'user-6', 'place-26', 'review-22', 'https://instagram.com/image2.jpg', 1, true),
  ('photo-12', 'user-6', 'place-26', 'review-22', 'https://instagram.com/image3.jpg', 2, true);
```

---

## Priority: Start with Instagram

**Phase 1 (Now):**
1. Instagram support only
2. Multi-strategy location extraction
3. Carousel support
4. Verified users

**Phase 2 (Later):**
1. TikTok support
2. Twitter/X support
3. YouTube support

This way you get a working feature quickly, then expand to other platforms using the same architecture.

---

## For Replit Agent

When you're ready to implement:

```
"Build the Instagram import feature with these requirements:

1. Support URL: https://www.instagram.com/p/DT76EU2AFgt/
2. Create user @sistersnacking (verified)
3. Create place 'Sherwood Diner, Westport, CT'
4. Extract location from caption (not location tag)
5. Support carousel posts (multiple images)
6. Store full caption as review note
7. Use the hybrid approach (oEmbed + scraping)

Start with the database migrations, then the API, then the UI."
```
