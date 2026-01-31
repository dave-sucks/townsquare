-- ============================================
-- SEED DATA FOR NYC FOOD INFLUENCER APP
-- Real influencers with actual restaurants
-- ============================================

-- ====================
-- USERS (Influencers)
-- ====================

INSERT INTO users (id, email, username, first_name, last_name, profile_image_url, bio, location, instagram_handle, website, is_verified, created_at) VALUES
('user-1', 'eitan@eitanbernath.com', 'eitan', 'Eitan', 'Bernath', 'https://instagram.fnyc1-1.fna.fbcdn.net/v/t51.2885-19/123456.jpg', 'Chef, Author, TV Personality & UN WFP Ambassador. Forbes 30 Under 30. Principal Culinary Contributor on The Drew Barrymore Show.', 'Manhattan, NY', 'eitan', 'https://www.eitanbernath.com', true, '2018-06-15 10:30:00'),

('user-2', 'emily@newforkcity.com', 'new_fork_city', 'Emily', 'Morse', 'https://instagram.fnyc1-1.fna.fbcdn.net/v/t51.2885-19/234567.jpg', '🍴 Sharing our Love of Food with the World. NYC food adventures with @gillypresto & @nlandsberg', 'New York, NY', 'new_fork_city', 'https://www.newforkcity.com', true, '2014-03-20 14:00:00'),

('user-3', 'sasha@foodintheair.com', 'foodintheair', 'Sasha', 'Martin', 'https://instagram.fnyc1-1.fna.fbcdn.net/v/t51.2885-19/345678.jpg', 'Do you like food? Do you like air? #foodintheair | NC bred | NYC based', 'New York, NY', 'foodintheair', null, true, '2016-09-10 09:00:00'),

('user-4', 'bryan@theinfatuation.com', 'infatuation_nyc', 'Bryan', 'Kim', 'https://instagram.fnyc1-1.fna.fbcdn.net/v/t51.2885-19/456789.jpg', 'Expert NYC Restaurant Recommendations For Every Situation. We review more restaurants than the health inspector.', 'New York, NY', 'infatuation_nyc', 'https://www.theinfatuation.com', true, '2012-07-01 11:00:00'),

('user-5', 'team@bestfoodny.com', 'bestfoodny', 'Best Food', 'NY', 'https://instagram.fnyc1-1.fna.fbcdn.net/v/t51.2885-19/567890.jpg', '😀 Food recommendations & events around NYC 👉 Tag #BestFoodNY to share your favorites', 'New York, NY', 'bestfoodny', null, true, '2015-04-12 16:00:00');


-- ====================
-- PLACES (Real NYC Restaurants)
-- ====================

INSERT INTO places (id, google_place_id, name, formatted_address, lat, lng, primary_type, types, price_level, photo_refs, created_at) VALUES
-- Greenwich Village / West Village
('place-1', 'ChIJfakeCarbone123', 'Carbone', '181 Thompson St, New York, NY 10012', 40.7295, -73.9965, 'restaurant', '["restaurant", "italian", "fine_dining"]', 'PRICE_LEVEL_VERY_EXPENSIVE', '[]', '2023-01-15 10:00:00'),

('place-2', 'ChIJfakeFourHorsemen', 'Four Horsemen', '295 Grand St, Brooklyn, NY 11211', 40.7135, -73.9566, 'bar', '["bar", "wine_bar", "restaurant"]', 'PRICE_LEVEL_EXPENSIVE', '[]', '2023-01-16 11:00:00'),

('place-3', 'ChIJfakeCrevette123', 'Crevette', '1 Hotel Brooklyn Bridge, Brooklyn, NY', 40.7041, -73.9876, 'restaurant', '["restaurant", "french", "seafood"]', 'PRICE_LEVEL_EXPENSIVE', '[]', '2025-02-10 12:00:00'),

('place-4', 'ChIJfakeTatiana456', 'Tatiana', 'Lincoln Center, New York, NY 10023', 40.7724, -73.9836, 'restaurant', '["restaurant", "american", "fine_dining"]', 'PRICE_LEVEL_EXPENSIVE', '[]', '2023-08-20 13:00:00'),

('place-5', 'ChIJfakeDogon789', 'Dōgon', '141 Orchard St, New York, NY 10002', 40.7191, -73.9879, 'restaurant', '["restaurant", "african", "contemporary"]', 'PRICE_LEVEL_EXPENSIVE', '[]', '2025-03-15 14:00:00'),

-- Bushwick / Brooklyn
('place-6', 'ChIJfakeLuckyCharlies', 'Lucky Charlie''s', 'Bushwick, Brooklyn, NY 11237', 40.7081, -73.9210, 'restaurant', '["restaurant", "pizza", "italian"]', 'PRICE_LEVEL_MODERATE', '[]', '2025-01-05 15:00:00'),

('place-7', 'ChIJfakeBanhAnhEm', 'Bánh Anh Em', '140 Orchard St, New York, NY 10002', 40.7194, -73.9877, 'restaurant', '["restaurant", "vietnamese", "sandwich_shop"]', 'PRICE_LEVEL_INEXPENSIVE', '[]', '2025-04-12 16:00:00'),

