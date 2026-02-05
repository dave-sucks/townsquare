-- ========================================
-- NYC BURGERS - COMPLETE SEED DATA
-- ========================================
-- FULL VERSION - NO OMISSIONS
-- ========================================

BEGIN;

-- ========================================
-- 1. USERS
-- ========================================

INSERT INTO users (id, email, username, "firstName", "lastName", "profileImageUrl", bio, "instagramHandle", "isVerified", location, website, "createdAt") VALUES
('user-dave', 'dave@lev.ai', 'dave', 'Dave', 'Klein', NULL, 'PM at Lev. Burger enthusiast.', NULL, false, 'New York, NY', 'https://lev.ai', '2026-01-01T10:00:00Z'),
('user-sistersnacking', 'sistersnacking@gmail.com', 'sistersnacking', 'Sister', 'Snacking', 'https://instagram.com/sistersnacking.jpg', '4 sisters 4 snacking • Forbes 30 Under 30', 'sistersnacking', true, 'New York, NY', 'https://sistersnackingllc.com', '2015-06-15T10:00:00Z'),
('user-hungryskipper', 'fletcher@thehungryskipper.com', 'thehungryskipper', 'Fletcher', 'S', 'https://instagram.com/thehungryskipper.jpg', 'NYC Foodie Lifestyle', 'thehungryskipper', false, 'New York, NY', NULL, '2018-03-20T10:00:00Z'),
('user-immaeatthis', 'ian@immaeatthis.com', 'immaeatthis', 'Ian', 'Martin', 'https://instagram.com/immaeatthis.jpg', 'Finding the most fun food in NYC!', 'imma_eat_this', true, 'New York, NY', NULL, '2017-05-10T10:00:00Z'),
('user-devourpower', 'inquiries@devour.media', 'devourpower', 'Greg & Rebecca', 'Remmey', 'https://instagram.com/devourpower.jpg', 'Quit our jobs to DEVOUR!', 'devourpower', true, 'Brooklyn, NY', 'https://devour.media', '2012-08-01T10:00:00Z'),
('user-jacksdining', 'jack@jacksdiningroom.com', 'jacksdiningroom', 'Jack', 'D', 'https://instagram.com/jacksdiningroom.jpg', 'NYC food enthusiast', 'jacksdiningroom', false, 'New York, NY', NULL, '2019-01-15T10:00:00Z'),
('user-brotherlyburgers', 'contact@brotherlyburgers.com', 'brotherlyburgers', 'Brotherly', 'Burgers', 'https://instagram.com/brotherlyburgers.jpg', 'Two brothers rating NYC burgers', 'brotherlyburgers', false, 'New York, NY', NULL, '2020-07-01T10:00:00Z');

-- ========================================
-- 2. TAG CATEGORIES
-- ========================================

INSERT INTO tag_categories (id, slug, "displayName", description, "searchWeight", "sortOrder", "iconName") VALUES
('tagcat-vibe', 'vibe', 'Vibe', 'Atmosphere and feel', 1.0, 1, 'Sparkles'),
('tagcat-bestfor', 'best-for', 'Best For', 'Ideal occasions', 1.2, 2, 'Users'),
('tagcat-cuisine', 'cuisine', 'Cuisine', 'Food type', 1.5, 3, 'UtensilsCrossed'),
('tagcat-dietary', 'dietary', 'Dietary', 'Dietary options', 0.8, 4, 'Apple'),
('tagcat-features', 'features', 'Features', 'Amenities', 0.9, 5, 'ListChecks');

-- ========================================
-- 3. TAGS
-- ========================================

