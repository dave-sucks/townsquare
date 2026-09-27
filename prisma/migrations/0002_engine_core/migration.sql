-- CreateEnum
CREATE TYPE "source_status" AS ENUM ('active', 'paused');

-- CreateEnum
CREATE TYPE "post_type" AS ENUM ('single_place', 'roundup', 'guide', 'not_a_place', 'other');

-- CreateEnum
CREATE TYPE "mention_verdict" AS ENUM ('loved', 'liked', 'mixed', 'disliked', 'none');

-- CreateEnum
CREATE TYPE "mention_role" AS ENUM ('primary', 'list_item', 'passing');

-- CreateEnum
CREATE TYPE "mention_status" AS ENUM ('auto', 'confirmed', 'rejected');

-- CreateEnum
CREATE TYPE "resolved_by" AS ENUM ('code', 'agent', 'human');

-- CreateEnum
CREATE TYPE "engine_run_kind" AS ENUM ('post', 'place');

-- CreateEnum
CREATE TYPE "engine_run_status" AS ENUM ('queued', 'running', 'completed', 'needs_review', 'failed');

-- CreateEnum
CREATE TYPE "engine_step_status" AS ENUM ('running', 'completed', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "agent_version_status" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "example_source" AS ENUM ('human_confirmed', 'human_corrected', 'builder_draft', 'seed');

-- CreateEnum
CREATE TYPE "review_item_kind" AS ENUM ('confirm_place', 'check_not_a_place', 'fix_extraction', 'failed_run', 'spot_check', 'confirm_example');

-- CreateEnum
CREATE TYPE "review_item_status" AS ENUM ('open', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "tag_status" AS ENUM ('active', 'deprecated');

-- CreateEnum
CREATE TYPE "tag_suggestion_status" AS ENUM ('open', 'accepted', 'mapped', 'rejected');

-- DropIndex
DROP INDEX "reviews_instagram_post_id_key";

-- AlterTable
ALTER TABLE "places" ADD COLUMN     "is_hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "known_for" JSONB,
ADD COLUMN     "merged_into_id" VARCHAR(36),
ADD COLUMN     "search_document" tsvector,
ADD COLUMN     "verdict_counts" JSONB;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "creator_score" DOUBLE PRECISION,
ADD COLUMN     "creator_score_max" DOUBLE PRECISION,
ADD COLUMN     "dishes" JSONB,
ADD COLUMN     "excerpt" TEXT,
ADD COLUMN     "ingested_post_id" VARCHAR(36),
ADD COLUMN     "is_sponsored" BOOLEAN,
ADD COLUMN     "resolved_by" "resolved_by",
ADD COLUMN     "role" "mention_role",
ADD COLUMN     "status" "mention_status",
ADD COLUMN     "verdict" "mention_verdict";

-- AlterTable
ALTER TABLE "import_jobs" ADD COLUMN     "apify_run_id" TEXT,
ADD COLUMN     "since" TIMESTAMP(6),
ADD COLUMN     "source_id" VARCHAR(36);

-- AlterTable
ALTER TABLE "ingested_posts" ADD COLUMN     "is_place_content" BOOLEAN,
ADD COLUMN     "is_sponsored" BOOLEAN,
ADD COLUMN     "last_run_id" VARCHAR(36),
ADD COLUMN     "post_type" "post_type",
ADD COLUMN     "source_id" VARCHAR(36);

-- AlterTable
ALTER TABLE "review_tags" ADD COLUMN     "evidence" TEXT,
ADD COLUMN     "run_id" VARCHAR(36);

-- AlterTable
ALTER TABLE "tags" ADD COLUMN     "merged_into_id" VARCHAR(36),
ADD COLUMN     "status" "tag_status" NOT NULL DEFAULT 'active',
ADD COLUMN     "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "sources" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "platform" "import_platform" NOT NULL DEFAULT 'instagram',
    "handle" TEXT NOT NULL,
    "user_id" VARCHAR(36),
    "status" "source_status" NOT NULL DEFAULT 'active',
    "home_city" TEXT,
    "notes" TEXT,
    "trust_weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "last_synced_at" TIMESTAMP(6),
    "last_post_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine_runs" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "kind" "engine_run_kind" NOT NULL DEFAULT 'post',
    "post_id" VARCHAR(36),
    "place_id" VARCHAR(36),
    "trigger" TEXT NOT NULL,
    "from_stage" TEXT,
    "requested_by" TEXT,
    "status" "engine_run_status" NOT NULL DEFAULT 'queued',
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error" TEXT,
    "started_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(6),

    CONSTRAINT "engine_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine_steps" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "run_id" VARCHAR(36) NOT NULL,
    "stage" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "status" "engine_step_status" NOT NULL DEFAULT 'running',
    "input" JSONB,
    "output" JSONB,
    "agent_version_id" VARCHAR(36),
    "model" TEXT,
    "tokens_in" INTEGER NOT NULL DEFAULT 0,
    "tokens_out" INTEGER NOT NULL DEFAULT 0,
    "tokens_cached" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latency_ms" INTEGER,
    "error" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "started_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(6),

    CONSTRAINT "engine_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active_version_id" VARCHAR(36),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "agent_versions" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "agent_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "effort" TEXT,
    "max_tokens" INTEGER NOT NULL,
    "notes" TEXT,
    "status" "agent_version_status" NOT NULL DEFAULT 'draft',
    "eval_summary" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "examples" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "agent_key" TEXT NOT NULL,
    "post_id" VARCHAR(36),
    "review_id" VARCHAR(36),
    "input" JSONB NOT NULL,
    "expected" JSONB NOT NULL,
    "source" "example_source" NOT NULL,
    "in_golden_set" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_items" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "kind" "review_item_kind" NOT NULL,
    "post_id" VARCHAR(36),
    "review_id" VARCHAR(36),
    "run_id" VARCHAR(36),
    "question" TEXT NOT NULL,
    "payload" JSONB,
    "status" "review_item_status" NOT NULL DEFAULT 'open',
    "resolution" JSONB,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(6),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_suggestions" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "label" TEXT NOT NULL,
    "normalized_label" TEXT NOT NULL,
    "category_slug" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "count" INTEGER NOT NULL DEFAULT 1,
    "status" "tag_suggestion_status" NOT NULL DEFAULT 'open',
    "tag_id" VARCHAR(36),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geocode_cache" (
    "query" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geocode_cache_pkey" PRIMARY KEY ("query")
);

-- CreateIndex
CREATE UNIQUE INDEX "sources_platform_handle_key" ON "sources"("platform", "handle");

-- CreateIndex
CREATE INDEX "engine_runs_post_id_started_at_idx" ON "engine_runs"("post_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "engine_runs_place_id_started_at_idx" ON "engine_runs"("place_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "engine_runs_status_started_at_idx" ON "engine_runs"("status", "started_at" DESC);

-- CreateIndex
CREATE INDEX "engine_runs_started_at_idx" ON "engine_runs"("started_at" DESC);

-- CreateIndex
CREATE INDEX "engine_steps_agent_version_id_started_at_idx" ON "engine_steps"("agent_version_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "engine_steps_stage_started_at_idx" ON "engine_steps"("stage", "started_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "engine_steps_run_id_stage_key_key" ON "engine_steps"("run_id", "stage", "key");

-- CreateIndex
CREATE UNIQUE INDEX "agents_active_version_id_key" ON "agents"("active_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_versions_agent_key_version_key" ON "agent_versions"("agent_key", "version");

-- CreateIndex
CREATE INDEX "examples_agent_key_created_at_idx" ON "examples"("agent_key", "created_at" DESC);

-- CreateIndex
CREATE INDEX "examples_post_id_idx" ON "examples"("post_id");

-- CreateIndex
CREATE INDEX "review_items_status_kind_created_at_idx" ON "review_items"("status", "kind", "created_at" DESC);

-- CreateIndex
CREATE INDEX "review_items_post_id_idx" ON "review_items"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "tag_suggestions_normalized_label_key" ON "tag_suggestions"("normalized_label");

-- CreateIndex
CREATE INDEX "places_search_document_idx" ON "places" USING GIN ("search_document");

-- CreateIndex
CREATE INDEX "reviews_ingested_post_id_idx" ON "reviews"("ingested_post_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_instagram_post_id_place_id_key" ON "reviews"("instagram_post_id", "place_id");

-- CreateIndex
CREATE INDEX "import_jobs_source_id_created_at_idx" ON "import_jobs"("source_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ingested_posts_source_id_posted_at_idx" ON "ingested_posts"("source_id", "posted_at" DESC);

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_ingested_post_id_fkey" FOREIGN KEY ("ingested_post_id") REFERENCES "ingested_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingested_posts" ADD CONSTRAINT "ingested_posts_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine_runs" ADD CONSTRAINT "engine_runs_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "ingested_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine_runs" ADD CONSTRAINT "engine_runs_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine_steps" ADD CONSTRAINT "engine_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "engine_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine_steps" ADD CONSTRAINT "engine_steps_agent_version_id_fkey" FOREIGN KEY ("agent_version_id") REFERENCES "agent_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_active_version_id_fkey" FOREIGN KEY ("active_version_id") REFERENCES "agent_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_agent_key_fkey" FOREIGN KEY ("agent_key") REFERENCES "agents"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "ingested_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;
