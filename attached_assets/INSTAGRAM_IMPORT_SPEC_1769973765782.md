# Instagram Post Import Feature - Complete Specification

## Overview

Allow users to import Instagram posts by pasting a URL. The system will:
1. Extract post metadata (user, location, caption, images)
2. Create/update the Instagram user as a profile in the app
3. Create/update the place (restaurant/bar)
4. Create a review with embedded Instagram post
5. Display the review with native Instagram embed

---

## Database Schema Changes

### 1. Update `users` table

Add Instagram-specific fields:

```sql
-- Add these columns to existing users table
ALTER TABLE users ADD COLUMN instagram_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN instagram_post_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN last_instagram_sync TIMESTAMP;
ALTER TABLE users ADD COLUMN is_instagram_import BOOLEAN DEFAULT false;

-- Update instagram_handle to be unique if not already
ALTER TABLE users ADD CONSTRAINT users_instagram_handle_unique UNIQUE (instagram_handle);
```

**New columns explained:**
- `instagram_id` - Instagram's internal user ID (e.g., "123456789")
- `instagram_post_count` - Number of posts we've imported from this user
- `last_instagram_sync` - Last time we pulled their data
- `is_instagram_import` - True if this user was auto-created from an import (vs manually signed up)

---

### 2. Update `reviews` table

Add Instagram embed data:

```sql
-- Add these columns to existing reviews table
ALTER TABLE reviews ADD COLUMN instagram_post_id TEXT UNIQUE;
ALTER TABLE reviews ADD COLUMN instagram_url TEXT;
ALTER TABLE reviews ADD COLUMN instagram_embed_html TEXT;
ALTER TABLE reviews ADD COLUMN instagram_shortcode TEXT;
ALTER TABLE reviews ADD COLUMN source TEXT DEFAULT 'manual';

-- Add index for performance
CREATE INDEX idx_reviews_instagram_post_id ON reviews(instagram_post_id);
CREATE INDEX idx_reviews_source ON reviews(source);
```

**New columns explained:**
- `instagram_post_id` - Instagram's internal post ID (e.g., "C12345678")
- `instagram_url` - Original Instagram post URL
- `instagram_embed_html` - Cached embed HTML from Instagram oEmbed API
- `instagram_shortcode` - Short code from URL (e.g., "ABC123" from instagram.com/p/ABC123/)
- `source` - Enum: 'manual', 'instagram', 'tiktok', etc. (for future integrations)

---

### 3. Create `instagram_imports` table (import tracking)

```sql
CREATE TABLE instagram_imports (
  id VARCHAR(36) PRIMARY KEY,
  
  -- Import metadata
  instagram_post_id TEXT NOT NULL,
  instagram_url TEXT NOT NULL,
  instagram_shortcode TEXT NOT NULL,
  
  -- Import results
  user_id VARCHAR(36), -- references users.id (created/updated user)
  place_id VARCHAR(36), -- references places.id (created/updated place)
  review_id VARCHAR(36), -- references reviews.id (created review)
  
  -- Status tracking
  status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  error_message TEXT,
  
  -- Import details
  imported_by VARCHAR(36), -- references users.id (who initiated import)
  raw_data JSONB, -- Store full Instagram API response for debugging
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  UNIQUE(instagram_post_id)
);

CREATE INDEX idx_instagram_imports_status ON instagram_imports(status);
CREATE INDEX idx_instagram_imports_imported_by ON instagram_imports(imported_by);
```

**Why this table?**
- Track import history
- Debug failed imports
- Prevent duplicate imports
- Show user their import history

---

## API Endpoint Design

### POST `/api/instagram/import`

Import an Instagram post and create user/place/review.

