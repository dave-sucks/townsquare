-- The old hand-matching flow copied a post once per extra place it matched
-- ("<shortcode>_place_N"). A copy is the same Instagram post, so the engine
-- would read it twice. Each post's mentions (original and copies) are
-- deduped per place, keeping human work first, then the original's own, then
-- the oldest; the survivors move to the original post; the copies go.

CREATE TEMP TABLE post_copies AS
SELECT c.id AS copy_id, c.canonical_post_id AS copy_code, o.id AS orig_id, o.canonical_post_id AS orig_code
  FROM ingested_posts c
  JOIN ingested_posts o
    ON o.platform = c.platform AND o.canonical_post_id = split_part(c.canonical_post_id, '_place_', 1)
 WHERE c.canonical_post_id ~ '_place_[0-9]+$';

CREATE TEMP TABLE post_group_reviews AS
SELECT DISTINCT ON (r.id)
       r.id AS review_id, r.place_id, r.created_at, g.orig_id, g.orig_code,
       (r.status = 'confirmed' OR r.resolved_by = 'human') AS is_human,
       (r.instagram_post_id = g.orig_code) AS on_original
  FROM (SELECT DISTINCT orig_id, orig_code FROM post_copies) g
  JOIN reviews r
    ON r.instagram_post_id = g.orig_code
    OR r.ingested_post_id = g.orig_id
    OR r.ingested_post_id IN (SELECT pc.copy_id FROM post_copies pc WHERE pc.orig_id = g.orig_id)
    OR r.instagram_post_id IN (SELECT pc.copy_code FROM post_copies pc WHERE pc.orig_id = g.orig_id);

CREATE TEMP TABLE post_group_ranked AS
SELECT review_id, orig_id, orig_code,
       row_number() OVER (PARTITION BY orig_code, place_id
                          ORDER BY is_human DESC, on_original DESC, created_at ASC) AS rank
  FROM post_group_reviews;

-- Duplicates of a (post, place) go, with their copied media.
DELETE FROM photos WHERE review_id IN (SELECT review_id FROM post_group_ranked WHERE rank > 1);
DELETE FROM reviews WHERE id IN (SELECT review_id FROM post_group_ranked WHERE rank > 1);

-- Survivors belong to the original post.
UPDATE reviews r
   SET instagram_post_id = k.orig_code, instagram_shortcode = k.orig_code, ingested_post_id = k.orig_id
  FROM post_group_ranked k
 WHERE r.id = k.review_id AND k.rank = 1;

-- One activity per post: an original without one takes its first copy's.
UPDATE activities a SET dedupe_key = 'review_import_' || pc.orig_code
  FROM post_copies pc
 WHERE a.dedupe_key = 'review_import_' || pc.copy_code
   AND NOT EXISTS (SELECT 1 FROM activities x WHERE x.dedupe_key = 'review_import_' || pc.orig_code)
   AND pc.copy_code = (SELECT min(p2.copy_code) FROM post_copies p2 WHERE p2.orig_code = pc.orig_code);
DELETE FROM activities a USING post_copies pc WHERE a.dedupe_key = 'review_import_' || pc.copy_code;

-- The copies themselves (their runs and review items go with them).
DELETE FROM ingested_posts WHERE id IN (SELECT copy_id FROM post_copies);

DROP TABLE post_group_ranked;
DROP TABLE post_group_reviews;
DROP TABLE post_copies;
