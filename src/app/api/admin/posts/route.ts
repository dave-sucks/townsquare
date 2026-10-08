import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const STATUSES = ["needs_review", "failed", "not_a_place", "unread", "completed"] as const;
type PostStatus = (typeof STATUSES)[number];

const PAGE = 50;

/**
 * History: every post, newest first, with where it stands and what the
 * engine last did with it. Filter by creator, status or a place it mentions.
 */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const sp = req.nextUrl.searchParams;
  const creator = sp.get("creator")?.replace(/^@/, "");
  const status = STATUSES.find((s) => s === sp.get("status"));
  const place = sp.get("place");
  const offset = Math.max(0, Number(sp.get("offset")) || 0);

  const and: Prisma.IngestedPostWhereInput[] = [];
  if (creator) and.push({ source: { OR: [{ id: creator }, { handle: { equals: creator, mode: "insensitive" } }] } });
  if (place) and.push({ mentions: { some: { place: { OR: [{ id: place }, { googlePlaceId: place }] } } } });
  const open = { some: { status: "open" as const } };
  if (status === "needs_review") and.push({ reviewItems: open });
  if (status === "failed") and.push({ status: "failed", reviewItems: { none: { status: "open" } } });
  if (status === "not_a_place") and.push({ postType: "not_a_place" });
  if (status === "unread") and.push({ lastRunId: null });
  if (status === "completed")
    and.push({ lastRunId: { not: null }, status: { not: "failed" }, reviewItems: { none: { status: "open" } }, OR: [{ postType: null }, { postType: { not: "not_a_place" } }] });
  const where: Prisma.IngestedPostWhereInput = and.length ? { AND: and } : {};

  const [rows, total, placeRow] = await Promise.all([
    prisma.ingestedPost.findMany({
      where,
      orderBy: [{ postedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: offset,
      take: PAGE,
      select: {
        id: true, canonicalPostId: true, url: true, caption: true, postedAt: true, createdAt: true, postType: true, status: true,
        authorHandle: true, lastRunId: true,
        source: { select: { handle: true } },
        mentions: { select: { place: { select: { name: true } } }, orderBy: [{ role: "asc" }, { createdAt: "asc" }], take: 20 },
        reviewItems: { where: { status: "open" }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }], select: { id: true, kind: true, question: true } },
      },
    }),
    prisma.ingestedPost.count({ where }),
    place ? prisma.place.findFirst({ where: { OR: [{ id: place }, { googlePlaceId: place }] }, select: { name: true } }) : null,
  ]);

  const runIds = rows.map((r) => r.lastRunId).filter((id): id is string => !!id);
  const runs = await prisma.engineRun.findMany({ where: { id: { in: runIds } }, select: { id: true, startedAt: true, costUsd: true, trigger: true } });
  const runById = new Map(runs.map((r) => [r.id, r]));

  const stand = (p: (typeof rows)[number]): PostStatus => {
    if (p.reviewItems.length) return "needs_review";
    if (p.status === "failed") return "failed";
    if (p.postType === "not_a_place") return "not_a_place";
    return p.lastRunId ? "completed" : "unread";
  };

  return NextResponse.json({
    total,
    place: placeRow,
    hasMore: offset + rows.length < total,
    posts: rows.map((p) => ({
      id: p.id,
      shortcode: p.canonicalPostId,
      url: p.url,
      handle: p.source?.handle ?? p.authorHandle,
      caption: p.caption?.replace(/\s+/g, " ").trim().slice(0, 160) ?? null,
      postedAt: p.postedAt,
      importedAt: p.createdAt,
      status: stand(p),
      places: p.mentions.map((m) => m.place.name),
      questions: p.reviewItems,
      lastRun: p.lastRunId ? runById.get(p.lastRunId) ?? null : null,
    })),
  });
}
