import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { estimateReprocess, latestBackfill, recordBackfill, reprocessCandidates } from "@/lib/engine/backfill";
import { startReprocessAll } from "@/lib/engine/events";

/** A source by id or handle; "all" (or nothing) means every post. */
async function scopeOf(source: string | null) {
  if (!source || source === "all") return { sourceId: null, handle: null };
  const found = await prisma.source.findFirst({
    where: { OR: [{ id: source }, { handle: { equals: source.replace(/^@/, ""), mode: "insensitive" } }, { userId: source }] },
    select: { id: true, handle: true },
  });
  if (!found) throw new Error("Source not found");
  return { sourceId: found.id, handle: found.handle };
}

/**
 * What "Re-process all" would do (posts, estimate) and the latest backfill's
 * progress: for the scope, or with latest=any for whichever ran last.
 */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  try {
    const { sourceId, handle } = await scopeOf(req.nextUrl.searchParams.get("source"));
    const anyScope = req.nextUrl.searchParams.get("latest") === "any";
    const [{ postIds, reviewed }, latest] = await Promise.all([reprocessCandidates(sourceId), latestBackfill(anyScope ? undefined : sourceId)]);
    const latestHandle = latest?.sourceId
      ? (await prisma.source.findUnique({ where: { id: latest.sourceId }, select: { handle: true } }))?.handle ?? null
      : null;
    return NextResponse.json({
      scope: { sourceId, handle },
      reviewed,
      estimate: await estimateReprocess(postIds.length),
      latest: latest ? { ...latest, handle: latestHandle } : null,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}

/** Start one: record the request, then hand the posts to the runner. */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  const parsed = z.object({ source: z.string().nullable().optional() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const { sourceId } = await scopeOf(parsed.data.source ?? null);
    const running = await latestBackfill(sourceId);
    if (running && !running.finished && Date.now() - new Date(running.startedAt).getTime() < 6 * 3600_000) {
      return NextResponse.json({ error: "A re-process for this is still running" }, { status: 409 });
    }
    const { postIds } = await reprocessCandidates(sourceId);
    if (postIds.length === 0) return NextResponse.json({ error: "No posts to re-process" }, { status: 400 });
    const estimate = await estimateReprocess(postIds.length);
    // Recorded only once the runner has it, so a failed send can simply be retried.
    const backfillId = randomUUID();
    const queued = await startReprocessAll({ backfillId, requestedBy: user.id, sourceId });
    if (!queued) return NextResponse.json({ error: "The runner (Inngest) isn't reachable, so nothing started" }, { status: 503 });
    await recordBackfill({ id: backfillId, sourceId, posts: postIds.length, estimateUsd: estimate.totalUsd, actor: user.id });
    return NextResponse.json({ ok: true, backfillId, posts: postIds.length, estimate });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
