# Database Building Plan — Twn Sq Content Pipeline

## Overview

This document outlines strategies for building out the Twn Sq database with real creator profiles, places, reviews, photos, and AI-generated tags using **Apify scrapers**, **Google Places API**, and **OpenAI**.

The goal: go from an empty database to a rich, interconnected network of creators, places, and reviews that feels alive and curated.

---

## Current Schema Summary

| Model | Purpose |
|-------|---------|
| **User** | Creator/user profile. Has Instagram fields (`instagramHandle`, `instagramId`, `isInstagramImport`). |
| **Place** | Real-world location tied to a `googlePlaceId`. Has `name`, `address`, `lat/lng`, `types`, `priceLevel`, `neighborhood`. |
| **Review** | A user's review of a place. Has `source` (manual/instagram/tiktok), social post cache fields, and optional Instagram embed fields. |
| **Photo** | Media attached to a review/place. Supports carousels (`isCarousel`, `carouselPosition`). |
| **PlaceTag** | Links a Tag to a Place with `source` (manual/ai/google/user) and `confidence` score. |
| **Tag** | Individual tags like "Date Night", "Brunch", "Craft Cocktails" within a TagCategory. |
| **TagCategory** | Groups like "Vibe", "Food Type", "Occasion", "Features", "Dietary", "Drinks". |
| **InstagramImport** | Tracks the state of importing an Instagram post (pending → processing → completed/failed). |
| **SavedPlace** | User bookmarks a place with optional rating and emoji. |
| **List / ListPlace** | User-created collections of places. |
| **Activity** | Feed items for social features. |

---

## Strategy 1: The "Seed List" Approach (Best for Launch)

**Concept:** Start with a curated list of 20-50 food/travel creators you already know. Scrape their Instagram/TikTok profiles to pull posts, identify places, and build out the database.

### Exact Step-by-Step Flow

For each creator in your seed list (e.g., `@infatuation`, `@eitanbernath`, `@devourpower`):

#### Phase 1: Scrape the Creator's Profile & Posts

```
INPUT: Instagram handle (e.g., "infatuation")

STEP 1 — Call Apify Instagram Scraper
  - Actor: apify/instagram-scraper
  - Input: { "username": "infatuation", "resultsLimit": 50 }
  - Returns: Array of posts, each containing:
    - Post ID, shortcode, URL
    - Caption text
    - Media URLs (images/videos)
    - Location tag (if any) — { name, id, lat, lng }
    - Like count, comment count
    - Posted timestamp
    - Author profile info (bio, profile pic, follower count)
```

#### Phase 2: Filter for Location-Tagged Posts

```
STEP 2 — Filter posts
  - Keep ONLY posts that have a location tag (post.locationName != null)
  - Discard posts with no location (recipe videos, selfies, etc.)
  - Typically 30-60% of food creator posts have locations
  - Result: Array of located posts
```

#### Phase 3: Resolve Each Location to a Google Place

For each post that has a location tag:

```
STEP 3 — Call Google Places API: Text Search
  - Endpoint: POST https://places.googleapis.com/v1/places:searchText
  - Input: {
      "textQuery": "{post.locationName}, {post.locationCity}",
      "locationBias": {
        "circle": {
          "center": { "latitude": post.locationLat, "longitude": post.locationLng },
          "radius": 500.0
        }
      }
    }
  - Returns: Place details including:
    - googlePlaceId (e.g., "ChIJE9LNqsxZwokR1K8jnpN2pT0")
    - name, formattedAddress
    - location (lat/lng)
    - types array
    - priceLevel
    - photos (references)
  
  - If location tag includes lat/lng from Instagram, use it for bias
  - If not, search by name + city from caption analysis
  - If no match found, skip this post (don't create orphan places)
```

#### Phase 4: Create Database Rows (IN THIS ORDER)

The order matters because of foreign key relationships:

