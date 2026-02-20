import { prisma } from "@/lib/prisma";

export async function autoSummaryPlace(placeId: string, force = false): Promise<void> {
  try {
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      include: {
        placeTags: {
          include: { tag: { include: { category: true } } },
          orderBy: { confidence: "desc" },
          take: 10,
        },
        reviews: {
          select: { socialPostCaption: true, note: true },
          take: 3,
        },
      },
    });

    if (!place) return;

    if (place.aiSummary && !force) {
      const hasReviews = place.reviews.some(r => (r.socialPostCaption || r.note || "").length > 5);
      const summaryAge = place.aiSummaryUpdatedAt
        ? Date.now() - new Date(place.aiSummaryUpdatedAt).getTime()
        : Infinity;
      const isStale = summaryAge > 7 * 24 * 60 * 60 * 1000;
      if (!(hasReviews && isStale)) return;
    }

    const openaiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!openaiKey) return;

    const tagsByCategory: Record<string, string[]> = {};
    for (const pt of place.placeTags) {
      const catSlug = pt.tag.category.slug;
      if (!tagsByCategory[catSlug]) tagsByCategory[catSlug] = [];
      tagsByCategory[catSlug].push(pt.tag.displayName);
    }

    const captions = place.reviews
      .map((r) => r.socialPostCaption || r.note || "")
      .filter((c) => c.length > 5)
      .slice(0, 3);

    const prompt = `Write a 2-sentence summary for "${place.name}"${place.neighborhood ? ` in ${place.neighborhood}` : place.locality ? ` in ${place.locality}` : ""}.

Type: ${place.primaryType || "establishment"}
${place.types ? `Categories: ${(place.types as string[]).slice(0, 5).join(", ")}` : ""}
${Object.keys(tagsByCategory).length > 0 ? `Tags: ${JSON.stringify(tagsByCategory)}` : ""}
${captions.length > 0 ? `\nReview snippets:\n${captions.map((c, i) => `${i + 1}. ${c.substring(0, 150)}`).join("\n")}` : ""}

Write a concise, specific summary for a place discovery app. Mention what kind of food/drinks they serve or what makes them special. Be specific, not generic. Do NOT use emojis. Do NOT say "Known for great ambiance and quality service" or similar filler.`;

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
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      console.error(`[AutoSummaryPlace] OpenAI error for ${place.name}: ${response.status}`);
      return;
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim();
    if (!summary) return;

    await prisma.place.update({
      where: { id: placeId },
      data: {
        aiSummary: summary,
        aiSummaryUpdatedAt: new Date(),
      },
    });

    console.log(`[AutoSummaryPlace] Generated summary for ${place.name}${force ? " (forced refresh)" : ""}`);
  } catch (err: any) {
    console.error(`[AutoSummaryPlace] Error for place ${placeId}:`, err.message);
  }
}