**Request:**
```json
{
  "url": "https://www.instagram.com/p/ABC123/",
  "overrides": {
    "place_name": "Optional: override detected place name",
    "note": "Optional: add additional notes to review"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "import_id": "import-123",
    "user": {
      "id": "user-1",
      "username": "eitan",
      "created": false // or true if new user created
    },
    "place": {
      "id": "place-5",
      "name": "Carbone",
      "created": true // or false if existing place
    },
    "review": {
      "id": "review-42",
      "rating": null, // Instagram posts don't have ratings
      "note": "Caption from Instagram post...",
      "instagram_embed_html": "<blockquote class='instagram-media'>...</blockquote>"
    }
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": {
    "code": "ALREADY_IMPORTED",
    "message": "This Instagram post has already been imported",
    "existing_review_id": "review-10"
  }
}
```

**Error Codes:**
- `INVALID_URL` - Not a valid Instagram URL
- `ALREADY_IMPORTED` - Post already exists in database
- `POST_NOT_FOUND` - Instagram post doesn't exist or is private
- `NO_LOCATION` - Post doesn't have a location tag
- `LOCATION_NOT_FOUND` - Can't match location to a place in our database
- `RATE_LIMITED` - Too many imports in short time
- `INSTAGRAM_API_ERROR` - Instagram API returned an error

---

### GET `/api/instagram/preview`

Preview what will be imported (before committing).

**Request:**
```
GET /api/instagram/preview?url=https://www.instagram.com/p/ABC123/
```

**Response:**
```json
{
  "success": true,
  "data": {
    "instagram_user": {
      "username": "eitan",
      "full_name": "Eitan Bernath",
      "profile_pic_url": "https://...",
      "exists_in_db": false // or true if user already exists
    },
    "location": {
      "name": "Carbone",
      "address": "181 Thompson St, New York, NY",
      "instagram_location_id": "123456",
      "matched_place_id": "place-1", // or null if no match
      "confidence": 0.95 // how confident we are in the match
    },
    "caption": "Best pasta in NYC! The spicy rigatoni is incredible 🍝",
    "media_url": "https://instagram.com/...",
    "timestamp": "2025-01-15T20:00:00Z",
    "already_imported": false
  }
}
```

---

## Instagram Data Extraction

### Approach 1: Instagram oEmbed API (Recommended)

Instagram provides an official oEmbed endpoint that returns embed HTML and basic metadata.

**Endpoint:**
```
GET https://api.instagram.com/oembed?url={POST_URL}
```

**Example Response:**
```json
{
  "version": "1.0",
  "title": "Eitan Bernath on Instagram: \"Best pasta in NYC!\"",
  "author_name": "eitan",
  "author_url": "https://www.instagram.com/eitan/",
  "author_id": 123456789,
  "media_id": "3012345678901234567_123456789",
  "provider_name": "Instagram",
  "provider_url": "https://www.instagram.com",
  "type": "rich",
  "width": 658,
  "height": null,
  "html": "<blockquote class=\"instagram-media\" data-instgrm-captioned data-instgrm-permalink=\"https://www.instagram.com/p/ABC123/\"...></blockquote><script async src=\"//www.instagram.com/embed.js\"></script>",
  "thumbnail_url": "https://scontent.cdninstagram.com/...",
  "thumbnail_width": 640,
  "thumbnail_height": 640
}
```

**Limitations:**
- ❌ No location data in oEmbed response
- ❌ No caption text
- ✅ Provides embed HTML (main benefit)
- ✅ Provides author username and ID
- ✅ No API key required

---

### Approach 2: Web Scraping (For Location/Caption)

Since oEmbed doesn't provide location or caption, we need to scrape the post page.

**Instagram Post URL Structure:**
```
https://www.instagram.com/p/{SHORTCODE}/
```

**HTML Scraping Strategy:**

Instagram embeds JSON data in the page HTML:

```html
<script type="application/ld+json">
{
  "@context": "http://schema.org",
  "@type": "Article",
  "headline": "Caption text here...",
  "author": {
    "@type": "Person",
    "name": "eitan"
  },
  "datePublished": "2025-01-15T20:00:00Z",
  "image": "https://...",
  "contentLocation": {
    "@type": "Place",
    "name": "Carbone",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "181 Thompson St",
      "addressLocality": "New York",
      "addressRegion": "NY",
      "postalCode": "10012"
    }
  }
}
</script>
```