```
STEP 4A — Create/Find PLACE (must exist first, everything references it)
  ┌─────────────────────────────────────────────────┐
  │ Check: Does a Place with this googlePlaceId     │
  │        already exist in our DB?                 │
  │                                                 │
  │ YES → Use existing Place row                    │
  │ NO  → INSERT into places:                       │
  │   {                                             │
  │     googlePlaceId: "ChIJ...",                   │
  │     name: "Carbone",                            │
  │     formattedAddress: "181 Thompson St...",      │
  │     neighborhood: "Greenwich Village",           │
  │     locality: "New York",                       │
  │     lat: 40.7291,                               │
  │     lng: -74.0007,                              │
  │     primaryType: "italian_restaurant",           │
  │     types: ["restaurant", "italian_restaurant"], │
  │     priceLevel: "PRICE_LEVEL_VERY_EXPENSIVE",   │
  │     photoRefs: [...]                            │
  │   }                                             │
  └─────────────────────────────────────────────────┘

STEP 4B — Create/Find USER (must exist before reviews)
  ┌─────────────────────────────────────────────────┐
  │ Check: Does a User with this instagramHandle    │
  │        already exist?                           │
  │                                                 │
  │ YES → Use existing User row, update if needed   │
  │ NO  → INSERT into users:                        │
  │   {                                             │
  │     username: "infatuation",                    │
  │     instagramHandle: "infatuation",              │
  │     instagramId: "123456789",                   │
  │     firstName: "The",                           │
  │     lastName: "Infatuation",                    │
  │     profileImageUrl: "{from scrape}",           │
  │     bio: "{from scrape}",                       │
  │     isInstagramImport: true,                    │
  │     isVerified: true,                           │
  │     instagramPostCount: 2400,                   │
  │     lastInstagramSync: NOW()                    │
  │   }                                             │
  └─────────────────────────────────────────────────┘

STEP 4C — Create REVIEW (links User → Place)
  ┌─────────────────────────────────────────────────┐
  │ Check: Does a Review with this instagramPostId  │
  │        already exist? (prevents duplicates)     │
  │                                                 │
  │ YES → Skip (already imported)                   │
  │ NO  → INSERT into reviews:                      │
  │   {                                             │
  │     userId: "{user.id}",                        │
  │     placeId: "{place.id}",                      │
  │     source: "instagram",                        │
  │     instagramPostId: "ABC123",                  │
  │     instagramShortcode: "DT76EU2AFgt",          │
  │     instagramUrl: "https://instagram.com/p/...",│
  │     socialPostCaption: "{caption text}",        │
  │     socialPostMediaUrl: "{first image/video}",  │
  │     socialPostMediaType: "image",               │
  │     socialPostLikes: 4521,                      │
  │     socialPostPostedAt: "2026-01-15T...",       │
  │     rating: null (AI can set later),            │
  │     note: null (or AI-generated summary)        │
  │   }                                             │
  └─────────────────────────────────────────────────┘

STEP 4D — Create PHOTO(S) (links to Review + Place)
  ┌─────────────────────────────────────────────────┐
  │ For each media item in the post:                │
  │                                                 │
  │ INSERT into photos:                             │
  │   {                                             │
  │     userId: "{user.id}",                        │
  │     placeId: "{place.id}",                      │
  │     reviewId: "{review.id}",                    │
  │     url: "{media URL from scrape}",             │
  │     isCarousel: post.mediaCount > 1,            │
  │     carouselPosition: index                     │
  │   }                                             │
  │                                                 │
  │ Note: Media URLs from Instagram are temporary.  │
  │ You should download and re-upload to your own   │
  │ Object Storage, then store that URL instead.    │
  └─────────────────────────────────────────────────┘

STEP 4E — Create INSTAGRAM IMPORT record (tracking)
  ┌─────────────────────────────────────────────────┐
  │ INSERT into instagram_imports:                  │
  │   {                                             │
  │     instagramPostId: "ABC123",                  │
  │     instagramUrl: "https://instagram.com/p/...",│
  │     instagramShortcode: "DT76EU2AFgt",          │
  │     userId: "{user.id}",                        │
  │     placeId: "{place.id}",                      │
  │     reviewId: "{review.id}",                    │
  │     status: "completed",                        │
  │     importedBy: "{admin user id}",              │
  │     rawData: { ...full scrape response }        │
  │   }                                             │
  └─────────────────────────────────────────────────┘
```

