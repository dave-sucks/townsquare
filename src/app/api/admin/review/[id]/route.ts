import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { saveMentionEdits } from "@/lib/engine/write/mentions";
import { writeAudit } from "@/lib/engine/write/audit";
import { saveExample } from "@/lib/engine/examples";
import { refreshPlaces, reprocessPost } from "@/lib/engine/events";
import { refreshPostStatus } from "@/lib/engine/review";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.discriminatedUnion("action", [
  /** Confirm place: the listing(s) the post meant. More than one when it names several branches. */
  z.object({ action: z.literal("confirm_places"), googlePlaceIds: z.array(z.string()).min(1), note: z.string().nullable().optional() }),
  z.object({ action: z.literal("dismiss"), note: z.string().nullable().optional() }),
  z.object({ action: z.literal("rerun"), note: z.string().nullable().optional() }),
]);

type ConfirmPayload = {
  place?: { name?: string; excerpt?: string; verdict?: string; dishes?: { name: string; sentiment: "positive" | "neutral" | "negative" }[]; role?: "primary" | "list_item" | "passing"; areaHint?: string | null };
  candidates?: { id: string; googlePlaceId: string; name: string }[];
  agent?: { choice?: string; confidence?: string } | null;
};

export async function POST(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  const body = parsed.data;

  const item = await prisma.reviewItem.findUnique({ where: { id } });
  if (!item || item.status !== "open") return NextResponse.json({ error: "This item is already closed" }, { status: 409 });

  try {
    if (body.action === "confirm_places") {
      if (item.kind !== "confirm_place" || !item.postId) return NextResponse.json({ error: "Not a place confirmation" }, { status: 400 });
      const payload = (item.payload ?? {}) as ConfirmPayload;
      const p = payload.place ?? {};
      const { touchedPlaceIds } = await saveMentionEdits({
        postId: item.postId,
        actor: user.id,
        note: body.note,
        edits: body.googlePlaceIds.map((googlePlaceId) => ({
          googlePlaceId,
          excerpt: p.excerpt ?? null,
          verdict: (p.verdict as "loved" | "liked" | "mixed" | "disliked" | "none" | undefined) ?? null,
          dishes: p.dishes ?? [],
          role: p.role,
        })),
      });
      // Resolve learns from the pick: confirmed when it matches the agent's, corrected otherwise.
      const agentPick = payload.candidates?.find((c) => c.id === payload.agent?.choice)?.googlePlaceId;
      await saveExample({
        agentKey: "resolve",
        postId: item.postId,
        input: { name: p.name, excerpt: p.excerpt, areaHint: p.areaHint, candidates: payload.candidates },
        expected: { googlePlaceIds: body.googlePlaceIds },
        source: agentPick && body.googlePlaceIds.length === 1 && body.googlePlaceIds[0] === agentPick ? "human_confirmed" : "human_corrected",
        note: body.note,
        createdBy: user.id,
      });
      await prisma.reviewItem.update({
        where: { id },
        data: { status: "resolved", resolvedBy: user.id, resolvedAt: new Date(), resolution: { action: "confirm_places", googlePlaceIds: body.googlePlaceIds, note: body.note ?? null } },
      });
      await refreshPostStatus(item.postId);
      await refreshPlaces(touchedPlaceIds);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "rerun" && item.postId) {
      if (body.note) await writeAudit({ entity: "post", entityId: item.postId, action: "rerun", actor: user.id, note: body.note });
      await reprocessPost(item.postId, { requestedBy: user.id });
    }
    await prisma.reviewItem.update({
      where: { id },
      data: { status: body.action === "dismiss" ? "dismissed" : "resolved", resolvedBy: user.id, resolvedAt: new Date(), resolution: { action: body.action, note: body.note ?? null } },
    });
    // A dismissed place confirmation on a post with a note: the next Read of the post sees why.
    if (body.note && item.postId && body.action === "dismiss") {
      await writeAudit({ entity: "post", entityId: item.postId, action: "dismiss_review_item", actor: user.id, note: body.note });
    }
    if (item.postId) await refreshPostStatus(item.postId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