-- Midtown
('place-8', 'ChIJfakeSanti123', 'Santi', '204 E 52nd St, New York, NY 10022', 40.7571, -73.9700, 'restaurant', '["restaurant", "italian", "pasta"]', 'PRICE_LEVEL_EXPENSIVE', '[]', '2025-02-28 17:00:00'),

('place-9', 'ChIJfakeBKK456', 'BKK', 'Columbus Circle, New York, NY 10019', 40.7678, -73.9819, 'restaurant', '["restaurant", "thai", "contemporary"]', 'PRICE_LEVEL_MODERATE', '[]', '2025-03-20 18:00:00'),

('place-10', 'ChIJfakeJaba789', 'JaBä', 'Midtown, New York, NY 10036', 40.7549, -73.9840, 'restaurant', '["restaurant", "taiwanese", "contemporary"]', 'PRICE_LEVEL_MODERATE', '[]', '2025-06-10 19:00:00'),

-- Lower East Side
('place-11', 'ChIJfakeMam123', 'Mắm', '137 Orchard St, New York, NY 10002', 40.7189, -73.9880, 'restaurant', '["restaurant", "vietnamese"]', 'PRICE_LEVEL_MODERATE', '[]', '2025-01-18 20:00:00'),

('place-12', 'ChIJfakeRussAndDaughters', 'Russ & Daughters', '179 E Houston St, New York, NY 10002', 40.7223, -73.9878, 'restaurant', '["restaurant", "jewish", "deli", "bagels"]', 'PRICE_LEVEL_MODERATE', '[]', '2022-11-01 09:00:00'),

-- Upper West Side / Lincoln Center area
('place-13', 'ChIJfakeBridges123', 'Bridges', '44 W 63rd St, New York, NY 10023', 40.7713, -73.9823, 'restaurant', '["restaurant", "new_england", "seafood"]', 'PRICE_LEVEL_EXPENSIVE', '[]', '2025-05-01 21:00:00'),

-- Williamsburg
('place-14', 'ChIJfakeFandFPizzeria', 'F&F Pizzeria', 'Williamsburg, Brooklyn, NY 11211', 40.7177, -73.9573, 'restaurant', '["restaurant", "pizza", "italian"]', 'PRICE_LEVEL_MODERATE', '[]', '2020-05-15 10:00:00'),

('place-15', 'ChIJfakeFandFRestaurant', 'F&F Restaurant', 'Williamsburg, Brooklyn, NY 11211', 40.7179, -73.9571, 'restaurant', '["restaurant", "pizza", "italian", "fine_dining"]', 'PRICE_LEVEL_EXPENSIVE', '[]', '2025-03-01 11:00:00'),

-- Nolita
('place-16', 'ChIJfakeMommyPais', 'Mommy Pai''s', 'Nolita, New York, NY 10012', 40.7225, -73.9955, 'restaurant', '["restaurant", "thai", "fast_casual"]', 'PRICE_LEVEL_INEXPENSIVE', '[]', '2025-05-15 12:00:00'),

-- Chelsea
('place-17', 'ChIJfakeTeruko123', 'Teruko', 'Hotel Chelsea, 222 W 23rd St, New York, NY 10011', 40.7441, -73.9964, 'restaurant', '["restaurant", "japanese", "contemporary"]', 'PRICE_LEVEL_EXPENSIVE', '[]', '2025-06-20 13:00:00'),

-- Union Square area
('place-18', 'ChIJfakeLureFishbar', 'Lure Fishbar', '142 Mercer St, New York, NY 10012', 40.7255, -73.9991, 'restaurant', '["restaurant", "seafood", "sushi"]', 'PRICE_LEVEL_EXPENSIVE', '[]', '2019-03-10 14:00:00'),

-- Chinatown
('place-19', 'ChIJfakeChoDangGol', 'Cho Dang Gol', '55 W 35th St, New York, NY 10001', 40.7503, -73.9859, 'restaurant', '["restaurant", "korean"]', 'PRICE_LEVEL_MODERATE', '[]', '2021-07-25 15:00:00'),

('place-20', 'ChIJfakeFishCheeks', 'Fish Cheeks', '55 Bond St, New York, NY 10012', 40.7262, -73.9957, 'restaurant', '["restaurant", "thai", "seafood"]', 'PRICE_LEVEL_MODERATE', '[]', '2022-09-12 16:00:00'),

-- Additional popular spots
('place-21', 'ChIJfakeEstela123', 'Estela', '47 E Houston St, New York, NY 10012', 40.7245, -73.9950, 'restaurant', '["restaurant", "mediterranean", "contemporary"]', 'PRICE_LEVEL_EXPENSIVE', '[]', '2018-06-15 17:00:00'),

('place-22', 'ChIJfakeCoconaConsuelo', 'Cocina Consuelo', 'Williamsburg, Brooklyn, NY 11249', 40.7173, -73.9587, 'restaurant', '["restaurant", "mexican"]', 'PRICE_LEVEL_MODERATE', '[]', '2024-11-20 18:00:00'),

