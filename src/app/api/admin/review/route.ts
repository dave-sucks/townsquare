import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import type { review_item_kind } from "@/generated/prisma";

const KINDS: review_item_kind[] = ["confirm_place", "check_not_a_place", "fix_extraction", "failed_run", "spot_check", "confirm_example"];

/** Open review items, highest priority and oldest first, with counts per kind. */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const kindParam = req.nextUrl.searchParams.get("kind");
  const kind = KINDS.includes(kindParam as review_item_kind) ? (kindParam as review_item_kind) : undefined;

  const [items, counts] = await Promise.all([
    prisma.reviewItem.findMany({
      where: { status: "open", ...(kind ? { kind } : {}) },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 200,
      select: {
        id: true, kind: true, question: true, createdAt: true, priority: true,
        post: { select: { id: true, canonicalPostId: true, media: true, authorHandle: true, caption: true } },
      },
    }),
    prisma.reviewItem.groupBy({ by: ["kind"], where: { status: "open" }, _count: true }),
  ]);

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      kind: i.kind,
      question: i.question,
      createdAt: i.createdAt,
      postId: i.post?.id ?? null,
      shortcode: i.post?.canonicalPostId ?? null,
      handle: i.post?.authorHandle ?? null,
      mediaUrl: (Array.isArray(i.post?.media) ? (i.post!.media as { url: string }[]) : [])[0]?.url ?? null,
      caption: i.post?.caption?.slice(0, 140) ?? null,
    })),
    counts: Object.fromEntries(counts.map((c) => [c.kind, c._count])),
    total: counts.reduce((n, c) => n + c._count, 0),
  });
}