#### Phase 5: AI Enrichment

```
STEP 5 — Call OpenAI to generate tags for the Place
  - Input to AI:
    {
      "placeName": "Carbone",
      "placeType": "italian_restaurant",
      "googleTypes": ["restaurant", "italian_restaurant", "bar"],
      "priceLevel": "PRICE_LEVEL_VERY_EXPENSIVE",
      "neighborhood": "Greenwich Village",
      "captions": [
        "The spicy rigatoni at Carbone is UNREAL...",
        "Date night done right at Carbone..."
      ]
    }
  
  - Prompt: "Based on the place info and social media captions, 
    select the most relevant tags from each category:
    - Vibe: romantic, trendy, chill, upscale, casual, lively...
    - Food Type: italian, american, mexican, japanese...
    - Occasion: date-night, brunch, group-dinner, solo-meal...
    - Features: outdoor-seating, full-bar, reservations-required...
    - Dietary: vegetarian-options, gluten-free-options...
    - Drinks: craft-cocktails, wine-list, natural-wine...
    
    Return as JSON with confidence scores 0.0-1.0"

  - AI Response:
    {
      "tags": [
        { "slug": "romantic", "category": "vibe", "confidence": 0.9 },
        { "slug": "italian", "category": "food-type", "confidence": 1.0 },
        { "slug": "date-night", "category": "occasion", "confidence": 0.95 },
        { "slug": "upscale", "category": "vibe", "confidence": 0.85 },
        { "slug": "craft-cocktails", "category": "drinks", "confidence": 0.7 },
        { "slug": "reservations-required", "category": "features", "confidence": 0.9 }
      ]
    }

STEP 5B — Create PLACE_TAG rows
  ┌─────────────────────────────────────────────────┐
  │ For each tag returned by AI:                    │
  │                                                 │
  │ INSERT into place_tags:                         │
  │   {                                             │
  │     placeId: "{place.id}",                      │
  │     tagId: "{lookup tag by slug}",              │
  │     source: "ai",                               │
  │     confidence: 0.9                             │
  │   }                                             │
  └─────────────────────────────────────────────────┘
```

#### Phase 6: Activity Feed Entry

```
STEP 6 — Create ACTIVITY record
  ┌─────────────────────────────────────────────────┐
  │ INSERT into activities:                         │
  │   {                                             │
  │     actorId: "{user.id}",                       │
  │     type: "REVIEW_CREATED",                     │
  │     placeId: "{place.id}",                      │
  │     dedupeKey: "review-{userId}-{placeId}",     │
  │     metadata: {                                 │
  │       source: "instagram",                      │
  │       instagramUrl: "..."                       │
  │     }                                           │
  │   }                                             │
  └─────────────────────────────────────────────────┘
```

### Summary: DB Row Creation Order for Each Post

```
1. Place     — Find or create from Google Places API
2. User      — Find or create from Instagram profile data
3. Review    — Create, linking User → Place, with social post data
4. Photo(s)  — Create for each media item, linking to Review + Place
5. InstagramImport — Create tracking record
6. PlaceTag(s) — Create from AI enrichment
7. Activity  — Create feed entry
```

### Estimated Output per Creator

| Metric | Estimate |
|--------|----------|
| Posts scraped | 50-100 |
| Posts with locations | 15-60 (30-60%) |
| New Places created | 10-40 (some overlap) |
| Reviews created | 15-60 |
| Photos stored | 30-150 |
| Tags generated | 5-8 per place |

### Cost Estimate per Creator

