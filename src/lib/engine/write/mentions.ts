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
import { saveExample } from "../examples";
import type { ReadPlaceResult } from "../stages/read";
import { diffFields, writeAudit } from "./audit";
import { ensurePlace } from "./places";
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
  /**
   * Remove the post's mentions this run didn't find. Only a complete reading
   * may: every place resolved and no rule broken. Otherwise a place waiting
   * for a person, or one Read fumbled, would lose a mention that was right.
   */
  removeStale: boolean;
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

  // Mentions this run didn't find go, unless a person made them or the
  // reading was incomplete.
  const found = new Set(written.map((w) => w.reviewId));
  const unfound = existing.filter((r) => !found.has(r.id));
  const stale: typeof unfound = [];
  let removed = 0;
  for (const r of unfound) {
    if (isProtected(r) || !opts.removeStale) {
      written.push({ reviewId: r.id, placeId: r.placeId, index: -1, protected: isProtected(r) });
      continue;
    }
    stale.push(r);
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

// ── A person's edits ────────────────────────────────────────────────────────

export type MentionEdit = {
  /** An existing mention; omit to add a place to the post. */
  reviewId?: string;
  /** The place (new mention, or "Change place"). */
  googlePlaceId?: string;
  excerpt?: string | null;
  verdict?: mention_verdict | null;
  dishes?: { name: string; sentiment: "positive" | "neutral" | "negative" }[];
  /** The mention's whole tag set after the edit (slugs). */
  tagSlugs?: string[];
  role?: mention_role;
  remove?: boolean;
};

type EditablePost = {
  id: string;
  canonicalPostId: string;
  url: string;
  caption: string | null;
  likeCount: number | null;
  postedAt: Date | null;
  media: unknown;
  authorHandle: string;
  postType: string | null;
  isSponsored: boolean | null;
  rawPayload: unknown;
  sourceId: string | null;
};

async function loadEditablePost(postId: string) {
  const post = await prisma.ingestedPost.findUniqueOrThrow({
    where: { id: postId },
    select: {
      id: true, canonicalPostId: true, url: true, caption: true, likeCount: true, postedAt: true, media: true,
      authorHandle: true, postType: true, isSponsored: true, rawPayload: true, sourceId: true,
      source: { select: { userId: true } },
    },
  });
  const creator =
    (post.source?.userId && (await prisma.user.findUnique({ where: { id: post.source.userId }, select: { id: true, isInstagramImport: true } }))) ||
    (await prisma.user.findFirst({ where: { instagramHandle: { equals: post.authorHandle, mode: "insensitive" } }, select: { id: true, isInstagramImport: true } }));
  if (!creator) throw new Error(`No creator user for @${post.authorHandle}`);
  return { post: post as EditablePost, creator };
}

/** A post's mentions as Read would have written them: the shape examples store. */
async function readingOf(postId: string) {
  const mentions = await prisma.review.findMany({
    where: { ingestedPostId: postId },
    orderBy: { createdAt: "asc" },
    select: { excerpt: true, verdict: true, dishes: true, role: true, place: { select: { name: true, googlePlaceId: true } } },
  });
  return mentions.map((m) => ({
    name: m.place.name,
    googlePlaceId: m.place.googlePlaceId,
    excerpt: m.excerpt,
    verdict: m.verdict,
    dishes: m.dishes,
    role: m.role,
  }));
}

const readExampleInput = (post: EditablePost) => ({
  caption: post.caption ?? "",
  locationTag: ((post.rawPayload ?? {}) as { locationName?: string }).locationName ?? null,
  handle: post.authorHandle,
});

/** Keep the post's one activity and the creator's saves in step with its mentions. */
async function syncPostSideEffects(post: EditablePost, creator: { id: string; isInstagramImport: boolean }, removedPlaceIds: string[]) {
  const mentions = await prisma.review.findMany({
    where: { ingestedPostId: post.id },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { placeId: true, place: { select: { primaryType: true, types: true, googlePlaceId: true } } },
  });
  const dedupeKey = `review_import_${post.canonicalPostId}`;
  if (mentions[0]) {
    await prisma.activity.upsert({
      where: { dedupeKey },
      update: { placeId: mentions[0].placeId, actorId: creator.id },
      create: { actorId: creator.id, type: "REVIEW_CREATED", placeId: mentions[0].placeId, dedupeKey, createdAt: post.postedAt ?? new Date() },
    });
  } else {
    await prisma.activity.deleteMany({ where: { dedupeKey } });
  }
  for (const m of mentions) {
    await prisma.savedPlace.upsert({
      where: { userId_placeId: { userId: creator.id, placeId: m.placeId } },
      update: {},
      create: { userId: creator.id, placeId: m.placeId, hasBeen: false, emoji: getDefaultEmoji(m.place.primaryType, toTypes(m.place.types)) },
    });
  }
  if (creator.isInstagramImport) {
    for (const placeId of removedPlaceIds) {
      if (mentions.some((m) => m.placeId === placeId)) continue;
      const left = await prisma.review.count({ where: { userId: creator.id, placeId } });
      if (left === 0) await prisma.savedPlace.deleteMany({ where: { userId: creator.id, placeId } });
    }
  }
  await prisma.ingestedPost.update({
    where: { id: post.id },
    data: {
      status: "processed",
      resolvedGooglePlaceId: mentions[0]?.place.googlePlaceId ?? null,
      ...(mentions.length > 0 && post.postType === "not_a_place" ? { postType: mentions.length > 1 ? "roundup" : "single_place", isPlaceContent: true } : {}),
    },
  });
}

/**
 * Save a person's edits to a post's mentions. Every edited or added mention
 * becomes human work (confirmed, resolved by human), each change leaves an
 * audit row, and the corrections are saved as examples for Read, Resolve
 * and Tag. Returns the places whose mentions changed.
 */
export async function saveMentionEdits(opts: {
  postId: string;
  edits: MentionEdit[];
  actor: string;
  note?: string | null;
}): Promise<{ touchedPlaceIds: string[] }> {
  const { post, creator } = await loadEditablePost(opts.postId);
  const before = await readingOf(post.id);
  const media = (Array.isArray(post.media) ? post.media : []) as MediaItem[];
  const touched = new Set<string>();
  const removed: string[] = [];

  for (const e of opts.edits) {
    if (e.remove && e.reviewId) {
      const r = await prisma.review.findUnique({ where: { id: e.reviewId }, select: { id: true, placeId: true } });
      if (!r) continue;
      await prisma.photo.deleteMany({ where: { reviewId: r.id } });
      await prisma.review.delete({ where: { id: r.id } });
      await writeAudit({ entity: "review", entityId: r.id, action: "delete", actor: opts.actor, note: opts.note, fieldChanges: { placeId: { from: r.placeId, to: null } } });
      touched.add(r.placeId);
      removed.push(r.placeId);
      continue;
    }

    let placeId: string | null = null;
    if (e.googlePlaceId) placeId = (await ensurePlace(e.googlePlaceId, { actor: opts.actor })).id;

    const fields = {
      ...(e.excerpt !== undefined ? { excerpt: e.excerpt || null, note: e.excerpt || null } : {}),
      ...(e.verdict !== undefined ? { verdict: e.verdict } : {}),
      ...(e.dishes !== undefined ? { dishes: e.dishes as unknown as Prisma.InputJsonValue } : {}),
      ...(e.role !== undefined ? { role: e.role } : {}),
      status: "confirmed" as const,
      resolvedBy: "human" as const,
    };

    let reviewId: string;
    if (e.reviewId) {
      const prior = await prisma.review.findUniqueOrThrow({
        where: { id: e.reviewId },
        select: { id: true, placeId: true, excerpt: true, verdict: true, dishes: true, role: true, status: true, resolvedBy: true, place: { select: { googlePlaceId: true, name: true } } },
      });
      const moved = placeId && placeId !== prior.placeId;
      if (moved) {
        const clash = await prisma.review.findFirst({ where: { instagramPostId: post.canonicalPostId, placeId: placeId!, id: { not: prior.id } }, select: { id: true } });
        if (clash) throw new Error("This post already has a mention at that place");
      }
      await prisma.review.update({ where: { id: prior.id }, data: { ...fields, ...(moved ? { placeId: placeId! } : {}) } });
      await writeAudit({
        entity: "review",
        entityId: prior.id,
        action: "edit",
        actor: opts.actor,
        note: opts.note,
        fieldChanges: diffFields(prior, { ...fields, ...(moved ? { placeId } : {}) }),
      });
      touched.add(prior.placeId);
      if (moved) {
        touched.add(placeId!);
        removed.push(prior.placeId);
        await saveExample({
          agentKey: "resolve",
          postId: post.id,
          reviewId: prior.id,
          input: { name: prior.place.name, excerpt: prior.excerpt, caption: post.caption?.slice(0, 600) ?? "" },
          expected: { googlePlaceId: e.googlePlaceId, wrongGooglePlaceId: prior.place.googlePlaceId },
          source: "human_corrected",
          note: opts.note,
          createdBy: opts.actor,
        });
      }
      reviewId = prior.id;
    } else {
      if (!placeId) throw new Error("A new mention needs a place");
      const created = await prisma.review.create({
        data: {
          ...fields,
          userId: creator.id,
          placeId,
          source: "instagram",
          instagramPostId: post.canonicalPostId,
          instagramShortcode: post.canonicalPostId,
          instagramUrl: post.url,
          socialPostCaption: post.caption,
          socialPostMediaUrl: media[0]?.url ?? null,
          socialPostMediaType: media.length > 1 ? "carousel" : media[0]?.type ?? "image",
          socialPostLikes: post.likeCount,
          socialPostPostedAt: post.postedAt,
          ingestedPostId: post.id,
          confidence: 1,
          isSponsored: post.isSponsored,
          role: e.role ?? "primary",
        },
        select: { id: true },
      });
      await writeAudit({ entity: "review", entityId: created.id, action: "create", actor: opts.actor, note: opts.note, fieldChanges: { placeId: { from: null, to: placeId } } });
      touched.add(placeId);
      reviewId = created.id;
    }

    if (e.tagSlugs) {
      const [tags, prior] = await Promise.all([
        prisma.tag.findMany({ where: { slug: { in: e.tagSlugs }, status: "active" }, select: { id: true, slug: true } }),
        prisma.reviewTag.findMany({ where: { reviewId }, select: { tag: { select: { slug: true } } } }),
      ]);
      const priorSlugs = prior.map((p) => p.tag.slug).sort();
      const nextSlugs = tags.map((t) => t.slug).sort();
      if (JSON.stringify(priorSlugs) !== JSON.stringify(nextSlugs)) {
        await prisma.$transaction([
          prisma.reviewTag.deleteMany({ where: { reviewId } }),
          prisma.reviewTag.createMany({
            data: tags.map((t) => ({ reviewId, tagId: t.id, source: "manual" as const, confidence: 1, evidence: "Set by a person" })),
          }),
        ]);
        await writeAudit({ entity: "review", entityId: reviewId, action: "tags", actor: opts.actor, note: opts.note, fieldChanges: { tags: { from: priorSlugs, to: nextSlugs } } });
        const r = await prisma.review.findUniqueOrThrow({ where: { id: reviewId }, select: { excerpt: true, dishes: true, verdict: true, placeId: true } });
        await saveExample({
          agentKey: "tag",
          postId: post.id,
          reviewId,
          input: { excerpt: r.excerpt, dishes: r.dishes, verdict: r.verdict },
          expected: { tags: nextSlugs, removed: priorSlugs.filter((s) => !nextSlugs.includes(s)) },
          source: "human_corrected",
          note: opts.note,
          createdBy: opts.actor,
        });
        touched.add(r.placeId);
      }
    }
  }

  await syncPostSideEffects(post, creator, removed);
  const after = await readingOf(post.id);
  // A save that changes the reading corrects Read; one that leaves it as is
  // (the admin looked and it was right) confirms it.
  const corrected = JSON.stringify(before) !== JSON.stringify(after);
  if (corrected || opts.edits.length > 0) {
    await saveExample({
      agentKey: "read",
      postId: post.id,
      input: readExampleInput(post),
      expected: { postType: after.length > 1 ? "roundup" : after.length === 1 ? "single_place" : "not_a_place", places: after },
      source: corrected ? "human_corrected" : "human_confirmed",
      note: opts.note,
      createdBy: opts.actor,
    });
  }
  return { touchedPlaceIds: [...touched] };
}

/**
 * A person says the post isn't about a place: its mentions go, and Read
 * learns from it (a confirmation when Read had said so too).
 */
export async function markNotAPlace(opts: { postId: string; actor: string; note?: string | null }): Promise<{ touchedPlaceIds: string[] }> {
  const { post, creator } = await loadEditablePost(opts.postId);
  const mentions = await prisma.review.findMany({ where: { ingestedPostId: post.id }, select: { id: true, placeId: true } });
  for (const m of mentions) {
    await prisma.photo.deleteMany({ where: { reviewId: m.id } });
    await prisma.review.delete({ where: { id: m.id } });
  }
  await prisma.ingestedPost.update({ where: { id: post.id }, data: { postType: "not_a_place", isPlaceContent: false } });
  await writeAudit({
    entity: "post",
    entityId: post.id,
    action: "not_a_place",
    actor: opts.actor,
    note: opts.note,
    fieldChanges: { mentions: { from: mentions.length, to: 0 } },
  });
  await syncPostSideEffects({ ...post, postType: "not_a_place" }, creator, mentions.map((m) => m.placeId));
  await saveExample({
    agentKey: "read",
    postId: post.id,
    input: readExampleInput(post),
    expected: { postType: "not_a_place", places: [] },
    source: post.postType === "not_a_place" && mentions.length === 0 ? "human_confirmed" : "human_corrected",
    note: opts.note,
    createdBy: opts.actor,
  });
  return { touchedPlaceIds: [...new Set(mentions.map((m) => m.placeId))] };
}