('place-23', 'ChIJfakeMinettaTavern', 'Minetta Tavern', '113 MacDougal St, New York, NY 10012', 40.7300, -73.9992, 'restaurant', '["restaurant", "french", "bistro", "steakhouse"]', 'PRICE_LEVEL_VERY_EXPENSIVE', '[]', '2017-04-08 19:00:00'),

('place-24', 'ChIJfakePennyNYC', 'Penny', 'Union Square, New York, NY 10003', 40.7359, -73.9911, 'restaurant', '["restaurant", "contemporary", "roman"]', 'PRICE_LEVEL_EXPENSIVE', '[]', '2024-10-05 20:00:00'),

('place-25', 'ChIJfakeClaud123', 'Claud', '3 E 1st St, New York, NY 10003', 40.7248, -73.9908, 'restaurant', '["restaurant", "french", "contemporary"]', 'PRICE_LEVEL_EXPENSIVE', '[]', '2023-05-12 21:00:00');


-- ====================
-- SAVED PLACES (User bookmarks)
-- ====================

-- Eitan Bernath's places (user-1)
INSERT INTO saved_places (id, user_id, place_id, status, visited_at, created_at) VALUES
('saved-1', 'user-1', 'place-1', 'BEEN', '2024-12-05 19:30:00', '2024-12-05 20:00:00'),
('saved-2', 'user-1', 'place-4', 'BEEN', '2025-01-10 20:00:00', '2025-01-10 21:00:00'),
('saved-3', 'user-1', 'place-5', 'BEEN', '2025-03-20 19:15:00', '2025-03-20 20:00:00'),
('saved-4', 'user-1', 'place-12', 'BEEN', '2024-11-15 11:00:00', '2024-11-15 12:00:00'),
('saved-5', 'user-1', 'place-8', 'WANT', null, '2025-06-01 10:00:00'),
('saved-6', 'user-1', 'place-9', 'BEEN', '2025-04-18 20:30:00', '2025-04-18 21:00:00'),
('saved-7', 'user-1', 'place-16', 'BEEN', '2025-05-20 13:00:00', '2025-05-20 14:00:00'),
('saved-8', 'user-1', 'place-20', 'BEEN', '2024-10-25 19:00:00', '2024-10-25 20:00:00'),
('saved-9', 'user-1', 'place-23', 'BEEN', '2024-09-12 21:00:00', '2024-09-12 22:00:00'),
('saved-10', 'user-1', 'place-17', 'WANT', null, '2025-06-25 15:00:00'),

-- New Fork City (user-2)
('saved-11', 'user-2', 'place-1', 'BEEN', '2025-01-08 20:00:00', '2025-01-08 21:00:00'),
('saved-12', 'user-2', 'place-3', 'BEEN', '2025-02-14 19:30:00', '2025-02-14 20:00:00'),
('saved-13', 'user-2', 'place-6', 'BEEN', '2025-03-10 21:00:00', '2025-03-10 22:00:00'),
('saved-14', 'user-2', 'place-7', 'BEEN', '2025-04-15 12:30:00', '2025-04-15 13:00:00'),
('saved-15', 'user-2', 'place-11', 'BEEN', '2025-01-22 19:00:00', '2025-01-22 20:00:00'),
('saved-16', 'user-2', 'place-15', 'BEEN', '2025-03-05 20:30:00', '2025-03-05 21:00:00'),
('saved-17', 'user-2', 'place-18', 'BEEN', '2024-12-20 19:00:00', '2024-12-20 20:00:00'),
('saved-18', 'user-2', 'place-21', 'BEEN', '2024-11-10 20:00:00', '2024-11-10 21:00:00'),
('saved-19', 'user-2', 'place-13', 'WANT', null, '2025-06-10 14:00:00'),
('saved-20', 'user-2', 'place-10', 'WANT', null, '2025-06-15 16:00:00'),

-- Food In The Air (user-3)
('saved-21', 'user-3', 'place-2', 'BEEN', '2024-10-15 19:30:00', '2024-10-15 20:00:00'),
('saved-22', 'user-3', 'place-4', 'BEEN', '2024-12-20 20:00:00', '2024-12-20 21:00:00'),
('saved-23', 'user-3', 'place-6', 'BEEN', '2025-02-28 21:30:00', '2025-02-28 22:00:00'),
('saved-24', 'user-3', 'place-9', 'BEEN', '2025-04-05 19:00:00', '2025-04-05 20:00:00'),
('saved-25', 'user-3', 'place-14', 'BEEN', '2024-08-10 20:00:00', '2024-08-10 21:00:00'),
('saved-26', 'user-3', 'place-16', 'BEEN', '2025-05-18 12:00:00', '2025-05-18 13:00:00'),
('saved-27', 'user-3', 'place-19', 'BEEN', '2024-11-05 19:30:00', '2024-11-05 20:00:00'),
('saved-28', 'user-3', 'place-22', 'BEEN', '2024-12-01 20:00:00', '2024-12-01 21:00:00'),
('saved-29', 'user-3', 'place-5', 'WANT', null, '2025-06-20 10:00:00'),
('saved-30', 'user-3', 'place-17', 'WANT', null, '2025-06-22 11:00:00'),

