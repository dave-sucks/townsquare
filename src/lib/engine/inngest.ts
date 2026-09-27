/**
 * The engine's Inngest client and its events. Every pipeline stage runs as a
 * step of an Inngest function served from /api/inngest; locally that's the
 * Inngest Dev Server (`npx inngest-cli@latest dev`, INNGEST_DEV=1), in
 * production the Inngest Vercel integration (INNGEST_EVENT_KEY and
 * INNGEST_SIGNING_KEY).
 */

import { Inngest, eventType } from "inngest";
import { z } from "zod";

export const inngest = new Inngest({ id: "townsquare" });

/** Fetch a source's new posts ("Sync now", and the daily sync). */
export const sourceSync = eventType("engine/source.sync", {
  schema: z.object({ sourceId: z.string() }),
});

/** A post was stored by Sync: run it through the pipeline. */
export const postIngested = eventType("engine/post.ingested", {
  schema: z.object({ postId: z.string() }),
});

/** Run a post through the pipeline again (admin re-run, backfill). */
export const postReprocess = eventType("engine/post.reprocess", {
  schema: z.object({
    postId: z.string(),
    /** Start from this stage, reusing earlier stages' stored output. */
    fromStage: z.string().optional(),
    /** Who asked: a user id, or "backfill". */
    requestedBy: z.string().optional(),
  }),
});

/** A place's mentions changed: re-run Aggregate and Summarize for it. */
export const placeChanged = eventType("engine/place.changed", {
  schema: z.object({
    placeId: z.string(),
    /** Re-run Summarize even when the mentions haven't changed (admin "Re-run summary"). */
    force: z.boolean().optional(),
  }),
});

/** An admin bulk action: re-process a source's posts, or every post. */
export const backfill = eventType("engine/backfill", {
  schema: z.object({
    kind: z.enum(["reprocess_posts"]),
    /** The audit row that records the request; its runs carry "backfill:<id>". */
    backfillId: z.string(),
    requestedBy: z.string(),
    sourceId: z.string().optional(),
  }),
});
