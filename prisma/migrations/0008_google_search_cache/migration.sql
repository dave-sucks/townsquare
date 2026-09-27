-- CreateTable
CREATE TABLE "google_search_cache" (
    "key" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_search_cache_pkey" PRIMARY KEY ("key")
);