INSERT INTO tags (id, "categoryId", slug, "displayName", description, "iconName", "sortOrder") VALUES
-- Vibe tags
('tag-vibe-casual', 'tagcat-vibe', 'casual', 'Casual', 'Relaxed atmosphere', 'Coffee', 1),
('tag-vibe-upscale', 'tagcat-vibe', 'upscale', 'Upscale', 'Sophisticated setting', 'Crown', 2),
('tag-vibe-divebar', 'tagcat-vibe', 'dive-bar', 'Dive Bar', 'Classic bar vibe', 'Beer', 3),
('tag-vibe-trendy', 'tagcat-vibe', 'trendy', 'Trendy', 'Hip and modern', 'TrendingUp', 4),
('tag-vibe-hidden', 'tagcat-vibe', 'hidden-gem', 'Hidden Gem', 'Off the beaten path', 'MapPin', 5),
('tag-vibe-classic', 'tagcat-vibe', 'classic', 'Classic', 'Timeless charm', 'Clock', 6),
('tag-vibe-neighborhood', 'tagcat-vibe', 'neighborhood-spot', 'Neighborhood Spot', 'Local favorite', 'Home', 7),
-- Best For tags
('tag-bestfor-datenight', 'tagcat-bestfor', 'date-night', 'Date Night', 'Romantic occasions', 'Heart', 1),
('tag-bestfor-group', 'tagcat-bestfor', 'group-dinner', 'Group Dinner', 'Great for groups', 'Users', 2),
('tag-bestfor-solo', 'tagcat-bestfor', 'solo-dining', 'Solo Dining', 'Comfortable alone', 'User', 3),
('tag-bestfor-quick', 'tagcat-bestfor', 'quick-bite', 'Quick Bite', 'Fast service', 'Clock3', 4),
('tag-bestfor-late', 'tagcat-bestfor', 'late-night', 'Late Night', 'Open late', 'Moon', 5),
('tag-bestfor-lunch', 'tagcat-bestfor', 'lunch', 'Lunch', 'Lunch spot', 'Sun', 6),
('tag-bestfor-celebration', 'tagcat-bestfor', 'celebration', 'Celebration', 'Special occasions', 'PartyPopper', 7),
-- Cuisine tags
('tag-cuisine-burger', 'tagcat-cuisine', 'burger', 'Burger', 'Burgers', 'Beef', 1),
('tag-cuisine-american', 'tagcat-cuisine', 'american', 'American', 'American cuisine', 'Flag', 2),
('tag-cuisine-steakhouse', 'tagcat-cuisine', 'steakhouse', 'Steakhouse', 'Steaks', 'Beef', 3),
('tag-cuisine-fastfood', 'tagcat-cuisine', 'fast-food', 'Fast Food', 'Quick service', 'Zap', 4),
('tag-cuisine-organic', 'tagcat-cuisine', 'organic', 'Organic', 'Organic ingredients', 'Leaf', 5),
('tag-cuisine-italian', 'tagcat-cuisine', 'italian', 'Italian', 'Italian cuisine', 'Pizza', 6),
('tag-cuisine-pizza', 'tagcat-cuisine', 'pizza', 'Pizza', 'Pizza', 'Pizza', 7),
('tag-cuisine-deli', 'tagcat-cuisine', 'deli', 'Deli', 'Deli', 'Sandwich', 8),
('tag-cuisine-bakery', 'tagcat-cuisine', 'bakery', 'Bakery', 'Baked goods', 'Cake', 9),
-- Dietary tags
('tag-dietary-veg', 'tagcat-dietary', 'vegetarian-options', 'Vegetarian Options', 'Has veggie choices', 'Salad', 1),
('tag-dietary-gf', 'tagcat-dietary', 'gluten-free', 'Gluten Free', 'GF available', 'WheatOff', 2),
('tag-dietary-healthy', 'tagcat-dietary', 'healthy-options', 'Healthy Options', 'Health-conscious', 'Apple', 3),
-- Features tags
('tag-feat-outdoor', 'tagcat-features', 'outdoor-seating', 'Outdoor Seating', 'Has outdoor area', 'TreePine', 1),
('tag-feat-cash', 'tagcat-features', 'cash-only', 'Cash Only', 'No cards', 'Banknote', 2),
('tag-feat-bar', 'tagcat-features', 'bar', 'Bar', 'Has bar', 'Wine', 3),
('tag-feat-fullbar', 'tagcat-features', 'full-bar', 'Full Bar', 'Full cocktails', 'Martini', 4),
('tag-feat-reservations', 'tagcat-features', 'reservations-required', 'Reservations Required', 'Book ahead', 'CalendarCheck', 5),
('tag-feat-walkin', 'tagcat-features', 'walk-in-only', 'Walk-in Only', 'No reservations', 'DoorOpen', 6),
('tag-feat-instagram', 'tagcat-features', 'instagram-worthy', 'Instagram Worthy', 'Great for photos', 'Camera', 7),
('tag-feat-affordable', 'tagcat-features', 'affordable', 'Affordable', 'Budget-friendly', 'DollarSign', 8),
('tag-feat-expensive', 'tagcat-features', 'expensive', 'Expensive', 'High-end pricing', 'Gem', 9);

-- ========================================
-- 4. PLACES (Burger places only for now)
-- ========================================

