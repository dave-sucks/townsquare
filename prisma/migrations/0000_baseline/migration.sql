-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "list_visibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "activity_type" AS ENUM ('PLACE_SAVED', 'PLACE_MARKED_BEEN', 'PLACE_ADDED_TO_LIST', 'LIST_CREATED', 'REVIEW_CREATED');

-- CreateEnum
CREATE TYPE "review_source" AS ENUM ('manual', 'instagram', 'tiktok');

-- CreateEnum
CREATE TYPE "import_platform" AS ENUM ('instagram', 'tiktok');

-- CreateEnum
CREATE TYPE "import_type" AS ENUM ('profile', 'post_url', 'place_seed');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "post_status" AS ENUM ('new', 'processed', 'unresolved', 'failed');

-- CreateEnum
CREATE TYPE "resolve_method" AS ENUM ('geotag', 'caption', 'hashtag', 'ai', 'manual', 'none');

-- CreateEnum
CREATE TYPE "job_type" AS ENUM ('IMPORT_PROFILE', 'PROCESS_POST', 'ENRICH_REVIEW', 'UPDATE_PLACE_AGGREGATES', 'REFRESH_PLACE_SUMMARY');

-- CreateEnum
CREATE TYPE "tag_source" AS ENUM ('manual', 'ai', 'google', 'user');