| Service | Cost |
|---------|------|
| Apify Instagram Scraper | ~$0.50-2.00 per profile |
| Google Places API (Text Search) | ~$0.032 per call × 30 posts = ~$1.00 |
| OpenAI (tag generation) | ~$0.01-0.05 per place |
| **Total per creator** | **~$2-4** |
| **50 creators** | **~$100-200** |

---

## Strategy 2: The "Neighborhood Crawl" (Best for Coverage)

**Concept:** Pick target cities/neighborhoods and systematically index every restaurant, cafe, and bar.

### Flow

```
INPUT: A neighborhood or area (e.g., "Greenwich Village, New York")

STEP 1 — Call Apify Google Places Crawler
  - Actor: compass/crawler-google-places
  - Input: { 
      "searchStringsArray": ["restaurants in Greenwich Village NYC"],
      "maxCrawledPlaces": 100
    }
  - Returns: Array of places with full Google data

STEP 2 — For each place:
  - Check if Place already exists in DB (by googlePlaceId)
  - If not, INSERT into places table

STEP 3 — Search Instagram for posts at that location
  - Use Apify Instagram Scraper with locationId
  - Get top 5-10 posts

STEP 4 — For each post:
  - Create/find User (poster)
  - Create Review with social post data
  - Create Photos
  - Create InstagramImport tracking record

STEP 5 — AI enrich the place
  - Generate tags from Google types + scraped captions
  - Create PlaceTag rows
```

### Pros & Cons

| Pros | Cons |
|------|------|
| Guarantees every place in an area is covered | Scraped users may be random, not curators |
| Systematic, predictable output | Higher Apify costs (many location searches) |
| Great for "discover" features | Some places may have no Instagram presence |

---

## Strategy 3: User-Submitted URLs (Best for Organic Growth)

**Concept:** Users paste an Instagram or TikTok post URL into your app. Your backend scrapes it and builds out the data.

### Flow

```
INPUT: A post URL from a user (e.g., "https://www.instagram.com/p/DT76EU2AFgt/")

STEP 1 — User submits URL via the app UI
  - Create InstagramImport record with status: "pending"

STEP 2 — Call Apify Instagram Scraper (single post mode)
  - Actor: apify/instagram-scraper
  - Input: { "directUrls": ["https://www.instagram.com/p/DT76EU2AFgt/"] }
  - Returns: Post data (caption, media, location, author)

STEP 3 — Extract location from post
  - If post has a location tag → use it directly
  - If no location tag → use OpenAI to parse the caption
    ("Just had the best pizza at L'Artusi in the West Village" → "L'Artusi, West Village, NYC")

STEP 4 — Same as Strategy 1, Steps 3-6:
  - Google Places API to resolve/create Place
  - Create/find User
  - Create Review, Photos
  - AI tag enrichment
  - Update InstagramImport to status: "completed"

STEP 5 — Notify submitting user
  - The place now appears on the map
  - Optionally auto-save the place for the submitting user
```

### TikTok Variant

Same flow but using Apify TikTok Scraper:

```
INPUT: TikTok URL (e.g., "https://www.tiktok.com/@user/video/123456")

STEP 1 — Call Apify TikTok Scraper
  - Actor: clockworks/tiktok-scraper  
  - Input: { "postURLs": ["https://www.tiktok.com/@user/video/123456"] }
  - Returns: Video data (description, author, music, stats, location if available)

STEP 2 — TikTok rarely has location tags, so rely on AI:
  - Send video description/caption to OpenAI
  - Ask: "What restaurant/place is being reviewed? What city?"
  - Use response to search Google Places API

STEP 3 — Same pipeline from there (Place → User → Review → Photos → Tags)
```

### Pros & Cons

| Pros | Cons |
|------|------|
| Cheapest (scrape on demand) | Depends on user participation |
| High intent (users submit what they care about) | Slow initial growth |
| No wasted scrapes | Requires a working app first |

---

## Strategy 4: The "Content Network" (Most Ambitious)

**Concept:** Combine all three into a continuously growing system.

