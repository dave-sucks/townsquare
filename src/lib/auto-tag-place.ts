import { prisma } from "@/lib/prisma";

export async function autoTagPlace(placeId: string): Promise<void> {
  try {
    const existingTags = await prisma.placeTag.count({
      where: { placeId },
    });

    if (existingTags > 0) return;

    const place = await prisma.place.findUnique({
      where: { id: placeId },
      include: {
        reviews: {
          select: { socialPostCaption: true, note: true },
          take: 5,
        },
      },
    });

    if (!place) return;

    const openaiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!openaiKey) return;

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
      .map(([cat, tags]) => `${cat}: ${tags.map((t) => t.slug).join(", ")}`)
      .join("\n");

    const tagMap = new Map(allTags.map((t) => [t.slug, t]));

    const captions = place.reviews
      .map((r) => r.socialPostCaption || r.note || "")
      .filter((c) => c.length > 5)
      .slice(0, 3)
      .join("\n---\n");

    const prompt = `You are a food/restaurant tag extractor. Given a place name and context, assign the most relevant tags from the controlled vocabulary below.

TAXONOMY:
${taxonomyDescription}

PLACE:
Name: ${place.name}
${place.neighborhood ? `Neighborhood: ${place.neighborhood}` : ""}
Google types: ${JSON.stringify(place.types || [])}
Primary type: ${place.primaryType || "unknown"}
${place.priceLevel ? `Price level: ${place.priceLevel}` : ""}
${captions ? `\nREVIEW CAPTIONS:\n${captions.substring(0, 800)}` : ""}

Assign 2-4 tags that best describe this place. Focus on Style (e.g. classic, gourmet, smashburger), Vibe (e.g. casual, upscale, trendy), and Price (e.g. affordable, moderate, expensive) categories. Use the place name, type, and any captions to inform your choices.

Return a JSON object where keys are tag slugs and values are confidence scores (0.6-1.0).`;

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
        max_tokens: 300,
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

    let tagScores: Record<string, number>;
    try {
      tagScores = JSON.parse(content);
    } catch {
      console.error(`[AutoTagPlace] Failed to parse response for ${place.name}: ${content}`);
      return;
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
      console.log(`[AutoTagPlace] Tagged ${place.name} with ${tagCount} tags`);
    }
  } catch (err: any) {
    console.error(`[AutoTagPlace] Error for place ${placeId}:`, err.message);
  }
}