INSERT INTO places (id, "googlePlaceId", name, "formattedAddress", neighborhood, locality, lat, lng, "primaryType", types, "priceLevel") VALUES
('place-minetta', 'ChIJW3Y_yGNZwokRiCPDpRE2Wkw', 'Minetta Tavern', '113 MacDougal St, New York, NY 10012', 'Greenwich Village', 'New York', 40.7301, -74.0012, 'restaurant', ARRAY['restaurant','steakhouse'], 'PRICE_LEVEL_VERY_EXPENSIVE'),
('place-emily', 'ChIJN5X_gGFZwokRdAhpW_dEzwQ', 'Emily', '35 Downing St, New York, NY 10014', 'West Village', 'New York', 40.7300, -74.0028, 'restaurant', ARRAY['restaurant','pizza'], 'PRICE_LEVEL_MODERATE'),
('place-4charles', 'ChIJN5X_gGFZwokRdAhpW_dEzwR', '4 Charles Prime Rib', '4 Charles St, New York, NY 10014', 'West Village', 'New York', 40.7353, -74.0008, 'restaurant', ARRAY['restaurant','steakhouse'], 'PRICE_LEVEL_VERY_EXPENSIVE'),
('place-cornerbistro', 'ChIJYQvgGWFZwokRjt4dGIEOxcU', 'Corner Bistro', '331 W 4th St, New York, NY 10014', 'West Village', 'New York', 40.7356, -74.0024, 'restaurant', ARRAY['restaurant','bar'], 'PRICE_LEVEL_INEXPENSIVE'),
('place-jgmelon', 'ChIJL_P_bGBZwokRFb0KZKtGbww', 'J.G. Melon', '1291 3rd Ave, New York, NY 10021', 'Upper East Side', 'New York', 40.7741, -73.9581, 'restaurant', ARRAY['restaurant','bar'], 'PRICE_LEVEL_INEXPENSIVE'),
('place-shakeshack', 'ChIJ3Y4NzzVawokRKXQEVO5JzH8', 'Shake Shack', 'Madison Square Park, New York, NY 10010', 'Flatiron', 'New York', 40.7414, -73.9882, 'restaurant', ARRAY['restaurant','fast_food'], 'PRICE_LEVEL_INEXPENSIVE'),
('place-blacklabel', 'ChIJ3Y4NzzVawokRKXQEVO5JzH9', 'Black Label Burger', '23-01 31st Ave, Queens, NY 11102', 'Astoria', 'New York', 40.7684, -73.9199, 'restaurant', ARRAY['restaurant','burger'], 'PRICE_LEVEL_MODERATE'),
('place-7thstreet', 'ChIJ3Y4NzzVawokRKXQEVO5JzH1', '7th Street Burger', '91 E 7th St, New York, NY 10009', 'East Village', 'New York', 40.7265, -73.9844, 'restaurant', ARRAY['restaurant','burger'], 'PRICE_LEVEL_INEXPENSIVE'),
('place-burgerjoint', 'ChIJ3Y4NzzVawokRKXQEVO5JzH3', 'Burger Joint', '119 W 56th St, New York, NY 10019', 'Midtown', 'New York', 40.7646, -73.9779, 'restaurant', ARRAY['restaurant','burger'], 'PRICE_LEVEL_INEXPENSIVE'),
('place-bareburger', 'ChIJ3Y4NzzVawokRKXQEVO5JzH2', 'Bareburger', '153 2nd Ave, New York, NY 10003', 'East Village', 'New York', 40.7294, -73.9865, 'restaurant', ARRAY['restaurant','burger'], 'PRICE_LEVEL_MODERATE'),
('place-bonnies', 'ChIJ3Y4NzzVawokRKXQEVO5JzH4', 'Bonnie''s', '398 Manhattan Ave, Brooklyn, NY 11211', 'Williamsburg', 'New York', 40.7205, -73.9562, 'restaurant', ARRAY['restaurant','burger'], 'PRICE_LEVEL_MODERATE'),
('place-harlemshake', 'ChIJ3Y4NzzVawokRKXQEVO5JzH5', 'Harlem Shake', '100 W 124th St, New York, NY 10027', 'Harlem', 'New York', 40.8057, -73.9451, 'restaurant', ARRAY['restaurant','burger'], 'PRICE_LEVEL_INEXPENSIVE'),
('place-meatballshop', 'ChIJ3Y4NzzVawokRKXQEVO5JzH6', 'The Meatball Shop', '84 Stanton St, New York, NY 10002', 'Lower East Side', 'New York', 40.7218, -73.9884, 'restaurant', ARRAY['restaurant','italian'], 'PRICE_LEVEL_MODERATE'),
('place-paulsda', 'ChIJ3Y4NzzVawokRKXQEVO5JzH7', 'Paul''s Da Burger Joint', '131 2nd Ave, New York, NY 10003', 'East Village', 'New York', 40.7298, -73.9864, 'restaurant', ARRAY['restaurant','burger'], 'PRICE_LEVEL_INEXPENSIVE'),
('place-luckys', 'ChIJ3Y4NzzVawokRKXQEVO5JzH8', 'Lucky''s Famous Burgers', '246 Driggs Ave, Brooklyn, NY 11222', 'Williamsburg', 'New York', 40.7200, -73.9527, 'restaurant', ARRAY['restaurant','burger'], 'PRICE_LEVEL_INEXPENSIVE');

-- ========================================
-- 5. PLACE TAGS
-- ========================================

