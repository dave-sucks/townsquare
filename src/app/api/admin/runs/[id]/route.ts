import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { refreshPlaces, reprocessPost } from "@/lib/engine/events";

type Params = { params: Promise<{ id: string }> };

/** One run with every step: input, output, model, tokens, cost, time. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;
  const run = await prisma.engineRun.findUnique({
    where: { id: (await params).id },
    include: {
      steps: { orderBy: { startedAt: "asc" }, include: { agentVersion: { select: { agentKey: true, version: true } } } },
      post: { select: { id: true, canonicalPostId: true, url: true, caption: true, postedAt: true, authorHandle: true, media: true, postType: true } },
      place: { select: { id: true, name: true, googlePlaceId: true, formattedAddress: true } },
    },
  });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  return NextResponse.json({ run });
}

/** Re-run from a stage: earlier stages reuse this post's stored output. */
export async function POST(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  const parsed = z.object({ fromStage: z.enum(["read", "resolve", "tag", "aggregate", "summarize"]) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  const run = await prisma.engineRun.findUnique({ where: { id: (await params).id }, select: { postId: true, placeId: true } });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  const { fromStage } = parsed.data;
  let queued = false;
  if (fromStage === "aggregate" || fromStage === "summarize") {
    // Place stages: refresh the run's place, or every place the post mentions.
    const placeIds = run.placeId
      ? [run.placeId]
      : (await prisma.review.findMany({ where: { ingestedPostId: run.postId! }, select: { placeId: true } })).map((r) => r.placeId);
    queued = await refreshPlaces([...new Set(placeIds)], { force: fromStage === "summarize" });
  } else if (run.postId) {
    queued = await reprocessPost(run.postId, { requestedBy: user.id, fromStage: fromStage === "read" ? undefined : fromStage });
  }
  return NextResponse.json({ ok: queued, queued }, { status: queued ? 200 : 503 });
}
