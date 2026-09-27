-- Engine backfill: sources for the imported creators, and the links between
-- posts and their mentions. Data only; nothing is removed.

-- Sources: one per imported creator. Home city defaults to New York (every
-- source today posts mostly NYC); Dave edits it per source.
INSERT INTO "sources" ("platform", "handle", "user_id", "status", "home_city", "last_synced_at", "last_post_at")
SELECT 'instagram', u."instagram_handle", u."id", 'active', 'New York, NY', u."last_instagram_sync",
       (SELECT max(ip."posted_at") FROM "ingested_posts" ip WHERE lower(ip."author_handle") = lower(u."instagram_handle"))
  FROM "users" u
 WHERE u."is_instagram_import" AND u."instagram_handle" IS NOT NULL
ON CONFLICT ("platform", "handle") DO NOTHING;

-- Syncs (import jobs) and posts belong to their source.
UPDATE "import_jobs" ij SET "source_id" = s."id"
  FROM "sources" s
 WHERE ij."source_id" IS NULL
   AND lower(s."handle") = lower(regexp_replace(regexp_replace(ij."input", '^.*instagram\.com/', ''), '[/?].*$', ''));

UPDATE "ingested_posts" ip SET "source_id" = s."id"
  FROM "sources" s
 WHERE ip."source_id" IS NULL AND lower(s."handle") = lower(ip."author_handle");

-- Each imported review is a mention of its post.
UPDATE "reviews" r SET "ingested_post_id" = ip."id"
  FROM "ingested_posts" ip
 WHERE ip."review_id" = r."id" AND r."ingested_post_id" IS NULL;

-- Imported mentions were placed by code, except the ones Dave picked by hand:
-- those are human work, which re-processing never overwrites.
UPDATE "reviews" r
   SET "status"      = CASE WHEN ip."resolve_method" = 'manual' THEN 'confirmed'::"mention_status" ELSE 'auto'::"mention_status" END,
       "resolved_by" = CASE WHEN ip."resolve_method" = 'manual' THEN 'human'::"resolved_by" ELSE 'code'::"resolved_by" END,
       "role"        = 'primary'::"mention_role"
  FROM "ingested_posts" ip
 WHERE r."ingested_post_id" = ip."id" AND r."status" IS NULL;