**Node.js Example:**

```javascript
import * as cheerio from 'cheerio';

async function scrapeInstagramPost(url: string) {
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Find the JSON-LD script tag
  const jsonLdScript = $('script[type="application/ld+json"]').html();
  if (!jsonLdScript) {
    throw new Error('Could not find post data');
  }
  
  const data = JSON.parse(jsonLdScript);
  
  return {
    caption: data.headline,
    username: data.author?.name,
    timestamp: data.datePublished,
    image_url: data.image,
    location: {
      name: data.contentLocation?.name,
      address: data.contentLocation?.address
    }
  };
}
```

**Limitations:**
- ⚠️ Instagram may change HTML structure
- ⚠️ Requires handling rate limiting
- ⚠️ May not work for private accounts

---

### Approach 3: Hybrid (Recommended Implementation)

Combine both approaches:

1. Use **oEmbed API** to get embed HTML and verify post exists
2. Use **scraping** to get location and caption
3. Fall back gracefully if scraping fails

```javascript
async function importInstagramPost(url: string) {
  // Step 1: Get embed HTML from oEmbed
  const oembedData = await fetch(
    `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`
  ).then(r => r.json());
  
  // Step 2: Scrape for location and caption
  let scrapedData;
  try {
    scrapedData = await scrapeInstagramPost(url);
  } catch (error) {
    console.warn('Scraping failed, using oEmbed data only', error);
  }
  
  // Step 3: Combine data
  return {
    instagram_post_id: oembedData.media_id,
    instagram_shortcode: extractShortcode(url),
    instagram_url: url,
    instagram_embed_html: oembedData.html,
    username: scrapedData?.username || oembedData.author_name,
    caption: scrapedData?.caption,
    location: scrapedData?.location,
    timestamp: scrapedData?.timestamp,
    thumbnail_url: oembedData.thumbnail_url
  };
}
```

---

## Import Flow (Step by Step)

### User Flow

```
1. User clicks "Import from Instagram" button
   ↓
2. Modal/dialog opens with input field
   ↓
3. User pastes Instagram URL (e.g., https://www.instagram.com/p/ABC123/)
   ↓
4. [OPTIONAL] Click "Preview" to see what will be imported
   ↓
5. Click "Import" to start process
   ↓
6. Loading state shows progress
   ↓
7. Success: Shows created review with embedded Instagram post
   OR
   Error: Shows error message with specific issue
```

---

### Backend Processing Flow