INSERT INTO place_tags (id, "placeId", "tagId", source, "createdAt") VALUES
-- Minetta Tavern
('pt-minetta-1', 'place-minetta', 'tag-vibe-upscale', 'manual', NOW()),
('pt-minetta-2', 'place-minetta', 'tag-bestfor-datenight', 'manual', NOW()),
('pt-minetta-3', 'place-minetta', 'tag-bestfor-celebration', 'manual', NOW()),
('pt-minetta-4', 'place-minetta', 'tag-cuisine-burger', 'manual', NOW()),
('pt-minetta-5', 'place-minetta', 'tag-cuisine-steakhouse', 'manual', NOW()),
('pt-minetta-6', 'place-minetta', 'tag-feat-reservations', 'manual', NOW()),
('pt-minetta-7', 'place-minetta', 'tag-feat-expensive', 'manual', NOW()),
-- Emily
('pt-emily-1', 'place-emily', 'tag-vibe-casual', 'manual', NOW()),
('pt-emily-2', 'place-emily', 'tag-bestfor-datenight', 'manual', NOW()),
('pt-emily-3', 'place-emily', 'tag-cuisine-burger', 'manual', NOW()),
('pt-emily-4', 'place-emily', 'tag-cuisine-american', 'manual', NOW()),
('pt-emily-5', 'place-emily', 'tag-feat-reservations', 'manual', NOW()),
('pt-emily-6', 'place-emily', 'tag-feat-instagram', 'manual', NOW()),
-- 4 Charles
('pt-4charles-1', 'place-4charles', 'tag-vibe-upscale', 'manual', NOW()),
('pt-4charles-2', 'place-4charles', 'tag-bestfor-celebration', 'manual', NOW()),
('pt-4charles-3', 'place-4charles', 'tag-bestfor-datenight', 'manual', NOW()),
('pt-4charles-4', 'place-4charles', 'tag-cuisine-burger', 'manual', NOW()),
('pt-4charles-5', 'place-4charles', 'tag-cuisine-steakhouse', 'manual', NOW()),
('pt-4charles-6', 'place-4charles', 'tag-feat-expensive', 'manual', NOW()),
('pt-4charles-7', 'place-4charles', 'tag-feat-reservations', 'manual', NOW()),
-- Corner Bistro
('pt-corner-1', 'place-cornerbistro', 'tag-vibe-divebar', 'manual', NOW()),
('pt-corner-2', 'place-cornerbistro', 'tag-vibe-casual', 'manual', NOW()),
('pt-corner-3', 'place-cornerbistro', 'tag-bestfor-quick', 'manual', NOW()),
('pt-corner-4', 'place-cornerbistro', 'tag-cuisine-burger', 'manual', NOW()),
('pt-corner-5', 'place-cornerbistro', 'tag-cuisine-american', 'manual', NOW()),
('pt-corner-6', 'place-cornerbistro', 'tag-feat-cash', 'manual', NOW()),
('pt-corner-7', 'place-cornerbistro', 'tag-feat-affordable', 'manual', NOW()),
-- J.G. Melon
('pt-jgmelon-1', 'place-jgmelon', 'tag-vibe-classic', 'manual', NOW()),
('pt-jgmelon-2', 'place-jgmelon', 'tag-vibe-neighborhood', 'manual', NOW()),
('pt-jgmelon-3', 'place-jgmelon', 'tag-bestfor-lunch', 'manual', NOW()),
('pt-jgmelon-4', 'place-jgmelon', 'tag-cuisine-burger', 'manual', NOW()),
('pt-jgmelon-5', 'place-jgmelon', 'tag-cuisine-american', 'manual', NOW()),
('pt-jgmelon-6', 'place-jgmelon', 'tag-feat-cash', 'manual', NOW()),
-- Shake Shack
('pt-shakeshack-1', 'place-shakeshack', 'tag-vibe-casual', 'manual', NOW()),
('pt-shakeshack-2', 'place-shakeshack', 'tag-bestfor-quick', 'manual', NOW()),
('pt-shakeshack-3', 'place-shakeshack', 'tag-cuisine-burger', 'manual', NOW()),
('pt-shakeshack-4', 'place-shakeshack', 'tag-cuisine-fastfood', 'manual', NOW()),
('pt-shakeshack-5', 'place-shakeshack', 'tag-feat-outdoor', 'manual', NOW()),
('pt-shakeshack-6', 'place-shakeshack', 'tag-feat-affordable', 'manual', NOW()),
-- Black Label
('pt-blacklabel-1', 'place-blacklabel', 'tag-vibe-neighborhood', 'manual', NOW()),
('pt-blacklabel-2', 'place-blacklabel', 'tag-vibe-hidden', 'manual', NOW()),
('pt-blacklabel-3', 'place-blacklabel', 'tag-cuisine-burger', 'manual', NOW()),
('pt-blacklabel-4', 'place-blacklabel', 'tag-cuisine-american', 'manual', NOW()),
-- 7th Street
('pt-7thstreet-1', 'place-7thstreet', 'tag-vibe-casual', 'manual', NOW()),
('pt-7thstreet-2', 'place-7thstreet', 'tag-bestfor-quick', 'manual', NOW()),
('pt-7thstreet-3', 'place-7thstreet', 'tag-cuisine-burger', 'manual', NOW()),
('pt-7thstreet-4', 'place-7thstreet', 'tag-feat-affordable', 'manual', NOW()),
('pt-7thstreet-5', 'place-7thstreet', 'tag-feat-walkin', 'manual', NOW()),
-- Burger Joint
('pt-burgerjoint-1', 'place-burgerjoint', 'tag-vibe-hidden', 'manual', NOW()),
('pt-burgerjoint-2', 'place-burgerjoint', 'tag-vibe-casual', 'manual', NOW()),
('pt-burgerjoint-3', 'place-burgerjoint', 'tag-bestfor-quick', 'manual', NOW()),
('pt-burgerjoint-4', 'place-burgerjoint', 'tag-cuisine-burger', 'manual', NOW()),
('pt-burgerjoint-5', 'place-burgerjoint', 'tag-feat-cash', 'manual', NOW()),
('pt-burgerjoint-6', 'place-burgerjoint', 'tag-feat-affordable', 'manual', NOW()),
-- Bareburger
('pt-bareburger-1', 'place-bareburger', 'tag-vibe-casual', 'manual', NOW()),
('pt-bareburger-2', 'place-bareburger', 'tag-cuisine-burger', 'manual', NOW()),
('pt-bareburger-3', 'place-bareburger', 'tag-cuisine-organic', 'manual', NOW()),
('pt-bareburger-4', 'place-bareburger', 'tag-dietary-veg', 'manual', NOW()),
('pt-bareburger-5', 'place-bareburger', 'tag-dietary-healthy', 'manual', NOW()),
-- Bonnie's
('pt-bonnies-1', 'place-bonnies', 'tag-vibe-trendy', 'manual', NOW()),
('pt-bonnies-2', 'place-bonnies', 'tag-bestfor-group', 'manual', NOW()),
('pt-bonnies-3', 'place-bonnies', 'tag-cuisine-burger', 'manual', NOW()),
('pt-bonnies-4', 'place-bonnies', 'tag-feat-fullbar', 'manual', NOW()),
-- Harlem Shake
('pt-harlemshake-1', 'place-harlemshake', 'tag-vibe-neighborhood', 'manual', NOW()),
('pt-harlemshake-2', 'place-harlemshake', 'tag-bestfor-quick', 'manual', NOW()),
('pt-harlemshake-3', 'place-harlemshake', 'tag-cuisine-burger', 'manual', NOW()),
('pt-harlemshake-4', 'place-harlemshake', 'tag-feat-affordable', 'manual', NOW()),
-- Meatball Shop
('pt-meatballshop-1', 'place-meatballshop', 'tag-vibe-casual', 'manual', NOW()),
('pt-meatballshop-2', 'place-meatballshop', 'tag-bestfor-group', 'manual', NOW()),
('pt-meatballshop-3', 'place-meatballshop', 'tag-cuisine-burger', 'manual', NOW()),
('pt-meatballshop-4', 'place-meatballshop', 'tag-cuisine-italian', 'manual', NOW()),
('pt-meatballshop-5', 'place-meatballshop', 'tag-feat-bar', 'manual', NOW()),
-- Paul's Da Burger
('pt-paulsda-1', 'place-paulsda', 'tag-vibe-neighborhood', 'manual', NOW()),
('pt-paulsda-2', 'place-paulsda', 'tag-bestfor-solo', 'manual', NOW()),
('pt-paulsda-3', 'place-paulsda', 'tag-cuisine-burger', 'manual', NOW()),
('pt-paulsda-4', 'place-paulsda', 'tag-feat-affordable', 'manual', NOW()),
-- Lucky's
('pt-luckys-1', 'place-luckys', 'tag-vibe-neighborhood', 'manual', NOW()),
('pt-luckys-2', 'place-luckys', 'tag-bestfor-group', 'manual', NOW()),
('pt-luckys-3', 'place-luckys', 'tag-cuisine-burger', 'manual', NOW()),
('pt-luckys-4', 'place-luckys', 'tag-feat-affordable', 'manual', NOW());

