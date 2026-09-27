/**
 * engine/backfill: "Re-process all". Sends every post of the scope (minus the
 * ones a person already reviewed) as engine/post.reprocess, in batches;
 * engine/post.process runs them at its own concurrency, so the queue drains
 * at the pace the pipeline allows.
 */

import { backfill, inngest, postReprocess } from "../inngest";
import { backfillTag, reprocessCandidates } from "../backfill";

const BATCH = 50;

export const reprocessBackfill = inngest.createFunction(
  { id: "engine-backfill", name: "Re-process all", triggers: [backfill], concurrency: { limit: 1 }, retries: 2 },
  async ({ event, step }) => {
    const { backfillId, sourceId } = event.data;
    const { postIds } = await step.run("posts", () => reprocessCandidates(sourceId ?? null));
    for (let i = 0; i < postIds.length; i += BATCH) {
      await step.sendEvent(
        `send-${i / BATCH}`,
        postIds.slice(i, i + BATCH).map((postId) => postReprocess.create({ postId, requestedBy: backfillTag(backfillId) })),
      );
    }
    return { backfillId, posts: postIds.length };
  },
);