```javascript
async function processInstagramImport(url: string, importedBy: string) {
  // 1. Validate URL
  const shortcode = extractShortcode(url);
  if (!shortcode) {
    throw new Error('INVALID_URL');
  }
  
  // 2. Check if already imported
  const existingImport = await db.instagram_imports.findOne({
    where: { instagram_shortcode: shortcode }
  });
  if (existingImport) {
    throw new Error('ALREADY_IMPORTED');
  }
  
  // 3. Create import record
  const importRecord = await db.instagram_imports.create({
    id: generateId(),
    instagram_url: url,
    instagram_shortcode: shortcode,
    status: 'processing',
    imported_by: importedBy,
  });
  
  try {
    // 4. Fetch Instagram data
    const instagramData = await importInstagramPost(url);
    
    // 5. Create or find Instagram user
    let user = await db.users.findOne({
      where: { instagram_handle: instagramData.username }
    });
    
    if (!user) {
      user = await db.users.create({
        id: generateId(),
        username: instagramData.username,
        instagram_handle: instagramData.username,
        instagram_id: instagramData.author_id,
        first_name: instagramData.username,
        last_name: '',
        is_instagram_import: true,
        profile_image_url: instagramData.profile_pic_url,
        created_at: new Date(),
      });
    }
    
    // 6. Find or create place
    let place;
    if (instagramData.location) {
      // Try to match to existing place
      place = await findPlaceByLocation(instagramData.location);
      
      if (!place) {
        // Create new place
        place = await createPlaceFromInstagram(instagramData.location);
      }
    } else {
      throw new Error('NO_LOCATION');
    }
    
    // 7. Create review
    const review = await db.reviews.create({
      id: generateId(),
      user_id: user.id,
      place_id: place.id,
      rating: null, // Instagram posts don't have ratings
      note: instagramData.caption || '',
      visited_at: new Date(instagramData.timestamp),
      instagram_post_id: instagramData.instagram_post_id,
      instagram_url: instagramData.instagram_url,
      instagram_embed_html: instagramData.instagram_embed_html,
      instagram_shortcode: instagramData.instagram_shortcode,
      source: 'instagram',
      created_at: new Date(),
    });
    
    // 8. Update import record
    await db.instagram_imports.update({
      where: { id: importRecord.id },
      data: {
        status: 'completed',
        user_id: user.id,
        place_id: place.id,
        review_id: review.id,
        instagram_post_id: instagramData.instagram_post_id,
        raw_data: instagramData,
        updated_at: new Date(),
      }
    });
    
    return {
      user,
      place,
      review,
      import_id: importRecord.id
    };
    
  } catch (error) {
    // Update import record with error
    await db.instagram_imports.update({
      where: { id: importRecord.id },
      data: {
        status: 'failed',
        error_message: error.message,
        updated_at: new Date(),
      }
    });
    
    throw error;
  }
}
```

---

## Place Matching Logic

When an Instagram post has a location, we need to match it to a place in our database.

### Matching Strategy

```javascript
async function findPlaceByLocation(instagramLocation: {
  name: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
  };
}) {
  // 1. Try exact name + address match
  let place = await db.places.findFirst({
    where: {
      name: { equals: instagramLocation.name, mode: 'insensitive' },
      formatted_address: {
        contains: instagramLocation.address?.streetAddress,
        mode: 'insensitive'
      }
    }
  });
  
  if (place) return place;
  
  // 2. Try fuzzy name match in same neighborhood
  const candidates = await db.places.findMany({
    where: {
      name: {
        contains: instagramLocation.name.split(' ')[0], // First word
        mode: 'insensitive'
      },
      formatted_address: {
        contains: instagramLocation.address?.addressLocality, // City
        mode: 'insensitive'
      }
    }
  });
  
  // 3. Calculate similarity scores
  const scored = candidates.map(candidate => ({
    place: candidate,
    score: calculateSimilarity(
      instagramLocation.name,
      candidate.name
    )
  }));
  
  // 4. Return best match if confidence > 0.8
  scored.sort((a, b) => b.score - a.score);
  if (scored[0]?.score > 0.8) {
    return scored[0].place;
  }
  
  return null; // No match found
}

function calculateSimilarity(str1: string, str2: string): number {
  // Use Levenshtein distance or similar algorithm
  // Return value between 0 and 1
  const distance = levenshteinDistance(
    str1.toLowerCase(),
    str2.toLowerCase()
  );
  const maxLength = Math.max(str1.length, str2.length);
  return 1 - (distance / maxLength);
}
```

---

## UI Components

### 1. Import Button

```tsx
// components/instagram/ImportButton.tsx
export function InstagramImportButton() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Instagram className="h-4 w-4 mr-2" />
        Import from Instagram
      </Button>
      
      <InstagramImportDialog 
        open={isOpen} 
        onOpenChange={setIsOpen}
      />
    </>
  );
}
```

---

### 2. Import Dialog

