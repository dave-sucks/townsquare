# Beli Clone - Complete Seed Data Schema

Use this document to generate seed data for the Beli clone application. All IDs should be deterministic strings (e.g., "user-1", "place-1") for easier reference.

---

## Enums

```typescript
// List visibility
type list_visibility = "PRIVATE" | "PUBLIC";

// Activity types (for feed)
type activity_type = 
  | "PLACE_SAVED"           // User saved a place
  | "PLACE_MARKED_BEEN"     // User marked a place as visited
  | "PLACE_ADDED_TO_LIST"   // User added a place to a list
  | "LIST_CREATED"          // User created a new list
  | "REVIEW_CREATED";       // User wrote a review

// Review source
type review_source = "manual" | "instagram" | "tiktok";
```

---

## 1. Users

```typescript
{
  id: string,                    // e.g., "user-1"
  email: string | null,          // e.g., "eitan@example.com"
  username: string | null,       // e.g., "eitan" (unique, used in URLs)
  firstName: string | null,      // e.g., "Eitan"
  lastName: string | null,       // e.g., "Bernath"
  profileImageUrl: string | null, // URL to profile photo
  bio: string | null,            // Short bio text
  instagramHandle: string | null, // e.g., "eitan" (without @)
  isVerified: boolean,           // Blue checkmark (default: false)
  location: string | null,       // e.g., "New York, NY"
  website: string | null,        // e.g., "https://example.com"
  createdAt: DateTime,           // ISO timestamp
}
```

**Example:**
```json
{
  "id": "user-1",
  "email": "eitan@example.com",
  "username": "eitan",
  "firstName": "Eitan",
  "lastName": "Bernath",
  "profileImageUrl": "https://example.com/eitan.jpg",
  "bio": "Food content creator. Host of Eitan Eats.",
  "instagramHandle": "eitan",
  "isVerified": true,
  "location": "New York, NY",
  "website": "https://eitanbernath.com"
}
```

---

## 2. Places

Places are restaurants, bars, cafes, etc. They mirror Google Places data.

```typescript
{
  id: string,                    // e.g., "place-1"
  googlePlaceId: string,         // REQUIRED: Real Google Place ID (e.g., "ChIJ...")
  name: string,                  // e.g., "Carbone"
  formattedAddress: string,      // e.g., "181 Thompson St, New York, NY 10012"
  neighborhood: string | null,   // e.g., "Greenwich Village"
  locality: string | null,       // e.g., "New York"
  lat: number,                   // Latitude (e.g., 40.7291)
  lng: number,                   // Longitude (e.g., -74.0007)
  primaryType: string | null,    // e.g., "italian_restaurant"
  types: string[] | null,        // e.g., ["restaurant", "bar", "food"]
  priceLevel: string | null,     // "PRICE_LEVEL_INEXPENSIVE" to "PRICE_LEVEL_VERY_EXPENSIVE"
  photoRefs: string[] | null,    // Google photo references (optional)
}
```

**Example:**
```json
{
  "id": "place-1",
  "googlePlaceId": "ChIJE9LNqsxZwokR1K8jnpN2pT0",
  "name": "Carbone",
  "formattedAddress": "181 Thompson St, New York, NY 10012",
  "neighborhood": "Greenwich Village",
  "locality": "New York",
  "lat": 40.7291,
  "lng": -74.0007,
  "primaryType": "italian_restaurant",
  "types": ["restaurant", "italian_restaurant", "bar"],
  "priceLevel": "PRICE_LEVEL_VERY_EXPENSIVE"
}
```

---

## 3. Saved Places

Junction table linking users to places they've saved.

```typescript
{
  id: string,                    // e.g., "saved-1"
  userId: string,                // References User.id
  placeId: string,               // References Place.id
  hasBeen: boolean | null,       // Has user visited? (default: false)
  rating: number | null,         // 1 = bad (red), 2 = okay (yellow), 3 = great (green)
  emoji: string | null,          // Custom emoji marker (e.g., "🍝")
  visitedAt: DateTime | null,    // When they visited
  createdAt: DateTime,           // When they saved it
}
```

**Rating System:**
- `rating: 1` = Bad (red circle)
- `rating: 2` = Okay (yellow circle)
- `rating: 3` = Great (green circle)

**Example:**
```json
{
  "id": "saved-1",
  "userId": "user-1",
  "placeId": "place-1",
  "hasBeen": true,
  "rating": 3,
  "emoji": "🍝",
  "visitedAt": "2026-01-15T19:00:00Z"
}
```

---

## 4. Lists

User-created collections of places.

```typescript
{
  id: string,                    // e.g., "list-1"
  userId: string,                // References User.id (owner)
  name: string,                  // e.g., "NYC Favorites"
  description: string | null,    // e.g., "My go-to spots in Manhattan"
  visibility: "PRIVATE" | "PUBLIC",
  isSystem: boolean | null,      // System-generated list (default: false)
  systemSlug: string | null,     // e.g., "want-to-go" for system lists
  createdAt: DateTime,
}
```

**Example:**
```json
{
  "id": "list-1",
  "userId": "user-1",
  "name": "NYC Favorites",
  "description": "My go-to spots in Manhattan",
  "visibility": "PUBLIC",
  "isSystem": false
}
```

---

## 5. List Places

Junction table linking places to lists.

