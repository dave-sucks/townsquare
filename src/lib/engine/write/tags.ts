/**
 * The one writer for tags on mentions and places, and for the Tag agent's
 * suggestions.
 *
 * place_tags holds each place's displayed tag set: admin overrides
 * (source manual, always shown) plus the aggregates Aggregate decides to
 * show (source ai). Every surface already reads place_tags, so the map,
 * the place page and chat show the same tags.
 */

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type MentionTag = { tagId: string; confidence: number; evidence: string };

/** Replace a mention's AI tags; tags an admin added (manual) stay. */
export async function setMentionTags(reviewId: string, tags: MentionTag[], runId: string) {
  await prisma.$transaction([
    prisma.reviewTag.deleteMany({ where: { reviewId, source: "ai" } }),
    prisma.reviewTag.createMany({
      data: tags.map((t) => ({ reviewId, tagId: t.tagId, source: "ai" as const, confidence: t.confidence, evidence: t.evidence, runId })),
      skipDuplicates: true,
    }),
  ]);
}

export const normalizeLabel = (label: string) =>
  label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Suggestions merge by normalized label, counting and keeping a few quotes. */
export async function addTagSuggestions(
  suggestions: { label: string; category: string; evidence: string }[],
  ctx: { postId: string | null; reviewId: string },
) {
  for (const s of suggestions) {
    const normalizedLabel = normalizeLabel(s.label);
    if (!normalizedLabel) continue;
    const quote = { quote: s.evidence.slice(0, 300), postId: ctx.postId, reviewId: ctx.reviewId };
    const existing = await prisma.tagSuggestion.findUnique({ where: { normalizedLabel }, select: { id: true, evidence: true } });
    if (existing) {
      const evidence = [...((existing.evidence as unknown[]) ?? []), quote].slice(-10);
      await prisma.tagSuggestion.update({
        where: { id: existing.id },
        data: { count: { increment: 1 }, evidence: evidence as Prisma.InputJsonValue },
      });
    } else {
      await prisma.tagSuggestion.create({
        data: { label: s.label, normalizedLabel, categorySlug: s.category, evidence: [quote] as Prisma.InputJsonValue },
      });
    }
  }
}

/** Make place_tags the place's displayed set: manual overrides + the shown aggregates. */
export async function materializePlaceTags(placeId: string, shown: { tagId: string; confidence: number }[]) {
  const shownIds = shown.map((s) => s.tagId);
  await prisma.placeTag.deleteMany({ where: { placeId, source: { not: "manual" }, tagId: { notIn: shownIds } } });
  for (const s of shown) {
    const existing = await prisma.placeTag.findUnique({ where: { placeId_tagId: { placeId, tagId: s.tagId } }, select: { source: true } });
    if (existing?.source === "manual") continue;
    await prisma.placeTag.upsert({
      where: { placeId_tagId: { placeId, tagId: s.tagId } },
      update: { source: "ai", confidence: s.confidence },
      create: { placeId, tagId: s.tagId, source: "ai", confidence: s.confidence },
    });
  }
}