-- ========================================
-- 6. LISTS
-- ========================================

INSERT INTO lists (id, "userId", name, description, visibility, "isSystem", "createdAt") VALUES
('list-dave-burgers', 'user-dave', 'NYC Burgers', 'The best burgers in NYC according to my favorite food influencers', 'PUBLIC', false, '2026-02-01T10:00:00Z');

-- ========================================
-- 7. LIST PLACES
-- ========================================

INSERT INTO list_places (id, "listId", "placeId", note, "sortOrder", "addedAt") VALUES
('lp-1', 'list-dave-burgers', 'place-minetta', 'Black Label Burger - legendary', 1, '2026-02-01T10:00:00Z'),
('lp-2', 'list-dave-burgers', 'place-emily', 'Emmy Burger - pretzel bun perfection', 2, '2026-02-01T10:00:00Z'),
('lp-3', 'list-dave-burgers', 'place-4charles', 'Wagyu burger - splurge worthy', 3, '2026-02-01T10:00:00Z'),
('lp-4', 'list-dave-burgers', 'place-cornerbistro', 'Classic dive bar burger', 4, '2026-02-01T10:00:00Z'),
('lp-5', 'list-dave-burgers', 'place-jgmelon', 'Upper East Side institution', 5, '2026-02-01T10:00:00Z'),
('lp-6', 'list-dave-burgers', 'place-shakeshack', 'Original location!', 6, '2026-02-01T10:00:00Z'),
('lp-7', 'list-dave-burgers', 'place-blacklabel', 'Dry-aged beef in Queens', 7, '2026-02-01T10:00:00Z'),
('lp-8', 'list-dave-burgers', 'place-7thstreet', 'Best smash burger', 8, '2026-02-01T10:00:00Z'),
('lp-9', 'list-dave-burgers', 'place-burgerjoint', 'Hidden behind curtain', 9, '2026-02-01T10:00:00Z'),
('lp-10', 'list-dave-burgers', 'place-bareburger', 'Organic options', 10, '2026-02-01T10:00:00Z'),
('lp-11', 'list-dave-burgers', 'place-bonnies', 'Williamsburg favorite', 11, '2026-02-01T10:00:00Z'),
('lp-12', 'list-dave-burgers', 'place-harlemshake', 'Harlem classic', 12, '2026-02-01T10:00:00Z'),
('lp-13', 'list-dave-burgers', 'place-meatballshop', 'Surprising smash burger', 13, '2026-02-01T10:00:00Z'),
('lp-14', 'list-dave-burgers', 'place-paulsda', 'Neighborhood gem', 14, '2026-02-01T10:00:00Z'),
('lp-15', 'list-dave-burgers', 'place-luckys', 'Brooklyn staple', 15, '2026-02-01T10:00:00Z');