-- Infatuation NYC (user-4)
('saved-31', 'user-4', 'place-1', 'BEEN', '2024-11-20 20:00:00', '2024-11-20 21:00:00'),
('saved-32', 'user-4', 'place-3', 'BEEN', '2025-02-15 19:00:00', '2025-02-15 20:00:00'),
('saved-33', 'user-4', 'place-5', 'BEEN', '2025-03-18 20:30:00', '2025-03-18 21:00:00'),
('saved-34', 'user-4', 'place-6', 'BEEN', '2025-01-25 21:00:00', '2025-01-25 22:00:00'),
('saved-35', 'user-4', 'place-7', 'BEEN', '2025-04-20 12:00:00', '2025-04-20 13:00:00'),
('saved-36', 'user-4', 'place-8', 'BEEN', '2025-03-01 19:30:00', '2025-03-01 20:00:00'),
('saved-37', 'user-4', 'place-10', 'BEEN', '2025-06-12 20:00:00', '2025-06-12 21:00:00'),
('saved-38', 'user-4', 'place-13', 'BEEN', '2025-05-05 19:00:00', '2025-05-05 20:00:00'),
('saved-39', 'user-4', 'place-15', 'BEEN', '2025-03-08 20:30:00', '2025-03-08 21:00:00'),
('saved-40', 'user-4', 'place-20', 'BEEN', '2024-10-30 19:00:00', '2024-10-30 20:00:00'),

-- Best Food NY (user-5)
('saved-41', 'user-5', 'place-1', 'BEEN', '2024-09-10 20:00:00', '2024-09-10 21:00:00'),
('saved-42', 'user-5', 'place-12', 'BEEN', '2024-10-05 11:00:00', '2024-10-05 12:00:00'),
('saved-43', 'user-5', 'place-14', 'BEEN', '2024-11-15 20:00:00', '2024-11-15 21:00:00'),
('saved-44', 'user-5', 'place-18', 'BEEN', '2024-12-08 19:30:00', '2024-12-08 20:00:00'),
('saved-45', 'user-5', 'place-19', 'BEEN', '2025-01-12 19:00:00', '2025-01-12 20:00:00'),
('saved-46', 'user-5', 'place-21', 'BEEN', '2025-02-18 20:00:00', '2025-02-18 21:00:00'),
('saved-47', 'user-5', 'place-23', 'BEEN', '2025-03-22 21:00:00', '2025-03-22 22:00:00'),
('saved-48', 'user-5', 'place-24', 'BEEN', '2025-04-10 19:30:00', '2025-04-10 20:00:00'),
('saved-49', 'user-5', 'place-25', 'BEEN', '2025-05-14 20:00:00', '2025-05-14 21:00:00'),
('saved-50', 'user-5', 'place-8', 'WANT', null, '2025-06-18 14:00:00');


-- ====================
-- LISTS (Curated collections)
-- ====================

INSERT INTO lists (id, user_id, name, description, visibility, created_at, updated_at) VALUES
-- Eitan's lists
('list-1', 'user-1', 'Fancy Date Night', 'Perfect spots for special occasions and romantic dinners', 'PUBLIC', '2024-11-01 10:00:00', '2025-01-15 14:00:00'),
('list-2', 'user-1', 'Quick Casual Eats', 'Amazing food without the fuss', 'PUBLIC', '2024-12-05 11:00:00', '2025-05-20 15:00:00'),
('list-3', 'user-1', 'Must Try ASAP', 'Places on my radar I need to visit soon', 'PRIVATE', '2025-06-01 09:00:00', '2025-06-25 16:00:00'),

-- New Fork City's lists
('list-4', 'user-2', 'Brooklyn Gems', 'Our favorite Brooklyn spots', 'PUBLIC', '2024-10-15 12:00:00', '2025-04-15 13:00:00'),
('list-5', 'user-2', 'Instagram-Worthy', 'Dishes that photograph beautifully', 'PUBLIC', '2024-11-20 13:00:00', '2025-03-10 14:00:00'),

-- Food In The Air's lists
('list-6', 'user-3', 'Wine & Dine', 'Places with excellent wine programs', 'PUBLIC', '2024-09-01 14:00:00', '2024-10-15 15:00:00'),
('list-7', 'user-3', 'Late Night Spots', 'Open late when you need them', 'PUBLIC', '2024-11-05 15:00:00', '2025-02-28 16:00:00'),

-- Infatuation NYC's lists
('list-8', 'user-4', 'Best of 2025', 'Our highest-rated restaurants from this year', 'PUBLIC', '2025-01-01 16:00:00', '2025-06-12 17:00:00'),
('list-9', 'user-4', 'Budget Friendly', 'Great food that won''t break the bank', 'PUBLIC', '2024-08-15 17:00:00', '2025-04-20 18:00:00'),

