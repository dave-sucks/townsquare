/**
 * The one writer for mentions. A mention is a `reviews` row, one per
 * (post, place), so every product surface that renders reviews shows it.
 *
 * Replacing a post's mentions never overwrites human work: a mention a
 * person confirmed (or placed by hand) keeps its place and status; the
 * pipeline only fills in fields it left empty.
 */

import type { mention_role, mention_verdict, Prisma, resolved_by } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getDefaultEmoji } from "@/lib/default-emoji";
import type { ReadPlaceResult } from "../stages/read";
import { diffFields, writeAudit } from "./audit";
import type { MediaItem } from "./posts";

export type MentionInput = {
  read: ReadPlaceResult;
  placeId: string;
  resolvedBy: resolved_by;
  confidence: number;
};

export type WrittenMention = { reviewId: string; placeId: string; index: number; protected: boolean };

const isProtected = (r: { status: string | null; resolvedBy: string | null }) =>
  r.status === "confirmed" || r.resolvedBy === "human";

const toTypes = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export async function replacePostMentions(opts: {
  runId: string;
  postId: string;
  sponsored: boolean;
  mentions: MentionInput[];
}): Promise<{ mentions: WrittenMention[]; touchedPlaceIds: string[]; removed: number }> {
  const post = await prisma.ingestedPost.findUniqueOrThrow({
    where: { id: opts.postId },
    select: {
      id: true,
      canonicalPostId: true,
      url: true,
      caption: true,
      likeCount: true,
      postedAt: true,
      media: true,
      authorHandle: true,
      source: { select: { userId: true } },
    },
  });
  const creator =
    (post.source?.userId && (await prisma.user.findUnique({ where: { id: post.source.userId }, select: { id: true, isInstagramImport: true } }))) ||
    (await prisma.user.findFirst({ where: { instagramHandle: { equals: post.authorHandle, mode: "insensitive" } }, select: { id: true, isInstagramImport: true } }));
  if (!creator) throw new Error(`No creator user for @${post.authorHandle}`);

  const shortcode = post.canonicalPostId;
  const media = (Array.isArray(post.media) ? post.media : []) as MediaItem[];
  const mediaType = media.length > 1 ? "carousel" : media[0]?.type ?? "image";

  const existing = await prisma.review.findMany({
    where: { OR: [{ ingestedPostId: post.id }, { instagramPostId: shortcode }] },
    select: {
      id: true, placeId: true, status: true, resolvedBy: true, excerpt: true, dishes: true, verdict: true,
      creatorScore: true, creatorScoreMax: true, role: true, confidence: true, isSponsored: true, note: true,
    },
  });
  const byPlace = new Map(existing.map((r) => [r.placeId, r]));

  // One mention per place (Read can name a place twice in a roundup).
  const inputs = [...new Map(opts.mentions.map((m) => [m.placeId, m])).values()];
  const written: WrittenMention[] = [];

  for (const m of inputs) {
    const r = m.read;
    const agentFields = {
      excerpt: r.excerpt || null,
      dishes: r.dishes as unknown as Prisma.InputJsonValue,
      verdict: r.verdict as mention_verdict,
      creatorScore: r.scoreValue,
      creatorScoreMax: r.scoreOutOf,
      role: r.role as mention_role,
      isSponsored: opts.sponsored,
    };
    const prior = byPlace.get(m.placeId);

    if (prior && isProtected(prior)) {
      // Human work stays; fill only what the pipeline never set.
      const fill: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(agentFields)) {
        if ((prior as Record<string, unknown>)[k] == null && v != null) fill[k] = v;
      }
      if (Object.keys(fill).length > 0) {
        await prisma.review.update({ where: { id: prior.id }, data: { ...fill, ingestedPostId: post.id } });
        await writeAudit({ entity: "review", entityId: prior.id, action: "fill", actor: "read", runId: opts.runId, fieldChanges: diffFields(prior, fill) });
      }
      written.push({ reviewId: prior.id, placeId: m.placeId, index: r.index, protected: true });
      continue;
    }

    const data = {
      ...agentFields,
      userId: creator.id,
      placeId: m.placeId,
      source: "instagram" as const,
      instagramPostId: shortcode,
      instagramShortcode: shortcode,
      instagramUrl: post.url,
      socialPostCaption: post.caption,
      socialPostMediaUrl: media[0]?.url ?? null,
      socialPostMediaType: mediaType,
      socialPostLikes: post.likeCount,
      socialPostPostedAt: post.postedAt,
      note: r.excerpt || (post.caption ? post.caption.slice(0, 500) : null),
      ingestedPostId: post.id,
      confidence: m.confidence,
      status: "auto" as const,
      resolvedBy: m.resolvedBy,
    };
    if (prior) {
      await prisma.review.update({ where: { id: prior.id }, data });
      const changes = diffFields(prior, { ...agentFields, confidence: m.confidence });
      if (Object.keys(changes).length) {
        await writeAudit({ entity: "review", entityId: prior.id, action: "update", actor: "read", runId: opts.runId, fieldChanges: changes });
      }
      written.push({ reviewId: prior.id, placeId: m.placeId, index: r.index, protected: false });
    } else {
      const created = await prisma.review.create({ data, select: { id: true } });
      await writeAudit({
        entity: "review",
        entityId: created.id,
        action: "create",
        actor: m.resolvedBy === "agent" ? "resolve" : "read",
        runId: opts.runId,
        fieldChanges: { placeId: { from: null, to: m.placeId }, excerpt: { from: null, to: data.excerpt } },
      });
      written.push({ reviewId: created.id, placeId: m.placeId, index: r.index, protected: false });
    }
  }

  // Mentions this run didn't find go, unless a person made them.
  const keep = new Set(written.map((w) => w.reviewId));
  const stale = existing.filter((r) => !keep.has(r.id));
  let removed = 0;
  for (const r of stale) {
    if (isProtected(r)) {
      written.push({ reviewId: r.id, placeId: r.placeId, index: -1, protected: true });
      continue;
    }
    await prisma.photo.deleteMany({ where: { reviewId: r.id } });
    await prisma.review.delete({ where: { id: r.id } });
    await writeAudit({ entity: "review", entityId: r.id, action: "delete", actor: "read", runId: opts.runId, fieldChanges: { placeId: { from: r.placeId, to: null } } });
    removed++;
  }

  // One activity per post, at its primary place.
  const primary = written.find((w) => w.index >= 0 && inputs.find((m) => m.placeId === w.placeId)?.read.role === "primary") ?? written[0];
  const dedupeKey = `review_import_${shortcode}`;
  if (primary) {
    await prisma.activity.upsert({
      where: { dedupeKey },
      update: { placeId: primary.placeId, actorId: creator.id },
      create: { actorId: creator.id, type: "REVIEW_CREATED", placeId: primary.placeId, dedupeKey, createdAt: post.postedAt ?? new Date() },
    });
  } else {
    await prisma.activity.deleteMany({ where: { dedupeKey } });
  }

  // An imported creator's saves mirror their mentions.
  const mentionPlaces = new Set(written.map((w) => w.placeId));
  for (const placeId of mentionPlaces) {
    const place = await prisma.place.findUnique({ where: { id: placeId }, select: { primaryType: true, types: true } });
    await prisma.savedPlace.upsert({
      where: { userId_placeId: { userId: creator.id, placeId } },
      update: {},
      create: { userId: creator.id, placeId, hasBeen: false, emoji: getDefaultEmoji(place?.primaryType ?? null, toTypes(place?.types)) },
    });
  }
  if (creator.isInstagramImport) {
    for (const r of stale) {
      if (mentionPlaces.has(r.placeId)) continue;
      const left = await prisma.review.count({ where: { userId: creator.id, placeId: r.placeId } });
      if (left === 0) await prisma.savedPlace.deleteMany({ where: { userId: creator.id, placeId: r.placeId } });
    }
  }

  const touched = new Set([...mentionPlaces, ...stale.map((r) => r.placeId)]);
  return { mentions: written.filter((w) => w.index >= 0), touchedPlaceIds: [...touched], removed };
}
