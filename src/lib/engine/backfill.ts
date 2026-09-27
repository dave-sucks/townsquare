/**
 * Re-process all: send a source's posts (or every post) through the pipeline
 * again. A backfill is one audit row (who asked, how many posts, the
 * estimate); its runs carry requestedBy "backfill:<id>", so progress is a
 * count over engine_runs. Posts a person already reviewed (they have a human
 * Read example) are left alone, and the pipeline keeps confirmed mentions on
 * the rest.
 */

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { ENGINE } from "./config";
import { writeAudit } from "./write/audit";

/** What a backfill's runs carry as requestedBy. */
export const backfillTag = (backfillId: string) => `backfill:${backfillId}`;

/** When there's no history to learn from: Phase 2's sample, post plus place refreshes. */
const FALLBACK_PER_POST_USD = 0.028;
const FALLBACK_SECONDS_PER_POST = 45;

export async function reprocessCandidates(sourceId: string | null) {
  const rows = await prisma.$queryRaw<{ id: string; reviewed: boolean }[]>(Prisma.sql`
    SELECT p.id,
           EXISTS (SELECT 1 FROM examples e WHERE e.post_id = p.id AND e.agent_key = 'read') AS reviewed
      FROM ingested_posts p
     WHERE (${sourceId}::text IS NULL OR p.source_id = ${sourceId})
     ORDER BY p.posted_at DESC NULLS LAST`);
  return { postIds: rows.filter((r) => !r.reviewed).map((r) => r.id), reviewed: rows.filter((r) => r.reviewed).length };
}

/**
 * Cost and time for re-processing this many posts, from the run ledger: the
 * average full post run, plus the place refreshes that follow a post run on
 * average, spread over the post concurrency.
 */
export async function estimateReprocess(posts: number) {
  const [row] = await prisma.$queryRaw<{ post_runs: number; post_cost: number | null; post_secs: number | null; place_cost: number | null; all_post_runs: number }[]>(Prisma.sql`
    WITH recent AS (
      SELECT cost_usd, extract(epoch FROM finished_at - started_at) AS secs
        FROM engine_runs
       WHERE kind = 'post' AND status IN ('completed', 'needs_review') AND from_stage IS NULL AND finished_at IS NOT NULL
       ORDER BY started_at DESC
       LIMIT 300
    )
    SELECT (SELECT count(*)::int FROM recent) AS post_runs,
           (SELECT avg(cost_usd)::float FROM recent) AS post_cost,
           (SELECT avg(secs)::float FROM recent) AS post_secs,
           (SELECT coalesce(sum(cost_usd), 0)::float FROM engine_runs WHERE kind = 'place') AS place_cost,
           (SELECT count(*)::int FROM engine_runs WHERE kind = 'post') AS all_post_runs`);
  const learned = row.post_runs >= 10 && row.post_cost != null;
  const perPost = learned ? row.post_cost! + (row.all_post_runs > 0 ? (row.place_cost ?? 0) / row.all_post_runs : 0) : FALLBACK_PER_POST_USD;
  const secsPerPost = learned && row.post_secs ? row.post_secs : FALLBACK_SECONDS_PER_POST;
  return {
    posts,
    perPostUsd: Math.round(perPost * 10_000) / 10_000,
    totalUsd: Math.round(perPost * posts * 100) / 100,
    minutes: Math.ceil((secsPerPost * posts) / ENGINE.runtime.postConcurrency / 60),
    basis: learned ? `the last ${row.post_runs} post runs` : "the Phase 2 sample",
  };
}

export type BackfillProgress = {
  id: string;
  sourceId: string | null;
  posts: number;
  estimateUsd: number;
  startedAt: string;
  requestedBy: string | null;
  done: number;
  completed: number;
  needsReview: number;
  failed: number;
  running: number;
  costUsd: number;
  finished: boolean;
};

type StartRow = { entity_id: string; field_changes: Record<string, { to: unknown }> | null; actor: string | null; created_at: Date };

/** The latest backfill (of one source, or of any scope when sourceId is undefined) and how far it got. */
export async function latestBackfill(sourceId?: string | null): Promise<BackfillProgress | null> {
  const [start] = await prisma.$queryRaw<StartRow[]>(Prisma.sql`
    SELECT entity_id, field_changes, actor, created_at
      FROM audit_log
     WHERE entity = 'backfill' AND action = 'start'
       ${sourceId === undefined ? Prisma.empty : sourceId === null ? Prisma.sql`AND field_changes->'sourceId'->>'to' IS NULL` : Prisma.sql`AND field_changes->'sourceId'->>'to' = ${sourceId}`}
     ORDER BY created_at DESC
     LIMIT 1`);
  if (!start) return null;
  const f = start.field_changes ?? {};
  const posts = Number(f.posts?.to ?? 0);
  const counts = await prisma.$queryRaw<{ status: string; n: number; cost: number }[]>(Prisma.sql`
    SELECT status::text, count(*)::int AS n, coalesce(sum(cost_usd), 0)::float AS cost
      FROM engine_runs
     WHERE requested_by = ${backfillTag(start.entity_id)}
     GROUP BY status`);
  const by = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
  const completed = by("completed");
  const needsReview = by("needs_review");
  const failed = by("failed");
  const done = completed + needsReview + failed;
  return {
    id: start.entity_id,
    sourceId: (f.sourceId?.to as string | null | undefined) ?? null,
    posts,
    estimateUsd: Number(f.estimateUsd?.to ?? 0),
    startedAt: start.created_at.toISOString(),
    requestedBy: start.actor,
    done,
    completed,
    needsReview,
    failed,
    running: by("running") + by("queued"),
    costUsd: Math.round(counts.reduce((n, c) => n + c.cost, 0) * 100) / 100,
    finished: done >= posts,
  };
}

/** Record a backfill the runner accepted (its runs find it by id). */
export async function recordBackfill(opts: { id: string; sourceId: string | null; posts: number; estimateUsd: number; actor: string }) {
  await writeAudit({
    entity: "backfill",
    entityId: opts.id,
    action: "start",
    actor: opts.actor,
    fieldChanges: {
      posts: { from: null, to: opts.posts },
      estimateUsd: { from: null, to: opts.estimateUsd },
      sourceId: { from: null, to: opts.sourceId },
    },
  });
}