### Components

1. **Admin Dashboard** — Queue up creators or neighborhoods to scrape
2. **Scheduled Jobs** — Process the queue automatically via Apify
3. **User Submissions** — Feed user-submitted URLs into the same pipeline
4. **AI Auto-Lists** — After enough data, AI generates curated lists:
   - "Best Date Night Spots in West Village"
   - "Top Brunch in Silver Lake"
   - "Hidden Gems Under $20 in Williamsburg"
5. **Cross-Referencing** — If 5+ creators post about the same place:
   - Higher confidence tags
   - "Trending" or "Popular with creators" flag
   - Auto-generate a review summary from all captions
6. **Continuous Sync** — Re-scrape creator profiles monthly to catch new posts

---

## Schema Additions Needed

To fully support all strategies, consider adding:

### TikTok Fields on User
```prisma
tiktokHandle    String?  @unique @map("tiktok_handle")
tiktokId        String?  @unique @map("tiktok_id")
isTiktokImport  Boolean  @default(false) @map("is_tiktok_import")
lastTiktokSync  DateTime? @map("last_tiktok_sync")
```

### TikTok Fields on Review
```prisma
tiktokUrl       String?  @map("tiktok_url")
tiktokPostId    String?  @unique @map("tiktok_post_id")
```

### ScrapeJob Model (for batch operations)
```prisma
model ScrapeJob {
  id              String      @id @default(dbgenerated("gen_random_uuid()"))
  type            String      // "profile_scrape", "neighborhood_crawl", "single_post"
  platform        String      // "instagram", "tiktok", "google_places"
  input           Json        // The input sent to Apify
  apifyRunId      String?     // Apify run ID for polling
  status          String      // "queued", "running", "completed", "failed"
  postsFound      Int         @default(0)
  postsImported   Int         @default(0)
  placesCreated   Int         @default(0)
  usersCreated    Int         @default(0)
  errorMessage    String?
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime    @default(now())
  triggeredBy     String      // user ID who triggered it
}
```

### AIEnrichmentLog Model (optional, for tracking)
```prisma
model AIEnrichmentLog {
  id          String   @id @default(dbgenerated("gen_random_uuid()"))
  placeId     String
  model       String   // "gpt-4o-mini"
  prompt      String   // The prompt sent
  response    Json     // The AI response
  tagsCreated Int      @default(0)
  createdAt   DateTime @default(now())
}
```

---

## Recommended Rollout Order

| Phase | Strategy | Goal |
|-------|----------|------|
| **Phase 1** | Seed List (Strategy 1) | Populate DB with 500-2000 places from 20-50 creators |
| **Phase 2** | User Submissions (Strategy 3) | Let users contribute and grow organically |
| **Phase 3** | Neighborhood Crawl (Strategy 2) | Fill coverage gaps in target cities |
| **Phase 4** | Content Network (Strategy 4) | Automate everything, AI-generated lists, trending |

---

## Technical Components to Build

1. **Apify Service** — Wrapper for calling Apify actors and polling for results
2. **Place Matching Service** — Takes a location name/coords and resolves to a Google Place ID
3. **AI Tagging Service** — Takes place info + captions, returns structured tags
4. **Ingestion Pipeline** — Orchestrates: Scrape → Match Place → Match User → Create Review → AI Enrich → Store
5. **Media Pipeline** — Downloads media from Instagram/TikTok, re-uploads to Object Storage
6. **Admin UI** — Trigger scrapes, monitor progress, review results
7. **Submission UI** — Users paste URLs, see import progress

---

## API Keys / Services Required

| Service | Purpose | Env Variable |
|---------|---------|-------------|
| Apify | Web scraping (Instagram, TikTok, Google Places) | `APIFY_API_TOKEN` |
| Google Places API | Place search and details | `GOOGLE_MAPS_API_KEY` (already have) |
| OpenAI | AI tagging and caption analysis | Already configured |
| Replit Object Storage | Store downloaded media | Already configured |
