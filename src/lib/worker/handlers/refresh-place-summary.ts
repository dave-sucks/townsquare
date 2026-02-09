import { prisma } from "@/lib/prisma";

interface RefreshPlaceSummaryPayload {
  placeId: string;
}

export async function handleRefreshPlaceSummary(
  payload: RefreshPlaceSummaryPayload
) {
  const { placeId } = payload;

  const place = await prisma.place.findUnique({
    where: { id: placeId },
    include: {
      placeTagAggregates: {
        where: { isSuppressed: false },
        include: { tag: { include: { category: true } } },
        orderBy: { confidence: "desc" },
        take: 15,
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { socialPostCaption: true, note: true },
      },
    },
  });

  if (!place) return;
  if (place.reviews.length < 2) return;

  const openaiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!openaiKey) return;

  const tagsByCategory: Record<string, string[]> = {};
  for (const agg of place.placeTagAggregates) {
    const catSlug = agg.tag.category.slug;
    if (!tagsByCategory[catSlug]) tagsByCategory[catSlug] = [];
    tagsByCategory[catSlug].push(agg.tag.slug);
  }

  const captions = place.reviews
    .map((r) => r.socialPostCaption || r.note || "")
    .filter((c) => c.length > 10)
    .slice(0, 3);

  const prompt = `Write a 2-3 sentence summary for "${place.name}" in ${place.neighborhood || place.locality || "the city"}.

Tags: ${JSON.stringify(tagsByCategory)}
${place.types ? `Google types: ${JSON.stringify(place.types)}` : ""}

Sample reviews/captions:
${captions.map((c, i) => `${i + 1}. ${c.substring(0, 200)}`).join("\n")}

Write a concise, engaging summary suitable for a place discovery app. Focus on what makes this place special. Do NOT use emojis.`;

  try {
    const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) return;

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim();
    if (!summary) return;

    const topChips: Record<string, string[]> = {};
    const categoryOrder = ["style", "vibe", "price", "food_type", "features", "occasion"];
    for (const cat of categoryOrder) {
      const tags = tagsByCategory[cat];
      if (tags && tags.length > 0) {
        topChips[cat] = tags.slice(0, 2);
      }
    }

    await prisma.place.update({
      where: { id: placeId },
      data: {
        aiSummary: summary,
        aiSummaryUpdatedAt: new Date(),
        topChips: topChips as any,
      },
    });
  } catch (err: any) {
    console.error(`[RefreshPlaceSummary] Error for place ${placeId}:`, err.message);
  }
}
