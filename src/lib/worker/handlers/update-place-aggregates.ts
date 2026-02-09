import { prisma } from "@/lib/prisma";

interface UpdatePlaceAggregatesPayload {
  placeId: string;
}

const SOURCE_WEIGHTS: Record<string, number> = {
  manual: 1.2,
  user: 1.0,
  ai: 0.8,
  google: 0.6,
};

const SCALING_FACTOR = 3;

const HIGH_CONFIDENCE_TAGS = new Set([
  "rooftop",
  "delivery",
  "takeout",
  "outdoor_seating",
  "reservations",
]);

export async function handleUpdatePlaceAggregates(
  payload: UpdatePlaceAggregatesPayload
) {
  const { placeId } = payload;

  const reviewTags = await prisma.reviewTag.findMany({
    where: {
      review: { placeId },
    },
    include: {
      tag: true,
    },
  });

  const grouped = new Map<
    string,
    {
      tagId: string;
      evidences: Array<{ confidence: number; source: string }>;
    }
  >();

  for (const rt of reviewTags) {
    if (!grouped.has(rt.tagId)) {
      grouped.set(rt.tagId, { tagId: rt.tagId, evidences: [] });
    }
    grouped.get(rt.tagId)!.evidences.push({
      confidence: rt.confidence,
      source: rt.source,
    });
  }

  for (const [tagId, data] of grouped) {
    const evidenceCount = data.evidences.length;

    const sourceBreakdown: Record<string, number> = {};
    let evidenceScore = 0;

    for (const ev of data.evidences) {
      const weight = SOURCE_WEIGHTS[ev.source] || 0.8;
      evidenceScore += ev.confidence * weight;
      sourceBreakdown[ev.source] = (sourceBreakdown[ev.source] || 0) + 1;
    }

    const confidence = Math.min(1, evidenceScore / SCALING_FACTOR);

    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    const isHighConfidenceTag = tag && HIGH_CONFIDENCE_TAGS.has(tag.slug);
    const minConfidence = isHighConfidenceTag ? 0.80 : 0.70;
    const shouldShow =
      confidence >= minConfidence || evidenceCount >= 2;

    if (!shouldShow) {
      await prisma.placeTagAggregate.deleteMany({
        where: { placeId, tagId },
      });
      continue;
    }

    await prisma.placeTagAggregate.upsert({
      where: {
        placeId_tagId: { placeId, tagId },
      },
      update: {
        confidence,
        evidenceCount,
        evidenceScore,
        lastComputedAt: new Date(),
        sourceBreakdown: sourceBreakdown as any,
      },
      create: {
        placeId,
        tagId,
        confidence,
        evidenceCount,
        evidenceScore,
        lastComputedAt: new Date(),
        sourceBreakdown: sourceBreakdown as any,
      },
    });
  }

  const currentAggregates = await prisma.placeTagAggregate.findMany({
    where: { placeId },
  });
  for (const agg of currentAggregates) {
    if (!grouped.has(agg.tagId)) {
      await prisma.placeTagAggregate.delete({ where: { id: agg.id } });
    }
  }
}