-- ========================================
-- 8. SAVED PLACES
-- ========================================

INSERT INTO saved_places (id, "userId", "placeId", "hasBeen", rating, emoji, "visitedAt", "createdAt") VALUES
('saved-1', 'user-dave', 'place-minetta', true, 3, '🍔', '2026-01-15T19:00:00Z', '2026-01-15T20:00:00Z'),
('saved-2', 'user-dave', 'place-emily', true, 3, '🍔', '2026-01-18T18:30:00Z', '2026-01-18T19:00:00Z'),
('saved-3', 'user-dave', 'place-4charles', false, NULL, '🍔', NULL, '2026-01-20T10:00:00Z'),
('saved-4', 'user-dave', 'place-cornerbistro', true, 3, '🍔', '2026-01-10T17:00:00Z', '2026-01-10T18:00:00Z'),
('saved-5', 'user-dave', 'place-jgmelon', true, 2, '🍔', '2026-01-12T13:00:00Z', '2026-01-12T14:00:00Z'),
('saved-6', 'user-dave', 'place-shakeshack', true, 2, '🍔', '2026-01-08T12:00:00Z', '2026-01-08T13:00:00Z'),
('saved-7', 'user-dave', 'place-blacklabel', false, NULL, '🍔', NULL, '2026-01-22T10:00:00Z'),
('saved-8', 'user-dave', 'place-7thstreet', true, 3, '🍔', '2026-01-25T13:00:00Z', '2026-01-25T14:00:00Z'),
('saved-9', 'user-dave', 'place-burgerjoint', true, 2, '🍔', '2026-01-11T14:00:00Z', '2026-01-11T15:00:00Z'),
('saved-10', 'user-dave', 'place-bareburger', true, 2, '🍔', '2026-01-14T12:00:00Z', '2026-01-14T13:00:00Z'),
('saved-11', 'user-dave', 'place-bonnies', false, NULL, '🍔', NULL, '2026-01-28T10:00:00Z'),
('saved-12', 'user-dave', 'place-harlemshake', false, NULL, '🍔', NULL, '2026-01-28T10:00:00Z'),
('saved-13', 'user-dave', 'place-meatballshop', false, NULL, '🍔', NULL, '2026-01-28T10:00:00Z'),
('saved-14', 'user-dave', 'place-paulsda', false, NULL, '🍔', NULL, '2026-01-28T10:00:00Z'),
('saved-15', 'user-dave', 'place-luckys', false, NULL, '🍔', NULL, '2026-01-28T10:00:00Z');

-- ========================================
-- 9. FOLLOWS
-- ========================================

