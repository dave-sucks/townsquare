/**
 * The one writer for posts (ingested_posts): what Sync stores and what the
 * pipeline learns about each post.
 */

import type { post_status, post_type, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type MediaItem = { url: string; type: "image" | "video" };

/**
 * The post's media, fixed: `images[]` when present (else `displayUrl`),
 * carousel children once each, deduped by URL path (Instagram repeats a
 * carousel's images in `images[]` and in `childPosts`).
 */
export function extractMedia(raw: unknown): MediaItem[] {
  const p = (raw ?? {}) as {
    type?: string;
    images?: string[];
    displayUrl?: string;
    childPosts?: { displayUrl?: string; type?: string }[];
  };
  const out: MediaItem[] = [];
  const seen = new Set<string>();
  const add = (url: string | undefined, type: "image" | "video") => {
    if (!url) return;
    const key = url.split("?")[0];
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ url, type });
  };
  const images = (p.images ?? []).filter(Boolean);
  if (images.length > 0) images.forEach((u) => add(u, "image"));
  else add(p.displayUrl, p.type === "Video" ? "video" : "image");
  for (const c of p.childPosts ?? []) add(c.displayUrl, c.type === "Video" ? "video" : "image");
  return out;
}

/** Store a scraped post (new or re-scraped), keyed by (platform, shortcode). */
export async function upsertSyncedPost(opts: {
  sourceId: string;
  importJobId: string;
  handle: string;
  raw: Record<string, unknown> & {
    shortCode?: string;
    id?: string;
    url?: string;
    caption?: string;
    timestamp?: string;
    likesCount?: number;
    ownerId?: string | number;
  };
}): Promise<{ id: string; created: boolean } | null> {
  const r = opts.raw;
  const canonicalPostId = String(r.shortCode ?? r.id ?? r.url ?? "");
  if (!canonicalPostId) return null;
  const existing = await prisma.ingestedPost.findUnique({
    where: { platform_canonicalPostId: { platform: "instagram", canonicalPostId } },
    select: { id: true },
  });
  const data = {
    url: r.url ?? `https://www.instagram.com/p/${canonicalPostId}/`,
    authorHandle: opts.handle,
    authorPlatformId: r.ownerId != null ? String(r.ownerId) : null,
    caption: r.caption ?? null,
    postedAt: r.timestamp ? new Date(r.timestamp) : null,
    likeCount: typeof r.likesCount === "number" ? r.likesCount : null,
    media: extractMedia(r) as unknown as Prisma.InputJsonValue,
    rawPayload: r as Prisma.InputJsonValue,
    sourceId: opts.sourceId,
  };
  if (existing) {
    await prisma.ingestedPost.update({ where: { id: existing.id }, data });
    return { id: existing.id, created: false };
  }
  const created = await prisma.ingestedPost.create({
    data: { ...data, platform: "instagram", importJobId: opts.importJobId, canonicalPostId, status: "new" },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

export async function setPostReading(postId: string, reading: { postType: post_type; sponsored: boolean }, runId: string) {
  await prisma.ingestedPost.update({
    where: { id: postId },
    data: {
      postType: reading.postType,
      isPlaceContent: reading.postType !== "not_a_place",
      isSponsored: reading.sponsored,
      lastRunId: runId,
    },
  });
}

/** The post's status for the import page: processed, unresolved (waiting on a person) or failed. */
export async function setPostOutcome(postId: string, opts: { status: post_status; primaryGooglePlaceId?: string | null; error?: string | null }) {
  await prisma.ingestedPost.update({
    where: { id: postId },
    data: {
      status: opts.status,
      ...(opts.primaryGooglePlaceId !== undefined ? { resolvedGooglePlaceId: opts.primaryGooglePlaceId } : {}),
      error: opts.error ?? null,
    },
  });
}

/** A reviewer's note on this post, for the next run to read (written in Phase 3). */
export async function latestReviewerNote(postId: string): Promise<string | null> {
  const row = await prisma.auditLog.findFirst({
    where: { entity: "post", entityId: postId, note: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { note: true },
  });
  return row?.note ?? null;
}