```tsx
// components/instagram/ImportDialog.tsx
export function InstagramImportDialog({ open, onOpenChange }) {
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<'input' | 'preview' | 'importing'>('input');
  const [preview, setPreview] = useState(null);
  
  const handlePreview = async () => {
    const data = await api.instagram.preview(url);
    setPreview(data);
    setStep('preview');
  };
  
  const handleImport = async () => {
    setStep('importing');
    const result = await api.instagram.import(url);
    onOpenChange(false);
    // Navigate to the created review
    router.push(`/places/${result.place.id}/reviews/${result.review.id}`);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Instagram Post</DialogTitle>
          <DialogDescription>
            Paste an Instagram post URL to import it as a review
          </DialogDescription>
        </DialogHeader>
        
        {step === 'input' && (
          <div className="space-y-4">
            <Input
              placeholder="https://www.instagram.com/p/ABC123/"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePreview}>
                Preview
              </Button>
              <Button onClick={handleImport}>
                Import Now
              </Button>
            </div>
          </div>
        )}
        
        {step === 'preview' && preview && (
          <InstagramPreview data={preview} onImport={handleImport} />
        )}
        
        {step === 'importing' && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-2">Importing...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

### 3. Preview Component

```tsx
// components/instagram/Preview.tsx
export function InstagramPreview({ data, onImport }) {
  return (
    <div className="space-y-4">
      {/* User Preview */}
      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
        <Avatar>
          <AvatarImage src={data.instagram_user.profile_pic_url} />
        </Avatar>
        <div>
          <p className="font-semibold">@{data.instagram_user.username}</p>
          <p className="text-sm text-muted-foreground">
            {data.instagram_user.exists_in_db 
              ? '✓ Existing user' 
              : 'New user will be created'}
          </p>
        </div>
      </div>
      
      {/* Place Preview */}
      <div className="p-3 bg-muted rounded-lg">
        <p className="font-semibold">{data.location.name}</p>
        <p className="text-sm text-muted-foreground">
          {data.location.address}
        </p>
        {data.location.matched_place_id ? (
          <Badge variant="secondary" className="mt-2">
            Matched to existing place
          </Badge>
        ) : (
          <Badge variant="outline" className="mt-2">
            New place will be created
          </Badge>
        )}
      </div>
      
      {/* Caption Preview */}
      <div className="p-3 bg-muted rounded-lg">
        <p className="text-sm">{data.caption}</p>
      </div>
      
      {/* Image Preview */}
      {data.media_url && (
        <img 
          src={data.media_url} 
          alt="Instagram post" 
          className="rounded-lg w-full"
        />
      )}
      
      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={onImport} className="flex-1">
          Import This Post
        </Button>
      </div>
      
      {/* Warnings */}
      {data.location.confidence < 0.8 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            We're not very confident about the place match. 
            You may need to verify the location after import.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

---

### 4. Instagram Embed Component

Display the embedded Instagram post in the review.

```tsx
// components/instagram/EmbedPost.tsx
'use client';

import { useEffect } from 'react';

export function InstagramEmbedPost({ html }: { html: string }) {
  useEffect(() => {
    // Load Instagram embed script
    if (window.instgrm) {
      window.instgrm.Embeds.process();
    } else {
      const script = document.createElement('script');
      script.async = true;
      script.src = '//www.instagram.com/embed.js';
      document.body.appendChild(script);
    }
  }, [html]);
  
  return (
    <div 
      className="instagram-embed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

---

### 5. Review Card with Instagram Embed

```tsx
// components/reviews/ReviewCard.tsx
export function ReviewCard({ review }) {
  const isInstagramReview = review.source === 'instagram';
  
  return (
    <div className="border rounded-lg p-4">
      {/* Review Header */}
      <div className="flex items-center gap-3 mb-3">
        <Avatar>
          <AvatarImage src={review.user.profile_image_url} />
        </Avatar>
        <div>
          <p className="font-semibold">{review.user.first_name}</p>
          <p className="text-sm text-muted-foreground">
            {formatDate(review.visited_at)}
          </p>
        </div>
        {isInstagramReview && (
          <Badge variant="secondary" className="ml-auto">
            <Instagram className="h-3 w-3 mr-1" />
            Instagram
          </Badge>
        )}
      </div>
      
      {/* Review Content */}
      {review.note && (
        <p className="text-sm mb-3">{review.note}</p>
      )}
      
      {/* Instagram Embed */}
      {isInstagramReview && review.instagram_embed_html && (
        <InstagramEmbedPost html={review.instagram_embed_html} />
      )}
      
      {/* Rating */}
      {review.rating && (
        <div className="flex items-center gap-1 mt-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                "h-4 w-4",
                i < review.rating 
                  ? "fill-yellow-400 text-yellow-400" 
                  : "text-gray-300"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Edge Cases & Error Handling

### 1. Post Already Imported

**Scenario:** User tries to import the same Instagram post twice.

**Solution:**
```typescript
// Check before importing
const existing = await db.reviews.findFirst({
  where: { instagram_post_id: postId }
});

if (existing) {
  return {
    success: false,
    error: {
      code: 'ALREADY_IMPORTED',
      message: 'This post has already been imported',
      review_id: existing.id
    }
  };
}
```

---

### 2. Private Account

**Scenario:** User tries to import post from private Instagram account.

**Solution:**
```typescript
try {
  const response = await fetch(instagramUrl);
  if (response.status === 404) {
    throw new Error('POST_NOT_FOUND');
  }
} catch (error) {
  return {
    success: false,
    error: {
      code: 'POST_NOT_FOUND',
      message: 'This post is private or doesn\'t exist'
    }
  };
}
```

---

### 3. No Location Tag

**Scenario:** Instagram post doesn't have a location tag.

**Solution:** Allow manual place selection:

```tsx
{!data.location && (
  <div className="p-3 bg-yellow-50 rounded-lg">
    <AlertTriangle className="h-4 w-4 inline mr-2" />
    <span className="text-sm">
      This post doesn't have a location tag.
    </span>
    
    <PlaceSearchInput 
      onSelect={(place) => setManualPlace(place)}
      placeholder="Search for the place manually..."
    />
  </div>
)}
```

---

### 4. Ambiguous Place Match

**Scenario:** Multiple places match the Instagram location.

**Solution:** Show options to user:

```tsx
{data.location.matches?.length > 1 && (
  <div className="space-y-2">
    <p className="text-sm font-medium">
      Multiple matches found. Which place is this?
    </p>
    {data.location.matches.map(place => (
      <Button
        key={place.id}
        variant="outline"
        className="w-full justify-start"
        onClick={() => selectPlace(place.id)}
      >
        <MapPin className="h-4 w-4 mr-2" />
        <div className="text-left">
          <p className="font-medium">{place.name}</p>
          <p className="text-xs text-muted-foreground">
            {place.formatted_address}
          </p>
        </div>
      </Button>
    ))}
  </div>
)}
```

---

### 5. Rate Limiting

**Scenario:** User imports many posts quickly, Instagram blocks requests.

**Solution:** Implement rate limiting:

```typescript
// Rate limit: 10 imports per hour per user
const recentImports = await db.instagram_imports.count({
  where: {
    imported_by: userId,
    created_at: {
      gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
    }
  }
});

if (recentImports >= 10) {
  throw new Error('RATE_LIMITED');
}
```

---

## Future Enhancements

### Phase 2: Bulk Import

Allow importing multiple posts at once:

```tsx
<InstagramBulkImportDialog>
  <TextArea 
    placeholder="Paste multiple Instagram URLs (one per line)"
    rows={10}
  />
  <Button>Import All ({urls.length} posts)</Button>
</InstagramBulkImportDialog>
```

---

### Phase 3: Auto-sync

Automatically check Instagram accounts for new posts:

```sql
CREATE TABLE instagram_auto_sync (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  instagram_handle TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_sync TIMESTAMP,
  sync_frequency TEXT DEFAULT 'daily', -- 'hourly', 'daily', 'weekly'
  created_at TIMESTAMP DEFAULT now()
);
```

---

### Phase 4: Native Instagram Share

Use Instagram's native share sheet (mobile only):

```typescript
// Detect if Instagram app shared to our app
if (navigator.share) {
  const sharedUrl = new URLSearchParams(window.location.search).get('url');
  if (sharedUrl?.includes('instagram.com')) {
    // Auto-open import dialog with pre-filled URL
    openImportDialog(sharedUrl);
  }
}
```

---

## Implementation Checklist

### Database
- [ ] Add columns to `users` table
- [ ] Add columns to `reviews` table
- [ ] Create `instagram_imports` table
- [ ] Add indexes
- [ ] Run migrations

### API
- [ ] Create `POST /api/instagram/import` endpoint
- [ ] Create `GET /api/instagram/preview` endpoint
- [ ] Implement Instagram oEmbed fetching
- [ ] Implement Instagram scraping
- [ ] Implement place matching logic
- [ ] Add rate limiting
- [ ] Add error handling

### UI
- [ ] Create `InstagramImportButton` component
- [ ] Create `InstagramImportDialog` component
- [ ] Create `InstagramPreview` component
- [ ] Create `InstagramEmbedPost` component
- [ ] Update `ReviewCard` to show embeds
- [ ] Add import button to main UI

### Testing
- [ ] Test with public Instagram posts
- [ ] Test with posts with/without locations
- [ ] Test duplicate import prevention
- [ ] Test place matching accuracy
- [ ] Test embed rendering
- [ ] Test error states

---

## Example: Complete Import Flow

```
User pastes: https://www.instagram.com/p/C12ABC/

1. Frontend validates URL format
   ↓
2. Calls GET /api/instagram/preview?url=...
   ↓
3. Backend:
   a. Fetches oEmbed data
   b. Scrapes post page for location/caption
   c. Searches for matching place in database
   d. Returns preview data
   ↓
4. Frontend shows preview with:
   - User: @eitan (will create new user)
   - Place: Carbone, 181 Thompson St (matched existing)
   - Caption: "Best pasta in NYC!"
   ↓
5. User clicks "Import"
   ↓
6. Calls POST /api/instagram/import
   ↓
7. Backend:
   a. Creates instagram_import record (status: processing)
   b. Creates user record for @eitan
   c. Uses matched place (place-1)
   d. Creates review with embedded Instagram post
   e. Updates instagram_import (status: completed)
   ↓
8. Frontend navigates to /places/place-1/reviews/review-42
   ↓
9. User sees review with embedded Instagram post
```

---

## Security Considerations

1. **URL Validation:** Only allow instagram.com URLs
2. **Rate Limiting:** Prevent abuse (10 imports/hour/user)
3. **XSS Prevention:** Sanitize Instagram embed HTML (use DOMPurify)
4. **CSRF Protection:** Use CSRF tokens on import endpoint
5. **User Permissions:** Only allow authenticated users to import

---

## Performance Considerations

1. **Async Processing:** Import should be async (use queue for bulk)
2. **Caching:** Cache oEmbed responses (24 hours)
3. **Database Indexes:** Index on instagram_post_id, instagram_shortcode
4. **Embed Loading:** Lazy load Instagram embeds on scroll
5. **Image Optimization:** Store thumbnail URLs separately

---

## Success Metrics

Track these metrics to measure feature adoption:

1. **Import Volume:** Number of posts imported per day
2. **Import Success Rate:** Successful imports / total attempts
3. **Place Match Accuracy:** Auto-matched / total imports
4. **User Growth:** New users created from Instagram
5. **Engagement:** Views on Instagram-sourced reviews

---

## Questions for Replit Agent

When implementing this, ask Replit to:

1. "Implement the Instagram import feature according to this spec"
2. "Start with the database schema changes"
3. "Then create the API endpoints with full error handling"
4. "Then build the UI components with preview flow"
5. "Add proper TypeScript types throughout"
6. "Include loading states and error messages"
7. "Test with a real Instagram post URL"

---

## Notes

- Instagram's oEmbed endpoint is public and doesn't require authentication
- Scraping should be done server-side to avoid CORS issues
- Instagram embed script must be loaded once per page
- Consider using a job queue (BullMQ, Inngest) for async processing
- Monitor Instagram's robots.txt and terms of service for scraping