INSERT INTO follows (id, "followerId", "followingId", "createdAt") VALUES
('follow-1', 'user-dave', 'user-sistersnacking', '2026-01-05T10:00:00Z'),
('follow-2', 'user-dave', 'user-hungryskipper', '2026-01-05T10:00:00Z'),
('follow-3', 'user-dave', 'user-immaeatthis', '2026-01-05T10:00:00Z'),
('follow-4', 'user-dave', 'user-devourpower', '2026-01-05T10:00:00Z'),
('follow-5', 'user-dave', 'user-jacksdining', '2026-01-05T10:00:00Z'),
('follow-6', 'user-dave', 'user-brotherlyburgers', '2026-01-05T10:00:00Z');

-- ========================================
-- 10. REVIEWS - ALL 20 BURGER REVIEWS
-- ========================================

INSERT INTO reviews (id, "userId", "placeId", rating, note, "visitedAt", "createdAt", "instagramUrl", source) VALUES
-- Minetta (2 reviews)
('review-minetta-1', 'user-devourpower', 'place-minetta', 10, 'The Black Label Burger at Minetta Tavern is LEGENDARY. This is not just a burger, it is a NYC institution.', '2026-01-15T20:00:00Z', '2026-01-15T21:00:00Z', 'https://www.instagram.com/p/CzwVE1Pu07r/', 'instagram'),
('review-minetta-2', 'user-brotherlyburgers', 'place-minetta', 9, 'Minetta Black Label is everything you have heard and more. The dry-aged beef makes such a difference.', '2026-01-20T19:30:00Z', '2026-01-20T20:00:00Z', 'https://www.instagram.com/p/C6M2OrjPf0u/', 'instagram'),
-- Emily (3 reviews - MOST CONSENSUS!)
('review-emily-1', 'user-sistersnacking', 'place-emily', 10, 'The Emmy Burger at Emily is PERFECTION. That pretzel bun is everything.', '2026-01-18T13:30:00Z', '2026-01-18T14:00:00Z', 'https://www.instagram.com/p/DP4c8ynEZU8/', 'instagram'),
('review-emily-2', 'user-immaeatthis', 'place-emily', 10, 'Emily Emmy Burger hits different! Pretzel bun game is crazy strong.', '2026-01-22T12:45:00Z', '2026-01-22T13:00:00Z', 'https://www.instagram.com/reel/DSK4mmekQm6/', 'instagram'),
('review-emily-3', 'user-jacksdining', 'place-emily', 9, 'The Emmy Burger is as good as everyone says. Came for the pizza, stayed for the burger.', '2026-01-24T13:00:00Z', '2026-01-24T13:30:00Z', 'https://www.instagram.com/p/DUQ7uPkkUEd/', 'instagram'),
-- 4 Charles (2 reviews)
('review-4charles-1', 'user-sistersnacking', 'place-4charles', 10, 'The $39 Double Wagyu Cheeseburger at 4 Charles is worth every penny. The meat quality is INSANE.', '2026-01-25T20:30:00Z', '2026-01-25T21:00:00Z', 'https://www.instagram.com/p/DT1DPAqkjEF/', 'instagram'),
('review-4charles-2', 'user-devourpower', 'place-4charles', 10, 'SPLURGE ALERT! 4 Charles Wagyu burger is the most luxurious burger experience in NYC.', '2026-01-27T19:00:00Z', '2026-01-27T19:30:00Z', 'https://www.instagram.com/p/DTss5odjVHP/', 'instagram'),
-- Corner Bistro (2 reviews)
('review-corner-1', 'user-brotherlyburgers', 'place-cornerbistro', 8, 'Corner Bistro equals NYC INSTITUTION. The Bistro Burger has been the same since 1961.', '2026-01-10T18:00:00Z', '2026-01-10T18:30:00Z', 'https://www.instagram.com/p/DTn8rRnkX0r/', 'instagram'),
('review-corner-2', 'user-immaeatthis', 'place-cornerbistro', 7, 'Cannot do a NYC burger list without Corner Bistro! Classic thick juicy burger with bacon.', '2026-01-28T17:45:00Z', '2026-01-28T18:00:00Z', 'https://www.instagram.com/p/DTGsRczEah3/', 'instagram'),
-- J.G. Melon (1 review)
('review-jgmelon-1', 'user-hungryskipper', 'place-jgmelon', 8, 'J.G. Melon on the UES has been crushing burgers since 1972. Classic vibes.', '2026-01-12T14:30:00Z', '2026-01-12T15:00:00Z', 'https://www.instagram.com/p/DSA7_bDEXd0/', 'instagram'),
-- Shake Shack (1 review)
('review-shakeshack-1', 'user-sistersnacking', 'place-shakeshack', 8, 'The ORIGINAL Shake Shack in Madison Square Park still hits! This location has the magic.', '2026-01-08T12:00:00Z', '2026-01-08T12:30:00Z', 'https://www.instagram.com/p/DTL5HU7kePd/', 'instagram'),
-- Black Label (1 review)
('review-blacklabel-1', 'user-devourpower', 'place-blacklabel', 9, 'Hidden gem alert! Black Label Burger in Astoria Queens is CRUSHING IT.', '2026-01-16T19:00:00Z', '2026-01-16T19:30:00Z', 'https://www.instagram.com/p/DRpQ_oVkdnm/', 'instagram'),
-- 7th Street (1 review)
('review-7thstreet-1', 'user-brotherlyburgers', 'place-7thstreet', 10, 'BEST SMASH BURGER IN NYC! 7th Street Burger does it RIGHT.', '2026-01-24T13:00:00Z', '2026-01-24T13:30:00Z', 'https://www.instagram.com/p/DFyJ0SwPSr1/', 'instagram'),
-- Burger Joint (1 review)
('review-burgerjoint-1', 'user-jacksdining', 'place-burgerjoint', 8, 'Burger Joint is literally HIDDEN behind a curtain in the Le Parker Meridien lobby!', '2026-01-11T14:45:00Z', '2026-01-11T15:00:00Z', 'https://www.instagram.com/p/DPPkKmFgDd_/', 'instagram'),
-- Bareburger (1 review)
('review-bareburger-1', 'user-hungryskipper', 'place-bareburger', 7, 'Love that Bareburger focuses on organic and sustainable ingredients.', '2026-01-14T12:30:00Z', '2026-01-14T13:00:00Z', 'https://www.instagram.com/p/DMGnUIgSfan/', 'instagram'),
-- Bonnies (1 review)
('review-bonnies-1', 'user-immaeatthis', 'place-bonnies', 9, 'Bonnies in Williamsburg is FIRE. Their smash burgers are perfectly crispy.', '2026-01-26T19:00:00Z', '2026-01-26T19:30:00Z', 'https://www.instagram.com/p/DJ2bkaQSbZw/', 'instagram'),
-- Harlem Shake (1 review)
('review-harlemshake-1', 'user-brotherlyburgers', 'place-harlemshake', 8, 'Harlem Shake bringing classic burger and shake vibes to Harlem.', '2026-01-29T13:00:00Z', '2026-01-29T13:30:00Z', 'https://www.instagram.com/p/DJsKKdhSUpV/', 'instagram'),
-- Meatball Shop (1 review)
('review-meatballshop-1', 'user-devourpower', 'place-meatballshop', 8, 'Yes it is called Meatball Shop but their SMASH BURGER is lowkey amazing!', '2026-01-30T18:00:00Z', '2026-01-30T18:30:00Z', 'https://www.instagram.com/p/DGMO0DjSkLj/', 'instagram'),
-- Pauls Da Burger (1 review)
('review-paulsda-1', 'user-jacksdining', 'place-paulsda', 7, 'Pauls is a solid neighborhood burger spot in the East Village.', '2026-01-31T13:00:00Z', '2026-01-31T13:30:00Z', 'https://www.instagram.com/p/DD8Dl2SSuiV/', 'instagram'),
-- Luckys (1 review)
('review-luckys-1', 'user-sistersnacking', 'place-luckys', 8, 'Luckys Famous Burgers in Williamsburg is a Brooklyn staple!', '2026-02-01T19:00:00Z', '2026-02-01T19:30:00Z', 'https://www.instagram.com/p/C1HjQp2uGL8/', 'instagram');

