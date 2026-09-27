import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { hydratePlaceRows } from "@/lib/places/query";
import { markNotAPlace, saveMentionEdits } from "@/lib/engine/write/mentions";
import { writeAudit } from "@/lib/engine/write/audit";
import { refreshPlaces, reprocessPost } from "@/lib/engine/events";
import { refreshPostStatus } from "@/lib/engine/review";

type Params = { params: Promise<{ id: string }> };

/** A post with its mentions and open review items: what the mention editor shows. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  const post = await prisma.ingestedPost.findFirst({
    where: { OR: [{ id }, { canonicalPostId: id }] },
    select: {
      id: true, canonicalPostId: true, url: true, caption: true, postedAt: true, postType: true, status: true,
      isSponsored: true, media: true, authorHandle: true, rawPayload: true, lastRunId: true,
      source: { select: { id: true, handle: true, user: { select: { username: true, profileImageUrl: true } } } },
    },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const mentions = await prisma.review.findMany({
    where: { ingestedPostId: post.id },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, placeId: true, excerpt: true, verdict: true, dishes: true, role: true, status: true, resolvedBy: true, confidence: true,
      creatorScore: true, creatorScoreMax: true,
      reviewTags: { select: { source: true, tag: { select: { slug: true, displayName: true } } } },
    },
  });
  const rows = await hydratePlaceRows([...new Set(mentions.map((m) => m.placeId))], { userId: user.id, scope: { kind: "all" } });
  const rowById = new Map(rows.map((r) => [r.placeId, r]));
  const items = await prisma.reviewItem.findMany({
    where: { postId: post.id, status: "open" },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    select: { id: true, kind: true, question: true, payload: true, createdAt: true },
  });
  const raw = (post.rawPayload ?? {}) as { locationName?: string };

  return NextResponse.json({
    post: {
      id: post.id,
      shortcode: post.canonicalPostId,
      url: post.url,
      caption: post.caption,
      postedAt: post.postedAt,
      postType: post.postType,
      status: post.status,
      isSponsored: post.isSponsored,
      mediaUrl: (Array.isArray(post.media) ? (post.media as { url: string }[]) : [])[0]?.url ?? null,
      handle: post.source?.handle ?? post.authorHandle,
      avatar: post.source?.user?.profileImageUrl ?? null,
      locationName: raw.locationName ?? null,
      lastRunId: post.lastRunId,
    },
    mentions: mentions.map((m) => ({
      reviewId: m.id,
      place: rowById.get(m.placeId) ?? null,
      excerpt: m.excerpt,
      verdict: m.verdict,
      dishes: Array.isArray(m.dishes) ? m.dishes : [],
      role: m.role,
      status: m.status,
      resolvedBy: m.resolvedBy,
      confidence: m.confidence,
      score: m.creatorScore != null ? `${m.creatorScore}${m.creatorScoreMax ? `/${m.creatorScoreMax}` : ""}` : null,
      tags: m.reviewTags.map((t) => ({ slug: t.tag.slug, displayName: t.tag.displayName, source: t.source })),
    })),
    reviewItems: items,
  });
}

const dishSchema = z.object({ name: z.string().min(1), sentiment: z.enum(["positive", "neutral", "negative"]) });
const editSchema = z.object({
  reviewId: z.string().optional(),
  googlePlaceId: z.string().optional(),
  excerpt: z.string().nullable().optional(),
  verdict: z.enum(["loved", "liked", "mixed", "disliked", "none"]).nullable().optional(),
  dishes: z.array(dishSchema).optional(),
  tagSlugs: z.array(z.string()).optional(),
  role: z.enum(["primary", "list_item", "passing"]).optional(),
  remove: z.boolean().optional(),
});
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), edits: z.array(editSchema), note: z.string().nullable().optional(), resolveItemIds: z.array(z.string()).optional() }),
  z.object({ action: z.literal("not_a_place"), note: z.string().nullable().optional() }),
  z.object({ action: z.literal("rerun"), fromStage: z.enum(["read", "resolve", "tag"]).optional(), note: z.string().nullable().optional() }),
]);

/** Save edits, mark not a place, or re-run: every change is audited and becomes an example. */
export async function POST(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  const { id: key } = await params;
  const found = await prisma.ingestedPost.findFirst({ where: { OR: [{ id: key }, { canonicalPostId: key }] }, select: { id: true } });
  if (!found) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  const id = found.id;
  const parsed = actionSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  const body = parsed.data;

  try {
    if (body.action === "save") {
      const { touchedPlaceIds } = await saveMentionEdits({ postId: id, edits: body.edits, actor: user.id, note: body.note });
      if (body.resolveItemIds?.length) {
        await prisma.reviewItem.updateMany({
          where: { id: { in: body.resolveItemIds }, postId: id, status: "open" },
          data: { status: "resolved", resolvedBy: user.id, resolvedAt: new Date(), resolution: { action: "edited", note: body.note ?? null } },
        });
      }
      await refreshPostStatus(id);
      await refreshPlaces(touchedPlaceIds);
      return NextResponse.json({ ok: true, touchedPlaceIds });
    }
    if (body.action === "not_a_place") {
      const { touchedPlaceIds } = await markNotAPlace({ postId: id, actor: user.id, note: body.note });
      // The admin answered "is this a place?"; questions about its places no longer apply.
      const closed = { resolvedBy: user.id, resolvedAt: new Date(), resolution: { action: "not_a_place", note: body.note ?? null } };
      await prisma.reviewItem.updateMany({ where: { postId: id, status: "open", kind: { in: ["check_not_a_place", "fix_extraction"] } }, data: { status: "resolved", ...closed } });
      await prisma.reviewItem.updateMany({ where: { postId: id, status: "open", kind: { in: ["confirm_place", "failed_run", "spot_check"] } }, data: { status: "dismissed", ...closed } });
      await refreshPostStatus(id);
      await refreshPlaces(touchedPlaceIds);
      return NextResponse.json({ ok: true, touchedPlaceIds });
    }
    // A re-run can carry a note: the next Read sees it.
    if (body.note) await writeAudit({ entity: "post", entityId: id, action: "rerun", actor: user.id, note: body.note });
    const sent = await reprocessPost(id, { requestedBy: user.id, fromStage: body.fromStage });
    return NextResponse.json({ ok: sent, queued: sent }, { status: sent ? 200 : 503 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