-- Best Food NY's lists
('list-10', 'user-5', 'Classic NYC', 'Iconic New York institutions', 'PUBLIC', '2024-07-10 18:00:00', '2025-03-22 19:00:00');


-- ====================
-- LIST PLACES (List items)
-- ====================

-- Eitan's "Fancy Date Night" list
INSERT INTO list_places (id, list_id, place_id, added_at, note, sort_order) VALUES
('lp-1', 'list-1', 'place-1', '2024-11-01 10:00:00', 'The most romantic Italian spot in the city. Get the spicy rigatoni!', 1),
('lp-2', 'list-1', 'place-4', '2024-12-20 11:00:00', 'Perfect for a special celebration. The atmosphere is incredible.', 2),
('lp-3', 'list-1', 'place-23', '2025-01-15 12:00:00', 'Classic NYC bistro. Book weeks in advance.', 3),

-- Eitan's "Quick Casual Eats"
('lp-4', 'list-2', 'place-12', '2024-12-05 13:00:00', 'Best bagels and lox in the city, hands down.', 1),
('lp-5', 'list-2', 'place-16', '2025-05-20 14:00:00', 'Thai fast food done RIGHT. That Mommy Royale burger is insane.', 2),
('lp-6', 'list-2', 'place-7', '2025-04-15 15:00:00', 'Get the banh mi with all the fixings. Fresh bread all day.', 3),

-- Eitan's "Must Try ASAP"
('lp-7', 'list-3', 'place-8', '2025-06-01 16:00:00', 'Heard the truffle pasta is incredible', 1),
('lp-8', 'list-3', 'place-17', '2025-06-25 17:00:00', 'Need to check out this new Japanese spot', 2),

-- New Fork City's "Brooklyn Gems"
('lp-9', 'list-4', 'place-6', '2025-03-10 18:00:00', 'Coal oven pizza until 3am. Perfect late night spot!', 1),
('lp-10', 'list-4', 'place-3', '2025-02-14 19:00:00', 'French Riviera vibes in Brooklyn', 2),
('lp-11', 'list-4', 'place-15', '2025-03-05 20:00:00', 'The clam pie here is legendary', 3),
('lp-12', 'list-4', 'place-14', '2024-11-15 21:00:00', 'Original F&F location - still amazing', 4),

-- New Fork City's "Instagram-Worthy"
('lp-13', 'list-5', 'place-1', '2025-01-08 22:00:00', 'The presentation here is INSANE', 1),
('lp-14', 'list-5', 'place-11', '2025-01-22 23:00:00', 'Vietnamese dishes that photograph like art', 2),
('lp-15', 'list-5', 'place-21', '2024-11-10 10:00:00', 'Every plate is beautiful here', 3),

-- Food In The Air's "Wine & Dine"
('lp-16', 'list-6', 'place-2', '2024-10-15 11:00:00', 'Natural wine heaven. The sommeliers know their stuff.', 1),
('lp-17', 'list-6', 'place-25', '2024-09-01 12:00:00', 'French wine bar with incredible pairings', 2),

-- Food In The Air's "Late Night Spots"
('lp-18', 'list-7', 'place-6', '2025-02-28 13:00:00', 'Open until 3am! Pizza perfection.', 1),
('lp-19', 'list-7', 'place-22', '2024-12-01 14:00:00', 'Late night Mexican that hits the spot', 2),

-- Infatuation NYC's "Best of 2025"
('lp-20', 'list-8', 'place-5', '2025-03-18 15:00:00', 'From the Tatiana team. Stunning West African flavors.', 1),
('lp-21', 'list-8', 'place-3', '2025-02-15 16:00:00', 'Big French Riviera restaurant. Perfect for summer.', 2),
('lp-22', 'list-8', 'place-6', '2025-01-25 17:00:00', 'Bushwick coal oven pizza that made our Best Pizza guide.', 3),
('lp-23', 'list-8', 'place-13', '2025-05-05 18:00:00', 'New England fish spot that''s less cottage, more sexy submarine.', 4),
('lp-24', 'list-8', 'place-15', '2025-03-08 19:00:00', 'F&F Restaurant - elegant pizzas with martinis.', 5),

-- Infatuation NYC's "Budget Friendly"
('lp-25', 'list-9', 'place-7', '2025-04-20 20:00:00', 'Incredible banh mi under $10', 1),
('lp-26', 'list-9', 'place-16', '2025-05-18 21:00:00', 'Thai fast food. Chicken burger is $8 and amazing.', 2),
('lp-27', 'list-9', 'place-19', '2025-01-12 22:00:00', 'Korean comfort food. Great prices.', 3),

-- Best Food NY's "Classic NYC"
('lp-28', 'list-10', 'place-1', '2024-09-10 23:00:00', 'THE classic Italian-American splurge', 1),
('lp-29', 'list-10', 'place-12', '2024-10-05 10:00:00', 'NYC institution since 1914', 2),
('lp-30', 'list-10', 'place-23', '2025-03-22 11:00:00', 'Historic Greenwich Village bistro', 3);