-- CreateEnum
CREATE TYPE "import_status" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT,
    "username" TEXT,
    "password_hash" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_name" TEXT,
    "last_name" TEXT,
    "profile_image_url" TEXT,
    "bio" TEXT,
    "instagram_handle" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "website" TEXT,
    "avatar_emoji" TEXT,
    "instagram_id" TEXT,
    "instagram_post_count" INTEGER NOT NULL DEFAULT 0,
    "is_instagram_import" BOOLEAN NOT NULL DEFAULT false,
    "last_instagram_sync" TIMESTAMP(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- CreateTable
CREATE TABLE "places" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "google_place_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formatted_address" TEXT NOT NULL,
    "neighborhood" TEXT,
    "locality" TEXT,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "primary_type" TEXT,
    "types" JSONB,
    "price_level" TEXT,
    "photo_refs" JSONB,
    "ai_summary" TEXT,
    "ai_summary_updated_at" TIMESTAMP(6),
    "top_chips" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_places" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(36) NOT NULL,
    "place_id" VARCHAR(36) NOT NULL,
    "visited_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "has_been" BOOLEAN DEFAULT false,
    "rating" INTEGER,
    "emoji" TEXT,

    CONSTRAINT "saved_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lists" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(36) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "list_visibility" NOT NULL DEFAULT 'PRIVATE',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_system" BOOLEAN DEFAULT false,
    "system_slug" VARCHAR(255),

    CONSTRAINT "lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_places" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "list_id" VARCHAR(36) NOT NULL,
    "place_id" VARCHAR(36) NOT NULL,
    "added_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "sort_order" INTEGER,

    CONSTRAINT "list_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "follower_id" VARCHAR(36) NOT NULL,
    "following_id" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" VARCHAR(36) NOT NULL,
    "type" "activity_type" NOT NULL,
    "place_id" VARCHAR(36),
    "list_id" VARCHAR(36),
    "metadata" JSONB,
    "dedupe_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(36) NOT NULL,
    "place_id" VARCHAR(36) NOT NULL,
    "rating" INTEGER,
    "note" TEXT,
    "visited_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instagram_embed_html" TEXT,
    "instagram_post_id" TEXT,
    "instagram_shortcode" TEXT,
    "instagram_url" TEXT,
    "source" "review_source" NOT NULL DEFAULT 'manual',
    "social_post_caption" TEXT,
    "social_post_media_url" TEXT,
    "social_post_media_type" TEXT,
    "social_post_likes" INTEGER,
    "social_post_posted_at" TIMESTAMP(6),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(36) NOT NULL,
    "place_id" VARCHAR(36) NOT NULL,
    "review_id" VARCHAR(36),
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "carousel_position" INTEGER NOT NULL DEFAULT 0,
    "is_carousel" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "platform" "import_platform" NOT NULL,
    "type" "import_type" NOT NULL,
    "input" TEXT NOT NULL,
    "max_posts" INTEGER NOT NULL DEFAULT 100,
    "status" "job_status" NOT NULL DEFAULT 'pending',
    "posts_fetched" INTEGER NOT NULL DEFAULT 0,
    "posts_processed" INTEGER NOT NULL DEFAULT 0,
    "reviews_created" INTEGER NOT NULL DEFAULT 0,
    "posts_unresolved" INTEGER NOT NULL DEFAULT 0,
    "posts_failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingested_posts" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "platform" "import_platform" NOT NULL,
    "import_job_id" VARCHAR(36) NOT NULL,
    "canonical_post_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "author_handle" TEXT NOT NULL,
    "author_platform_id" TEXT,
    "caption" TEXT,
    "posted_at" TIMESTAMP(6),
    "like_count" INTEGER,
    "media" JSONB,
    "raw_payload" JSONB,
    "resolved_google_place_id" TEXT,
    "resolve_method" "resolve_method",
    "resolve_confidence" DOUBLE PRECISION,
    "resolve_candidates" JSONB,
    "review_id" VARCHAR(36),
    "status" "post_status" NOT NULL DEFAULT 'new',
    "error" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingested_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "type" "job_type" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "job_status" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "run_after" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_tags" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "review_id" VARCHAR(36) NOT NULL,
    "tag_id" VARCHAR(36) NOT NULL,
    "source" "tag_source" NOT NULL DEFAULT 'ai',
    "confidence" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "place_tag_aggregates" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "place_id" VARCHAR(36) NOT NULL,
    "tag_id" VARCHAR(36) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "evidence_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_computed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_suppressed" BOOLEAN NOT NULL DEFAULT false,
    "source_breakdown" JSONB,

    CONSTRAINT "place_tag_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(36) NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ui_messages" JSONB,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_categories" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "search_weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "icon_name" TEXT,

    CONSTRAINT "tag_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "category_id" VARCHAR(36) NOT NULL,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "icon_name" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "place_tags" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "place_id" VARCHAR(36) NOT NULL,
    "tag_id" VARCHAR(36) NOT NULL,
    "source" "tag_source" NOT NULL DEFAULT 'manual',
    "confidence" DOUBLE PRECISION,
    "added_by_id" VARCHAR(36),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "place_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_unique" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_unique" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_instagram_handle_key" ON "users"("instagram_handle");

-- CreateIndex
CREATE UNIQUE INDEX "users_instagram_id_key" ON "users"("instagram_id");

-- CreateIndex
CREATE INDEX "IDX_session_expire" ON "session"("expire");

-- CreateIndex
CREATE UNIQUE INDEX "places_google_place_id_unique" ON "places"("google_place_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_places_user_id_place_id_key" ON "saved_places"("user_id", "place_id");

-- CreateIndex
CREATE UNIQUE INDEX "list_places_list_id_place_id_key" ON "list_places"("list_id", "place_id");

-- CreateIndex
CREATE INDEX "follows_follower_id_idx" ON "follows"("follower_id");

-- CreateIndex
CREATE INDEX "follows_following_id_idx" ON "follows"("following_id");

-- CreateIndex
CREATE UNIQUE INDEX "follows_follower_id_following_id_key" ON "follows"("follower_id", "following_id");

-- CreateIndex
CREATE UNIQUE INDEX "activities_dedupe_key_key" ON "activities"("dedupe_key");

-- CreateIndex
CREATE INDEX "activities_actor_id_created_at_idx" ON "activities"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activities_created_at_idx" ON "activities"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_instagram_post_id_key" ON "reviews"("instagram_post_id");

-- CreateIndex
CREATE INDEX "reviews_place_id_idx" ON "reviews"("place_id");

-- CreateIndex
CREATE INDEX "reviews_instagram_post_id_idx" ON "reviews"("instagram_post_id");

-- CreateIndex
CREATE INDEX "reviews_source_idx" ON "reviews"("source");

-- CreateIndex
CREATE INDEX "photos_place_id_created_at_idx" ON "photos"("place_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "photos_review_id_carousel_position_idx" ON "photos"("review_id", "carousel_position");

-- CreateIndex
CREATE INDEX "import_jobs_platform_status_created_at_idx" ON "import_jobs"("platform", "status", "created_at");

-- CreateIndex
CREATE INDEX "ingested_posts_status_idx" ON "ingested_posts"("status");

-- CreateIndex
CREATE INDEX "ingested_posts_author_handle_idx" ON "ingested_posts"("author_handle");

-- CreateIndex
CREATE INDEX "ingested_posts_resolved_google_place_id_idx" ON "ingested_posts"("resolved_google_place_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingested_posts_platform_canonical_post_id_key" ON "ingested_posts"("platform", "canonical_post_id");

-- CreateIndex
CREATE INDEX "jobs_status_run_after_idx" ON "jobs"("status", "run_after");

-- CreateIndex
CREATE INDEX "jobs_type_status_idx" ON "jobs"("type", "status");

-- CreateIndex
CREATE INDEX "review_tags_review_id_idx" ON "review_tags"("review_id");

-- CreateIndex
CREATE INDEX "review_tags_tag_id_idx" ON "review_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_tags_review_id_tag_id_key" ON "review_tags"("review_id", "tag_id");

-- CreateIndex
CREATE INDEX "place_tag_aggregates_place_id_confidence_idx" ON "place_tag_aggregates"("place_id", "confidence");

-- CreateIndex
CREATE UNIQUE INDEX "place_tag_aggregates_place_id_tag_id_key" ON "place_tag_aggregates"("place_id", "tag_id");

-- CreateIndex
CREATE INDEX "conversations_user_id_created_at_idx" ON "conversations"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "tag_categories_slug_key" ON "tag_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tags_category_id_idx" ON "tags"("category_id");

-- CreateIndex
CREATE INDEX "place_tags_place_id_idx" ON "place_tags"("place_id");

-- CreateIndex
CREATE INDEX "place_tags_tag_id_idx" ON "place_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "place_tags_place_id_tag_id_key" ON "place_tags"("place_id", "tag_id");

-- AddForeignKey
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lists" ADD CONSTRAINT "lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_places" ADD CONSTRAINT "list_places_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_places" ADD CONSTRAINT "list_places_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingested_posts" ADD CONSTRAINT "ingested_posts_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingested_posts" ADD CONSTRAINT "ingested_posts_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_tags" ADD CONSTRAINT "review_tags_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_tags" ADD CONSTRAINT "review_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_tag_aggregates" ADD CONSTRAINT "place_tag_aggregates_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_tag_aggregates" ADD CONSTRAINT "place_tag_aggregates_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "tag_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_tags" ADD CONSTRAINT "place_tags_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_tags" ADD CONSTRAINT "place_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