```typescript
{
  id: string,                    // e.g., "lp-1"
  listId: string,                // References List.id
  placeId: string,               // References Place.id
  note: string | null,           // Optional note about this place in this list
  sortOrder: number | null,      // Display order in list
  addedAt: DateTime,
}
```

**Example:**
```json
{
  "id": "lp-1",
  "listId": "list-1",
  "placeId": "place-1",
  "note": "Get the spicy rigatoni",
  "sortOrder": 1
}
```

---

## 6. Follows

Who follows whom.

```typescript
{
  id: string,                    // e.g., "follow-1"
  followerId: string,            // User who is following
  followingId: string,           // User being followed
  createdAt: DateTime,
}
```

**Example:**
```json
{
  "id": "follow-1",
  "followerId": "user-2",
  "followingId": "user-1"
}
```

---

## 7. Reviews

User reviews with optional Instagram embeds.

```typescript
{
  id: string,                    // e.g., "review-1"
  userId: string,                // References User.id
  placeId: string,               // References Place.id
  rating: number | null,         // 1-10 scale for reviews
  note: string | null,           // Review text
  visitedAt: DateTime | null,    // When they visited
  createdAt: DateTime,
  
  // Instagram embed (optional)
  instagramUrl: string | null,   // e.g., "https://www.instagram.com/p/ABC123/"
  source: "manual" | "instagram" | "tiktok",  // Default: "manual"
  
  // Optional cached social post data (for custom rendering)
  socialPostCaption: string | null,
  socialPostMediaUrl: string | null,
  socialPostMediaType: string | null,  // "image" | "video" | "carousel"
  socialPostLikes: number | null,
  socialPostPostedAt: DateTime | null,
}
```

**Example - Manual review:**
```json
{
  "id": "review-1",
  "userId": "user-1",
  "placeId": "place-1",
  "rating": 8,
  "note": "Absolutely incredible. The spicy rigatoni is a must-order.",
  "source": "manual"
}
```

**Example - Review with Instagram embed:**
```json
{
  "id": "review-2",
  "userId": "user-1",
  "placeId": "place-2",
  "rating": 9,
  "note": null,
  "instagramUrl": "https://www.instagram.com/p/DT76EU2AFgt/",
  "source": "instagram"
}
```

---

## 8. Activities (Feed)

Activity feed items. These power the home feed.

```typescript
{
  id: string,                    // e.g., "activity-1"
  actorId: string,               // References User.id (who did the action)
  type: activity_type,           // See enum above
  placeId: string | null,        // References Place.id (if applicable)
  listId: string | null,         // References List.id (if applicable)
  dedupeKey: string,             // UNIQUE key to prevent duplicates
  metadata: object | null,       // Extra data (e.g., { rating: 8, note: "..." })
  createdAt: DateTime,
}
```

**Dedupe Key Patterns:**
- `PLACE_SAVED`: `"save-{userId}-{placeId}"`
- `PLACE_MARKED_BEEN`: `"been-{userId}-{placeId}"`
- `PLACE_ADDED_TO_LIST`: `"list-add-{listId}-{placeId}"`
- `LIST_CREATED`: `"list-create-{listId}"`
- `REVIEW_CREATED`: `"review-{userId}-{placeId}"`

**Example - Review activity:**
```json
{
  "id": "activity-1",
  "actorId": "user-1",
  "type": "REVIEW_CREATED",
  "placeId": "place-1",
  "listId": null,
  "dedupeKey": "review-user-1-place-1",
  "metadata": {
    "rating": 8,
    "note": "Absolutely incredible..."
  }
}
```

**Example - Save activity:**
```json
{
  "id": "activity-2",
  "actorId": "user-2",
  "type": "PLACE_SAVED",
  "placeId": "place-1",
  "listId": null,
  "dedupeKey": "save-user-2-place-1",
  "metadata": {
    "placeName": "Carbone"
  }
}
```

---

## 9. Photos (Optional)

User-uploaded photos for places/reviews.

```typescript
{
  id: string,
  userId: string,
  placeId: string,
  reviewId: string | null,
  url: string,                   // Object storage URL
  width: number | null,
  height: number | null,
  isCarousel: boolean,           // Part of a multi-photo post
  carouselPosition: number,      // Order in carousel (0-indexed)
  createdAt: DateTime,
}
```

---

## Sample Seed Data Request

When asking Claude to generate seed data, use this prompt:

```
Generate seed data for a place-saving app with:

- 5 users (mix of foodies, travelers, locals)
- 15 places (restaurants in NYC, LA, and Miami)
- Various saved places with ratings and emojis
- 3 lists per user
- Follow relationships between users
- 10 reviews (3 with real Instagram post URLs, 7 manual)
- Activity feed entries for all actions

Use the schema from SEED_DATA_SCHEMA.md. Output as SQL INSERT statements or JSON.
```

---

## Notes

1. **Google Place IDs**: For testing, you can use fake IDs like "test-place-1" but real Google Place IDs (starting with "ChIJ") are needed for map features to work.

2. **Instagram URLs**: Use real public Instagram post URLs for embeds to work. Format: `https://www.instagram.com/p/{shortcode}/`

3. **Timestamps**: Use ISO 8601 format: `"2026-02-04T18:00:00Z"`

4. **Relationships**: Ensure referential integrity - all foreign keys must reference existing records.

5. **Activities**: Create an activity for each user action (save, review, list creation) to populate the feed.