-- ========================================
-- 11. ACTIVITIES
-- ========================================

INSERT INTO activities (id, "actorId", type, "placeId", "listId", "dedupeKey", metadata, "createdAt") VALUES
('activity-1', 'user-sistersnacking', 'REVIEW_CREATED', 'place-emily', NULL, 'review-user-sistersnacking-place-emily', '{"rating": 10}', '2026-01-18T14:00:00Z'),
('activity-2', 'user-devourpower', 'REVIEW_CREATED', 'place-minetta', NULL, 'review-user-devourpower-place-minetta', '{"rating": 10}', '2026-01-15T21:00:00Z'),
('activity-3', 'user-brotherlyburgers', 'REVIEW_CREATED', 'place-7thstreet', NULL, 'review-user-brotherlyburgers-place-7thstreet', '{"rating": 10}', '2026-01-24T13:30:00Z'),
('activity-4', 'user-dave', 'LIST_CREATED', NULL, 'list-dave-burgers', 'list-create-list-dave-burgers', '{"listName": "NYC Burgers"}', '2026-02-01T10:00:00Z');

COMMIT;

-- ========================================
-- SEED DATA COMPLETE
-- ========================================
-- 7 users (Dave + 6 influencers)
-- 5 tag categories
-- 35 tags
-- 15 burger places (all tagged)
-- 15 list places
-- 15 saved places
-- 6 follows
-- 20 reviews with Instagram URLs
-- 4 activities
-- ========================================
