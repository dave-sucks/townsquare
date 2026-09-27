/**
 * engine/post.process: a post through Read → Resolve → mentions → Tag, one
 * Inngest step per stage (retried 3 times each), then engine/place.changed
 * for every place it touched. A re-run can start at resolve or tag, reusing
 * the last run's stored Read output.
 */

import { prisma } from "@/lib/prisma";
import { ENGINE } from "../config";
import { inngest, placeChanged, postIngested, postReprocess } from "../inngest";
import { dismissOpenItems, openReviewItem } from "../review";
import { runRead, type ReadResult } from "../stages/read";
import { runResolve, type ResolveResult } from "../stages/resolve";
import { runTag } from "../stages/tag";
import { replacePostMentions, type MentionInput } from "../write/mentions";
import { setPostOutcome } from "../write/posts";
import { finishRun, lastStepOutput, recordStep, startRun } from "../write/runs";

export const postProcess = inngest.createFunction(
  {
    id: "engine-post-process",
    name: "Process a post",
    triggers: [postIngested, postReprocess],
    concurrency: [{ limit: ENGINE.runtime.postConcurrency }, { key: "event.data.postId", limit: 1 }],
    retries: ENGINE.runtime.retries,
    onFailure: async ({ event, error }) => {
      const postId = (event.data.event.data as { postId?: string }).postId;
      if (postId) await failPostRun(postId, error.message);
    },
  },
  async ({ event, step }) => {
    const { postId } = event.data;
    const fromStage = "fromStage" in event.data ? (event.data.fromStage ?? null) : null;
    const requestedBy = "requestedBy" in event.data ? (event.data.requestedBy ?? null) : null;
    const trigger =
      event.name !== "engine/post.reprocess" ? "ingest" : requestedBy?.startsWith("backfill:") ? "backfill" : fromStage ? "rerun" : "reprocess";

    const runId = await step.run("start", () => startRun({ kind: "post", postId, trigger, fromStage, requestedBy }));

    const ctx = await step.run("context", async () => {
      const post = await prisma.ingestedPost.findUniqueOrThrow({
        where: { id: postId },
        select: { authorHandle: true, source: { select: { handle: true, homeCity: true } } },
      });
      return { handle: post.source?.handle ?? post.authorHandle, homeCity: post.source?.homeCity ?? null };
    });

    // Read, or reuse the last run's reading.
    const reuseRead = fromStage === "resolve" || fromStage === "tag";
    const read = reuseRead
      ? await step.run("load-read", async () => {
          const stored = await lastStepOutput<ReadResult>(postId, "read");
          if (!stored) throw new Error("No stored Read output to start from; re-run from Read instead");
          return stored;
        })
      : await step.run("read", () => recordStep(runId, "read", "", { postId }, () => runRead(runId, postId)));

    let reviewIds: string[];
    let touched: string[] = [];
    if (fromStage === "tag") {
      reviewIds = await step.run("load-mentions", async () =>
        (await prisma.review.findMany({ where: { ingestedPostId: postId }, select: { id: true } })).map((r) => r.id),
      );
    } else {
      const resolved: ResolveResult[] = [];
      for (const place of read.places) {
        resolved.push(
          await step.run(`resolve-${place.index}`, () =>
            recordStep(runId, "resolve", String(place.index), { place }, () =>
              runResolve(runId, postId, place, { ...ctx, locationName: read.locationName }),
            ),
          ),
        );
      }
      // Only a complete reading may remove mentions it didn't find.
      const complete = read.gateFailures.length === 0 && resolved.every((r) => r.outcome === "accepted");
      const written = await step.run("mentions", () =>
        recordStep(runId, "mentions", "", { accepted: resolved.filter((r) => r.outcome === "accepted").length, complete }, async () => {
          const mentions: MentionInput[] = read.places.flatMap((place, i) => {
            const r = resolved[i];
            return r.outcome === "accepted" && r.placeId && r.resolvedBy
              ? [{ read: place, placeId: r.placeId, resolvedBy: r.resolvedBy, confidence: r.confidence ?? place.confidenceValue }]
              : [];
          });
          return { output: await replacePostMentions({ runId, postId, sponsored: read.sponsored, mentions, removeStale: complete }) };
        }),
      );
      reviewIds = written.mentions.map((m) => m.reviewId);
      touched = written.touchedPlaceIds;
    }

    for (const reviewId of reviewIds) {
      await step.run(`tag-${reviewId}`, () => recordStep(runId, "tag", reviewId, { reviewId }, () => runTag(runId, reviewId)));
    }
    if (fromStage === "tag") {
      touched = await step.run("tagged-places", async () =>
        [...new Set((await prisma.review.findMany({ where: { id: { in: reviewIds } }, select: { placeId: true } })).map((r) => r.placeId))],
      );
    }

    const finished = await step.run("finish", async () => {
      const [waiting, primary] = await Promise.all([
        prisma.reviewItem.count({ where: { postId, status: "open", kind: "confirm_place" } }),
        prisma.review.findFirst({
          where: { ingestedPostId: postId },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          select: { place: { select: { googlePlaceId: true } } },
        }),
      ]);
      await setPostOutcome(postId, { status: waiting > 0 ? "unresolved" : "processed", primaryGooglePlaceId: primary?.place.googlePlaceId ?? null });
      await dismissOpenItems(postId, ["failed_run"], "a later run finished");
      return finishRun(runId);
    });

    if (touched.length > 0) {
      await step.sendEvent("place-changed", touched.map((placeId) => placeChanged.create({ placeId })));
    }
    return { runId, status: finished.status, costUsd: finished.costUsd, mentions: reviewIds.length, places: touched.length };
  },
);

/** After the last retry: the run fails and a person gets a review item. Nothing is dropped. */
async function failPostRun(postId: string, error: string) {
  const run = await prisma.engineRun.findFirst({
    where: { postId, status: "running" },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (run) await finishRun(run.id, error);
  await setPostOutcome(postId, { status: "failed", error });
  await openReviewItem({
    kind: "failed_run",
    postId,
    runId: run?.id ?? null,
    question: "The pipeline failed on this post after retries.",
    payload: { error },
    priority: 1,
  });
}
