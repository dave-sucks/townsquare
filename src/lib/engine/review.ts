/**
 * Review items: results waiting for a human. The pipeline opens them; the
 * Review queue (Phase 3) resolves them.
 */

import type { Prisma, review_item_kind } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export async function openReviewItem(opts: {
  kind: review_item_kind;
  postId?: string | null;
  reviewId?: string | null;
  runId?: string | null;
  question: string;
  payload?: unknown;
  priority?: number;
}) {
  // One open item per post, kind and question: a re-run replaces it.
  await prisma.reviewItem.updateMany({
    where: { postId: opts.postId ?? undefined, kind: opts.kind, question: opts.question, status: "open" },
    data: { status: "dismissed", resolution: { reason: "superseded by a newer run" }, resolvedAt: new Date(), resolvedBy: "engine" },
  });
  return prisma.reviewItem.create({
    data: {
      kind: opts.kind,
      postId: opts.postId ?? null,
      reviewId: opts.reviewId ?? null,
      runId: opts.runId ?? null,
      question: opts.question,
      payload: (opts.payload ?? undefined) as Prisma.InputJsonValue | undefined,
      priority: opts.priority ?? 0,
    },
    select: { id: true },
  });
}

/** A post's earlier open items of these kinds no longer apply after a fresh run. */
export async function dismissOpenItems(postId: string, kinds: review_item_kind[], reason: string) {
  await prisma.reviewItem.updateMany({
    where: { postId, kind: { in: kinds }, status: "open" },
    data: { status: "dismissed", resolution: { reason }, resolvedAt: new Date(), resolvedBy: "engine" },
  });
}

/** A post waits on a person while it has a place to confirm (the pipeline's rule); otherwise it's processed. */
export async function refreshPostStatus(postId: string) {
  const post = await prisma.ingestedPost.findUnique({ where: { id: postId }, select: { status: true } });
  if (!post || post.status === "failed") return;
  const waiting = await prisma.reviewItem.count({ where: { postId, status: "open", kind: "confirm_place" } });
  const status = waiting > 0 ? "unresolved" : "processed";
  if (status !== post.status) await prisma.ingestedPost.update({ where: { id: postId }, data: { status } });
}
