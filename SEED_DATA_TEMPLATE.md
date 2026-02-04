# Beli Seed Data Template

Generate SQL INSERT statements for the following tables. The goal is to create 3-5 realistic public user profiles with saved places, lists, and reviews that include social media post embeds.

## Important Notes

1. **Preserve this user** (do NOT delete): 
   - ID: `4d9d69ba-db2c-48dc-8be5-1fe6d1107fa1`

2. **Use real Google Place IDs** - You can search for real places and use their actual Google Place IDs, or use these existing ones:
   - `ChIJaXQRs6lZwokRY6EFpJnhNNE` - Empire State Building
   - `ChIJ4zGFAZpYwokRGUGph3Mf37k` - Central Park
   - `ChIJYzdjboRZwokR-WVAArYMQmk` - Fools Gold NYC
   - `ChIJ2VlVN2BZwokR59MK62zKjEk` - Lucky Dog
   - `ChIJnReZJQBZwokRRwOUbuV7JzE` - Wildflower
   - `ChIJ0Wi7_bZZwokRKJfU2xVoxLQ` - Ovest Pizzoteca

3. **Generate UUIDs** using this format: `'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'` where x is any hex digit and y is 8, 9, a, or b.

---

## Schema Reference

### Users Table
```sql
INSERT INTO users (id, username, email, first_name, last_name, profile_image_url, bio, instagram_handle, is_verified, location)
VALUES (
  'uuid-here',
  'username',
  'email@example.com',
  'First',
  'Last',
  'https://example.com/photo.jpg',  -- profile picture URL
  'Bio text here',
  'instagram_handle',  -- without @
  false,
  'New York, NY'
);
```

### Places Table
```sql
INSERT INTO places (id, google_place_id, name, formatted_address, neighborhood, locality, lat, lng, primary_type, photo_refs)
VALUES (
  'uuid-here',
  'ChIJ...',  -- real Google Place ID
  'Place Name',
  '123 Main St, New York, NY 10001',
  'West Village',  -- neighborhood
  'New York',  -- city
  40.7128,  -- latitude
  -74.0060,  -- longitude
  'restaurant',  -- or bar, cafe, park, etc.
  '["photo_ref_1", "photo_ref_2"]'::jsonb  -- can be null
);
```

### Saved Places Table
```sql
INSERT INTO saved_places (id, user_id, place_id, has_been, rating, emoji, created_at)
VALUES (
  'uuid-here',
  'user-uuid',
  'place-uuid',
  true,  -- has been there
  3,  -- rating: 1=bad(red), 2=okay(yellow), 3=great(green)
  '🍕',  -- emoji for map marker
  NOW()
);
```

### Lists Table
```sql
INSERT INTO lists (id, user_id, name, description, visibility, is_system)
VALUES (
  'uuid-here',
  'user-uuid',
  'My Favorite Spots',
  'Places I love in NYC',
  'PUBLIC',  -- or 'PRIVATE'
  false
);
```

### List Places Table
```sql
INSERT INTO list_places (id, list_id, place_id, note, sort_order)
VALUES (
  'uuid-here',
  'list-uuid',
  'place-uuid',
  'Great cocktails here!',  -- optional note
  1  -- order in list
);
```

### Follows Table
```sql
INSERT INTO follows (id, follower_id, following_id)
VALUES (
  'uuid-here',
  'follower-user-uuid',
  'following-user-uuid'
);
```

### Reviews Table (with Social Post Data)

This is the key table for social embeds. When a review includes Instagram/TikTok content:

```sql
INSERT INTO reviews (
  id, user_id, place_id, rating, note, 
  source, instagram_url,
  social_post_author, social_post_author_image, 
  social_post_caption, social_post_media_url, 
  social_post_media_type, social_post_likes, social_post_posted_at,
  created_at
)
VALUES (
  'uuid-here',
  'user-uuid',
  'place-uuid',
  3,  -- 1=bad, 2=okay, 3=great
  'My personal note about this place',
  'instagram',  -- 'instagram', 'tiktok', or 'manual'
  'https://www.instagram.com/p/ABC123/',  -- original post URL
  
  -- Social Post Content (for rendering preview)
  '@foodie_account',  -- author username
  'https://example.com/profile-pic.jpg',  -- author profile image
  'Amazing pizza at this spot! The crust is perfectly crispy and the toppings are fresh. Highly recommend the margherita.',  -- caption
  'https://example.com/post-image.jpg',  -- the actual media (image/video URL)
  'image',  -- 'image', 'video', or 'carousel'
  1234,  -- number of likes
  '2024-01-15 18:30:00',  -- when the social post was made
  
  NOW()
);
```

### Activities Table

For each review, saved place, or list action, create an activity:

```sql
INSERT INTO activities (id, actor_id, type, place_id, list_id, metadata, dedupe_key, created_at)
VALUES (
  'uuid-here',
  'user-uuid',
  'REVIEW_CREATED',  -- or 'PLACE_SAVED', 'PLACE_MARKED_BEEN', 'PLACE_ADDED_TO_LIST', 'LIST_CREATED'
  'place-uuid',
  NULL,  -- list_id only for list-related activities
  '{"placeName": "Place Name", "rating": 3}'::jsonb,
  'unique-key-user-place-action',  -- must be unique
  NOW()
);
```

---

## What to Create

### 3-5 User Profiles
Create realistic food/travel influencer profiles:
- Usernames like `@nycfoodie`, `@brooklyn_eats`, `@manhattan_bites`
- Real-looking profile images (use placeholder services like `https://i.pravatar.cc/150?u=username`)
- Bios mentioning food exploration, city life, etc.

### 5-10 Places per User
- Use real NYC restaurants/bars/cafes
- Include a variety: upscale restaurants, casual spots, coffee shops, bars
- Add emojis that match the place type

### 2-3 Lists per User
- Examples: "Date Night Spots", "Best Coffee in Brooklyn", "Late Night Eats"
- Make them PUBLIC so they're visible

### Reviews with Social Posts
For each user, create 2-3 reviews that include:
- Instagram-style post data (author, caption, image URL, likes)
- Use real-looking image URLs (can use Unsplash food images)
- Write authentic-sounding captions with emojis

---

## Example Social Post Images

For `social_post_media_url`, you can use Unsplash source URLs like:
- `https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800` (pizza)
- `https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=800` (burger)
- `https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800` (pancakes)
- `https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800` (food spread)
- `https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800` (plated dish)

For profile images:
- `https://i.pravatar.cc/150?u=nycfoodie`
- `https://i.pravatar.cc/150?u=brooklyn_eats`

---

## Output Format

Please output all SQL statements in order:
1. Users
2. Places
3. Saved Places
4. Lists
5. List Places
6. Follows (make some users follow each other)
7. Reviews (with social post data)
8. Activities

Wrap everything in a transaction:
```sql
BEGIN;
-- All INSERT statements here
COMMIT;
```
