import { prisma } from "@/lib/prisma";

interface EnrichReviewPayload {
  reviewId: string;
}

const MIN_TAG_CONFIDENCE = 0.55;

export async function handleEnrichReview(payload: EnrichReviewPayload) {
  const { reviewId } = payload;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      place: true,
    },
  });
  if (!review) throw new Error(`Review ${reviewId} not found`);

  const text = review.socialPostCaption || review.note || "";
  if (!text || text.length < 10) return;

  const allTags = await prisma.tag.findMany({
    include: { category: true },
  });

  const tagsByCategory: Record<string, Array<{ slug: string; displayName: string; id: string }>> = {};
  for (const tag of allTags) {
    const catSlug = tag.category.slug;
    if (!tagsByCategory[catSlug]) tagsByCategory[catSlug] = [];
    tagsByCategory[catSlug].push({
      slug: tag.slug,
      displayName: tag.displayName,
      id: tag.id,
    });
  }

  const taxonomyDescription = Object.entries(tagsByCategory)
    .map(
      ([cat, tags]) =>
        `${cat}: ${tags.map((t) => t.slug).join(", ")}`
    )
    .join("\n");

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

  const prompt = `You are a food/restaurant tag extractor. Given a social media post caption about a restaurant/bar/cafe, extract relevant tags from the controlled vocabulary below.

TAXONOMY:
${taxonomyDescription}

CONTEXT:
Place: ${review.place.name}${review.place.neighborhood ? `, ${review.place.neighborhood}` : ""}
Google types: ${JSON.stringify(review.place.types || [])}

CAPTION:
${text.substring(0, 1000)}

Return a JSON object where keys are tag slugs from the taxonomy above, and values are confidence scores (0.0 to 1.0). Only include tags that are relevant. Be conservative - only assign high confidence (>0.8) when the caption clearly indicates that tag.

Example response format:
{"smashburger_food": 0.9, "casual_hang": 0.7, "affordable": 0.6}

Return ONLY the JSON object, no other text.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return;

  let tagScores: Record<string, number>;
  try {
    tagScores = JSON.parse(content);
  } catch {
    console.error("[EnrichReview] Failed to parse AI response:", content);
    return;
  }

  const tagMap = new Map(allTags.map((t) => [t.slug, t]));

  for (const [slug, confidence] of Object.entries(tagScores)) {
    if (typeof confidence !== "number" || confidence < MIN_TAG_CONFIDENCE) continue;

    const tag = tagMap.get(slug);
    if (!tag) continue;

    await prisma.reviewTag.upsert({
      where: {
        reviewId_tagId: {
          reviewId,
          tagId: tag.id,
        },
      },
      update: {
        confidence: Math.min(1, confidence),
        source: "ai",
      },
      create: {
        reviewId,
        tagId: tag.id,
        source: "ai",
        confidence: Math.min(1, confidence),
      },
    });
  }
}