-- ====================
-- FOLLOWS (Social connections)
-- ====================

INSERT INTO follows (id, follower_id, following_id, created_at) VALUES
-- Everyone follows Eitan (he's the biggest)
('follow-1', 'user-2', 'user-1', '2019-06-20 10:00:00'),
('follow-2', 'user-3', 'user-1', '2019-08-15 11:00:00'),
('follow-3', 'user-4', 'user-1', '2018-09-10 12:00:00'),
('follow-4', 'user-5', 'user-1', '2019-01-05 13:00:00'),

-- Everyone follows New Fork City
('follow-5', 'user-1', 'user-2', '2018-07-12 14:00:00'),
('follow-6', 'user-3', 'user-2', '2017-05-20 15:00:00'),
('follow-7', 'user-4', 'user-2', '2016-11-08 16:00:00'),
('follow-8', 'user-5', 'user-2', '2017-03-15 17:00:00'),

-- Cross follows between food accounts
('follow-9', 'user-1', 'user-3', '2019-02-10 18:00:00'),
('follow-10', 'user-2', 'user-3', '2018-08-22 19:00:00'),
('follow-11', 'user-4', 'user-3', '2018-12-05 20:00:00'),
('follow-12', 'user-5', 'user-3', '2019-04-18 21:00:00'),

-- Everyone follows Infatuation
('follow-13', 'user-1', 'user-4', '2017-09-14 22:00:00'),
('follow-14', 'user-2', 'user-4', '2016-06-30 23:00:00'),
('follow-15', 'user-3', 'user-4', '2018-03-25 10:00:00'),
('follow-16', 'user-5', 'user-4', '2017-11-12 11:00:00'),

-- Some follows for Best Food NY
('follow-17', 'user-1', 'user-5', '2018-05-08 12:00:00'),
('follow-18', 'user-2', 'user-5', '2017-12-20 13:00:00'),
('follow-19', 'user-3', 'user-5', '2018-10-15 14:00:00');


-- ====================
-- REVIEWS (User ratings & notes)
-- ====================

INSERT INTO reviews (id, user_id, place_id, rating, note, visited_at, created_at, updated_at) VALUES
-- Eitan's reviews
('review-1', 'user-1', 'place-1', 5, 'Absolutely incredible. The spicy rigatoni is a must-order. Service was impeccable and the vibe is perfect for a special night. Book weeks in advance!', '2024-12-05 19:30:00', '2024-12-05 21:00:00', '2024-12-05 21:00:00'),

('review-2', 'user-1', 'place-4', 5, 'Tatiana continues to blow me away. The branzino in callaloo curry is phenomenal. The whole dining room was singing along to the playlist - magical experience.', '2025-01-10 20:00:00', '2025-01-10 22:00:00', '2025-01-10 22:00:00'),

('review-3', 'user-1', 'place-5', 5, 'Dōgon is a masterpiece. From the chef behind Tatiana, so expectations were high and they delivered. The plantain hoe cakes with crab meat are incredible. West African cuisine at its finest.', '2025-03-20 19:15:00', '2025-03-20 21:00:00', '2025-03-20 21:00:00'),

('review-4', 'user-1', 'place-12', 5, 'Still the best bagels and smoked fish in NYC. The nova lox is unmatched. A true NYC institution that lives up to the hype.', '2024-11-15 11:00:00', '2024-11-15 13:00:00', '2024-11-15 13:00:00'),

('review-5', 'user-1', 'place-9', 4, 'The wagyu kra pow is so fun - they mix it tableside in a hot pot and the rice gets crispy in the beef fat. Great post-work spot near Columbus Circle.', '2025-04-18 20:30:00', '2025-04-18 22:00:00', '2025-04-18 22:00:00'),

('review-6', 'user-1', 'place-16', 4, 'What if McDonald''s were kinda Thai? The Mommy Royale burger is sloppy, unphotogenic, and absolutely delicious. Those curry puff mozzarella sticks though!', '2025-05-20 13:00:00', '2025-05-20 14:30:00', '2025-05-20 14:30:00'),

-- New Fork City's reviews
('review-7', 'user-2', 'place-1', 5, 'The ultimate splurge. Every dish is executed perfectly. The veal parm is legendary but honestly you can''t go wrong here. Save room for the chocolate cake!', '2025-01-08 20:00:00', '2025-01-08 22:00:00', '2025-01-08 22:00:00'),

('review-8', 'user-2', 'place-3', 5, 'French Riviera vibes in Brooklyn! The raw bar is stunning and everything we tried was incredible. Perfect for a summer afternoon with rosé.', '2025-02-14 19:30:00', '2025-02-14 21:00:00', '2025-02-14 21:00:00'),

('review-9', 'user-2', 'place-6', 5, 'Pizza perfection until 3am. The coal oven gives it that perfect char. Toppings are creative - we got the Calabrian chili and fennel sausage. New favorite late night spot.', '2025-03-10 21:00:00', '2025-03-10 23:00:00', '2025-03-10 23:00:00'),

('review-10', 'user-2', 'place-7', 5, 'The banh mi here is unreal. Three kinds of homemade cold cuts, pâté, pork floss, and bread that''s fluffy inside with a crackling crust. Freshly baked throughout the day. Get two.', '2025-04-15 12:30:00', '2025-04-15 14:00:00', '2025-04-15 14:00:00'),

-- Food In The Air's reviews
('review-11', 'user-3', 'place-2', 5, 'Wine bar perfection. The natural wine selection is incredible and the sommeliers are super knowledgeable without being pretentious. Small plates are all bangers.', '2024-10-15 19:30:00', '2024-10-15 21:00:00', '2024-10-15 21:00:00'),

('review-12', 'user-3', 'place-4', 5, 'Everything about Tatiana is special. The food, the music, the energy. BBQ greens with beef bacon are a revelation. Make a reservation now.', '2024-12-20 20:00:00', '2024-12-20 22:00:00', '2024-12-20 22:00:00'),

('review-13', 'user-3', 'place-6', 4, 'Late night pizza done right. Open until 3am which is clutch. Coal oven gives it great flavor. Can get busy but moves fast.', '2025-02-28 21:30:00', '2025-02-28 23:00:00', '2025-02-28 23:00:00'),

-- Infatuation NYC's reviews
('review-14', 'user-4', 'place-5', 5, 'A place with heart. Korean-influenced West African food that teeters between comforting and avant-garde. Hogging all the kimchi at the table. One of our Best New Restaurants of 2025.', '2025-03-18 20:30:00', '2025-03-18 22:00:00', '2025-03-18 22:00:00'),

('review-15', 'user-4', 'place-6', 5, 'NYC has enough pizza to go around, but none of it is quite like this. Thin pies are smoky and charred from the 19th-century coal oven. Available until 3am. Cleared our Best Pizza guide.', '2025-01-25 21:00:00', '2025-01-25 23:00:00', '2025-01-25 23:00:00'),

('review-16', 'user-4', 'place-7', 5, 'Even after a very big meal, you''ll be tempted to take one of these sandwiches home for later. Homemade cold cuts on bread that''s fluffy as a cotton ball with a shell-like crust.', '2025-04-20 12:00:00', '2025-04-20 14:00:00', '2025-04-20 14:00:00'),

('review-17', 'user-4', 'place-8', 4, 'Midtown East pasta palace specializing in luxurious primi. The busiate blanketed in black truffle is pure decadence. Full of noodle eaters with expensive purses.', '2025-03-01 19:30:00', '2025-03-01 21:00:00', '2025-03-01 21:00:00'),

('review-18', 'user-4', 'place-13', 5, 'A New England restaurant that''s less seaside cottage, more sexy submarine. They gave the fish collar the Nashville hot chicken treatment. The lobster roll is shamelessly saucy.', '2025-05-05 19:00:00', '2025-05-05 21:00:00', '2025-05-05 21:00:00'),

-- Best Food NY's reviews
('review-19', 'user-5', 'place-1', 5, 'The classic NYC Italian splurge. Everything is executed at the highest level. The veal parm could feed two people. This is where you take out-of-town guests.', '2024-09-10 20:00:00', '2024-09-10 22:00:00', '2024-09-10 22:00:00'),

('review-20', 'user-5', 'place-12', 5, 'NYC institution since 1914. The nova lox is the best in the city. Get a bagel with cream cheese, tomato, onion, capers. Don''t skip the pickles.', '2024-10-05 11:00:00', '2024-10-05 13:00:00', '2024-10-05 13:00:00'),

('review-21', 'user-5', 'place-23', 5, 'Historic Greenwich Village bistro. The black label burger is legendary. Book way ahead. The bone marrow is a must-order appetizer.', '2025-03-22 21:00:00', '2025-03-22 23:00:00', '2025-03-22 23:00:00');


-- ====================
-- PHOTOS (User-uploaded images)
-- ====================

INSERT INTO photos (id, user_id, place_id, review_id, url, width, height, created_at) VALUES
('photo-1', 'user-1', 'place-1', 'review-1', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9', 1920, 1280, '2024-12-05 21:00:00'),
('photo-2', 'user-1', 'place-4', 'review-2', 'https://images.unsplash.com/photo-1544025162-d76694265947', 1920, 1280, '2025-01-10 22:00:00'),
('photo-3', 'user-1', 'place-12', 'review-4', 'https://images.unsplash.com/photo-1605955340348-f0c0a6db90e6', 1920, 1280, '2024-11-15 13:00:00'),
('photo-4', 'user-2', 'place-6', 'review-9', 'https://images.unsplash.com/photo-1513104890138-7c749659a591', 1920, 1280, '2025-03-10 23:00:00'),
('photo-5', 'user-2', 'place-7', 'review-10', 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398', 1920, 1280, '2025-04-15 14:00:00'),
('photo-6', 'user-3', 'place-2', 'review-11', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3', 1920, 1280, '2024-10-15 21:00:00'),
('photo-7', 'user-4', 'place-5', 'review-14', 'https://images.unsplash.com/photo-1551218808-94e220e084d2', 1920, 1280, '2025-03-18 22:00:00'),
('photo-8', 'user-4', 'place-6', 'review-15', 'https://images.unsplash.com/photo-1571066811602-716837d681de', 1920, 1280, '2025-01-25 23:00:00'),
('photo-9', 'user-5', 'place-23', 'review-21', 'https://images.unsplash.com/photo-1553621042-f6e147245754', 1920, 1280, '2025-03-22 23:00:00');


-- ====================
-- ACTIVITIES (Feed items)
-- ====================

INSERT INTO activities (id, actor_id, type, place_id, list_id, metadata, dedupe_key, created_at) VALUES
-- Recent activities (newest first)
('activity-1', 'user-4', 'REVIEW_CREATED', 'place-13', null, '{"rating": 5, "review_preview": "A New England restaurant that''s less seaside cottage, more sexy submarine..."}', 'user-4-review-place-13', '2025-05-05 21:00:00'),

('activity-2', 'user-1', 'PLACE_MARKED_BEEN', 'place-16', null, '{"rating": 4}', 'user-1-been-place-16-2025-05-20', '2025-05-20 14:00:00'),

('activity-3', 'user-2', 'REVIEW_CREATED', 'place-7', null, '{"rating": 5, "review_preview": "The banh mi here is unreal. Three kinds of homemade cold cuts..."}', 'user-2-review-place-7', '2025-04-15 14:00:00'),

('activity-4', 'user-1', 'PLACE_MARKED_BEEN', 'place-9', null, '{"rating": 4}', 'user-1-been-place-9-2025-04-18', '2025-04-18 22:00:00'),

('activity-5', 'user-4', 'REVIEW_CREATED', 'place-7', null, '{"rating": 5, "review_preview": "Even after a very big meal, you''ll be tempted to take one home..."}', 'user-4-review-place-7', '2025-04-20 14:00:00'),

('activity-6', 'user-5', 'REVIEW_CREATED', 'place-23', null, '{"rating": 5, "review_preview": "Historic Greenwich Village bistro. The black label burger is legendary..."}', 'user-5-review-place-23', '2025-03-22 23:00:00'),

('activity-7', 'user-1', 'REVIEW_CREATED', 'place-5', null, '{"rating": 5, "review_preview": "Dōgon is a masterpiece. From the chef behind Tatiana..."}', 'user-1-review-place-5', '2025-03-20 21:00:00'),

('activity-8', 'user-4', 'REVIEW_CREATED', 'place-5', null, '{"rating": 5, "review_preview": "A place with heart. Korean-influenced West African food..."}', 'user-4-review-place-5', '2025-03-18 22:00:00'),

('activity-9', 'user-2', 'REVIEW_CREATED', 'place-6', null, '{"rating": 5, "review_preview": "Pizza perfection until 3am. The coal oven gives it perfect char..."}', 'user-2-review-place-6', '2025-03-10 23:00:00'),

('activity-10', 'user-4', 'REVIEW_CREATED', 'place-8', null, '{"rating": 4, "review_preview": "Midtown East pasta palace specializing in luxurious primi..."}', 'user-4-review-place-8', '2025-03-01 21:00:00'),

('activity-11', 'user-3', 'PLACE_MARKED_BEEN', 'place-6', null, '{"rating": null}', 'user-3-been-place-6-2025-02-28', '2025-02-28 22:00:00'),

('activity-12', 'user-2', 'REVIEW_CREATED', 'place-3', null, '{"rating": 5, "review_preview": "French Riviera vibes in Brooklyn! The raw bar is stunning..."}', 'user-2-review-place-3', '2025-02-14 21:00:00'),

('activity-13', 'user-4', 'REVIEW_CREATED', 'place-6', null, '{"rating": 5, "review_preview": "NYC has enough pizza to go around, but none of it is quite like this..."}', 'user-4-review-place-6', '2025-01-25 23:00:00'),

('activity-14', 'user-1', 'REVIEW_CREATED', 'place-4', null, '{"rating": 5, "review_preview": "Tatiana continues to blow me away. The branzino in callaloo curry..."}', 'user-1-review-place-4', '2025-01-10 22:00:00'),

('activity-15', 'user-2', 'REVIEW_CREATED', 'place-1', null, '{"rating": 5, "review_preview": "The ultimate splurge. Every dish is executed perfectly..."}', 'user-2-review-place-1', '2025-01-08 22:00:00');


-- ============================================
-- END OF SEED DATA
-- ============================================

-- Summary:
-- - 5 real NYC food influencers
-- - 25 actual NYC restaurants (many from Infatuation's 2025 Best List)
-- - 50 saved places (realistic visit patterns)
-- - 10 curated lists
-- - 30 list items
-- - 19 follow relationships
-- - 21 detailed reviews
-- - 9 food photos
-- - 15 recent activity items
