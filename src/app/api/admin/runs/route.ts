import { NextRequest, NextResponse } from "next/server";
import type { Prisma, engine_run_status } from "@/generated/prisma";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const STATUSES: engine_run_status[] = ["queued", "running", "completed", "needs_review", "failed"];

/** Recent runs, newest first, filtered by status, source or place. */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const sp = req.nextUrl.searchParams;
  const status = STATUSES.find((s) => s === sp.get("status"));
  const source = sp.get("source");
  const placeId = sp.get("place");
  const kind = sp.get("kind") === "place" ? "place" : sp.get("kind") === "post" ? "post" : undefined;
  const where: Prisma.EngineRunWhereInput = {
    ...(status ? { status } : {}),
    ...(kind ? { kind } : {}),
    ...(source ? { post: { source: { handle: source } } } : {}),
    ...(placeId ? { place: { OR: [{ id: placeId }, { googlePlaceId: placeId }] } } : {}),
  };
  const runs = await prisma.engineRun.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: 100,
    select: {
      id: true, kind: true, status: true, trigger: true, costUsd: true, startedAt: true, finishedAt: true, error: true,
      post: { select: { id: true, canonicalPostId: true, authorHandle: true, media: true, caption: true } },
      place: { select: { id: true, name: true, googlePlaceId: true, photoRefs: true } },
      steps: { select: { stage: true, status: true } },
    },
  });
  const sources = await prisma.source.findMany({ select: { handle: true }, orderBy: { handle: "asc" } });
  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id,
      kind: r.kind,
      status: r.status,
      trigger: r.trigger,
      costUsd: r.costUsd,
      startedAt: r.startedAt,
      durationMs: r.finishedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : null,
      error: r.error,
      post: r.post
        ? {
            id: r.post.id,
            shortcode: r.post.canonicalPostId,
            handle: r.post.authorHandle,
            caption: r.post.caption?.slice(0, 120) ?? null,
            mediaUrl: (Array.isArray(r.post.media) ? (r.post.media as { url: string }[]) : [])[0]?.url ?? null,
          }
        : null,
      place: r.place
        ? { id: r.place.id, name: r.place.name, googlePlaceId: r.place.googlePlaceId, photoRef: (Array.isArray(r.place.photoRefs) ? (r.place.photoRefs as string[]) : [])[0] ?? null }
        : null,
      stages: [...new Set(r.steps.map((s) => s.stage))],
      stepsDone: r.steps.filter((s) => s.status === "completed" || s.status === "skipped").length,
      stepsTotal: r.steps.length,
    })),
    sources: sources.map((s) => s.handle),
  });
}
