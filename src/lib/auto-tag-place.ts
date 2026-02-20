import { prisma } from "@/lib/prisma";

export async function autoTagPlace(placeId: string, force = false): Promise<void> {
  try {
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      include: {
        reviews: {
          select: { socialPostCaption: true, note: true },
          take: 5,
        },
        placeTags: {
          select: { id: true, source: true },
        },
      },
    });

    if (!place) return;

    const existingTags = place.placeTags.length;
    if (existingTags > 0 && !force) {
      const hasReviews = place.reviews.length > 0;
      const allAiSourced = place.placeTags.every(t => t.source === "ai");
      if (!(hasReviews && allAiSourced)) return;
    }

    const openaiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!openaiKey) return;

    const allTags = await prisma.tag.findMany({
      include: { category: true },
    });

    const tagMap = new Map(allTags.map((t) => [t.slug, t]));
    const allSlugs = allTags.map((t) => t.slug);

    const captions = place.reviews
      .map((r) => r.socialPostCaption || r.note || "")
      .filter((c) => c.length > 5)
      .slice(0, 3)
      .join("\n---\n");

    const prompt = `You tag restaurants/bars/places. Pick 3-5 tags from ONLY this list:

${allSlugs.join(", ")}

Place: "${place.name}"
${place.neighborhood ? `Neighborhood: ${place.neighborhood}` : ""}
Type: ${place.primaryType || "unknown"}
Google types: ${(place.types as string[] || []).slice(0, 5).join(", ")}
${captions ? `Reviews: ${captions.substring(0, 500)}` : ""}

Return ONLY a flat JSON object like {"tag_slug": 0.9, "another_slug": 0.8}. Keys must be exact slugs from the list above. Values are confidence 0.6-1.0.`;

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
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error(`[AutoTagPlace] OpenAI error for ${place.name}: ${response.status}`);
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return;

    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error(`[AutoTagPlace] Failed to parse response for ${place.name}: ${content}`);
      return;
    }

    const tagScores: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number") {
        tagScores[key] = value;
      } else if (typeof value === "object" && value !== null) {
        for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
          if (typeof nestedValue === "number") {
            tagScores[nestedKey] = nestedValue;
          }
        }
      }
    }

    let tagCount = 0;
    for (const [slug, confidence] of Object.entries(tagScores)) {
      if (typeof confidence !== "number" || confidence < 0.5) continue;
      const tag = tagMap.get(slug);
      if (!tag) continue;

      await prisma.placeTag.upsert({
        where: {
          placeId_tagId: {
            placeId: place.id,
            tagId: tag.id,
          },
        },
        update: {
          confidence: Math.min(1, confidence),
          source: "ai",
        },
        create: {
          placeId: place.id,
          tagId: tag.id,
          source: "ai",
          confidence: Math.min(1, confidence),
        },
      });
      tagCount++;
    }

    if (tagCount > 0) {
      console.log(`[AutoTagPlace] Tagged ${place.name} with ${tagCount} tags${force ? " (forced refresh)" : ""}`);
    } else {
      console.warn(`[AutoTagPlace] No matching tags for ${place.name}. AI returned: ${content}`);
    }
  } catch (err: any) {
    console.error(`[AutoTagPlace] Error for place ${placeId}:`, err.message);
  }
}
