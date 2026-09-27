/**
 * Stage 7, Aggregate (code, per place): the place's tags, known-for dishes,
 * verdict counts and search document, from all of its mentions.
 *
 * Tag confidence = 1 − ∏(1 − c × trust × recency) over the mentions that
 * carry the tag (c: 0.9 high, 0.6 medium, 0.3 low; recency halves every
 * 365 days). A tag shows at 0.7, or when two mentions support it; admin
 * tags always show, suppressed ones never do.
 */

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { ENGINE } from "../config";
import { dishKey } from "../text";
import { refreshSearchDocument, setPlaceRollup, type KnownForDish } from "../write/places";
import { materializePlaceTags } from "../write/tags";
import type { StepResult } from "../write/runs";

export type AggregateResult = {
  mentions: number;
  tags: { slug: string; confidence: number; mentions: number; shown: boolean; suppressed: boolean }[];
  dishCounts: KnownForDish[];
  knownFor: KnownForDish[];
  verdictCounts: Record<string, number>;
};

/** Dish name counts across a place's mentions, most mentioned first. */
export function countDishes(mentions: { dishes: unknown; postedAt: Date }[]): KnownForDish[] {
  const counts = new Map<string, { names: Map<string, number>; count: number; latest: number }>();
  for (const m of mentions) {
    const dishes = (Array.isArray(m.dishes) ? m.dishes : []) as { name?: string }[];
    const seen = new Set<string>();
    for (const d of dishes) {
      if (!d.name) continue;
      const key = dishKey(d.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const c = counts.get(key) ?? { names: new Map(), count: 0, latest: 0 };
      c.count++;
      c.latest = Math.max(c.latest, m.postedAt.getTime());
      c.names.set(d.name.trim(), (c.names.get(d.name.trim()) ?? 0) + 1);
      counts.set(key, c);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || b.latest - a.latest)
    .map((c) => ({ name: [...c.names.entries()].sort((a, b) => b[1] - a[1])[0][0], count: c.count }));
}

export async function runAggregate(placeId: string): Promise<StepResult<AggregateResult>> {
  const cfg = ENGINE.aggregate;
  const reviews = await prisma.review.findMany({
    where: { placeId },
    select: {
      id: true,
      dishes: true,
      verdict: true,
      createdAt: true,
      socialPostPostedAt: true,
      user: { select: { sources: { select: { trustWeight: true }, take: 1 } } },
      reviewTags: { select: { tagId: true, confidence: true, source: true, tag: { select: { slug: true } } } },
    },
  });
  const [suppressed, manual] = await Promise.all([
    prisma.placeTagAggregate.findMany({ where: { placeId, isSuppressed: true }, select: { tagId: true } }),
    prisma.placeTag.findMany({ where: { placeId, source: "manual" }, select: { tagId: true } }),
  ]);
  const suppressedIds = new Set(suppressed.map((s) => s.tagId));

  const now = Date.now();
  const byTag = new Map<string, { slug: string; miss: number; score: number; reviews: Set<string>; sources: Record<string, number> }>();
  for (const r of reviews) {
    const postedAt = r.socialPostPostedAt ?? r.createdAt;
    const ageDays = Math.max(0, (now - postedAt.getTime()) / 86_400_000);
    const recency = Math.pow(0.5, ageDays / cfg.recencyHalfLifeDays);
    const trust = r.user.sources[0]?.trustWeight ?? 1;
    for (const rt of r.reviewTags) {
      const weight = Math.min(1, rt.confidence * trust * recency);
      const t = byTag.get(rt.tagId) ?? { slug: rt.tag.slug, miss: 1, score: 0, reviews: new Set<string>(), sources: {} };
      t.miss *= 1 - weight;
      t.score += weight;
      t.reviews.add(r.id);
      t.sources[rt.source] = (t.sources[rt.source] ?? 0) + 1;
      byTag.set(rt.tagId, t);
    }
  }

  const tags: AggregateResult["tags"] = [];
  const shown: { tagId: string; confidence: number }[] = [];
  for (const [tagId, t] of byTag) {
    const confidence = Math.round((1 - t.miss) * 1000) / 1000;
    const isSuppressed = suppressedIds.has(tagId);
    const show = !isSuppressed && (confidence >= cfg.showAt || t.reviews.size >= cfg.showWithMentions);
    tags.push({ slug: t.slug, confidence, mentions: t.reviews.size, shown: show, suppressed: isSuppressed });
    if (show) shown.push({ tagId, confidence });
    await prisma.placeTagAggregate.upsert({
      where: { placeId_tagId: { placeId, tagId } },
      update: {
        confidence,
        evidenceCount: t.reviews.size,
        evidenceScore: Math.round(t.score * 1000) / 1000,
        sourceBreakdown: t.sources as Prisma.InputJsonValue,
        lastComputedAt: new Date(),
      },
      create: {
        placeId,
        tagId,
        confidence,
        evidenceCount: t.reviews.size,
        evidenceScore: Math.round(t.score * 1000) / 1000,
        sourceBreakdown: t.sources as Prisma.InputJsonValue,
      },
    });
  }
  // Aggregates with no evidence left go; a suppression stays so it survives new evidence.
  await prisma.placeTagAggregate.deleteMany({ where: { placeId, isSuppressed: false, tagId: { notIn: [...byTag.keys()] } } });
  await materializePlaceTags(placeId, shown.filter((s) => !manual.some((m) => m.tagId === s.tagId)));

  const dishCounts = countDishes(reviews.map((r) => ({ dishes: r.dishes, postedAt: r.socialPostPostedAt ?? r.createdAt })));
  const knownFor = dishCounts.slice(0, cfg.knownFor);
  const verdictCounts: Record<string, number> = { loved: 0, liked: 0, mixed: 0, disliked: 0 };
  for (const r of reviews) if (r.verdict && r.verdict in verdictCounts) verdictCounts[r.verdict]++;

  await setPlaceRollup(placeId, { knownFor, verdictCounts });
  await refreshSearchDocument(placeId, cfg.searchExcerpts);

  tags.sort((a, b) => b.confidence - a.confidence);
  return { output: { mentions: reviews.length, tags, dishCounts: dishCounts.slice(0, 15), knownFor, verdictCounts } };
}
