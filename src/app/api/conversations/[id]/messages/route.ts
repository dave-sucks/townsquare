import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

interface PlaceResult {
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  types: string[];
  primaryType: string | null;
  priceLevel: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
  photoRef: string | null;
  emoji: string | null;
  dbId: string | null;
  neighborhood: string | null;
  photoRefs: string[] | null;
  tags: { slug: string; displayName: string; categorySlug: string }[] | null;
}

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_places",
      description: "Search for restaurants, cafes, bars, or other places. Use this when the user asks for recommendations or wants to find places.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query, e.g., 'best tacos', 'Italian restaurants', 'rooftop bars'",
          },
          location: {
            type: "string",
            description: "The location to search in, e.g., 'West Village NYC', 'Brooklyn'. If not specified, search broadly.",
          },
        },
        required: ["query"],
      },
    },
  },
];

async function searchPlaces(query: string, location?: string): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("Google Maps API key not configured");

  const searchQuery = location ? `${query} in ${location}` : query;
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}`
  );
  const data = await response.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("Google Places API error:", data);
    return [];
  }

  return (data.results || []).slice(0, 5).map((result: any) => ({
    googlePlaceId: result.place_id,
    name: result.name,
    formattedAddress: result.formatted_address,
    lat: result.geometry?.location?.lat,
    lng: result.geometry?.location?.lng,
    types: result.types || [],
    primaryType: result.types?.[0] || null,
    priceLevel: result.price_level?.toString() || null,
    rating: result.rating || null,
    userRatingsTotal: result.user_ratings_total || null,
    photoRef: result.photos?.[0]?.photo_reference || null,
    emoji: null,
    dbId: null,
    neighborhood: null,
    photoRefs: result.photos?.slice(0, 5).map((p: any) => p.photo_reference) || null,
    tags: null,
  }));
}

async function assignEmojis(places: PlaceResult[], query: string): Promise<PlaceResult[]> {
  try {
    const placeNames = places.map((p, i) => `${i}: ${p.name} (${p.primaryType || p.types[0] || "place"})`).join("\n");
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `Assign one emoji per place. Respond as JSON: {"emojis": ["emoji1", ...]}. Match cuisine/vibe. Examples: tacos->"🌮", pizza->"🍕", coffee->"☕", bar->"🍸".`,
        },
        { role: "user", content: `Query: "${query}"\n${placeNames}` },
      ],
      max_completion_tokens: 100,
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const emojis: string[] = Array.isArray(parsed.emojis) ? parsed.emojis : [];
      return places.map((p, i) => ({ ...p, emoji: emojis[i] || null }));
    }
  } catch (e) {
    console.error("Emoji assignment failed:", e);
  }
  return places;
}

async function fetchPlaceDetailsForNeighborhood(googlePlaceId: string): Promise<{ neighborhood: string | null; locality: string | null; photoRefs: string[] | null }> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { neighborhood: null, locality: null, photoRefs: null };

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(googlePlaceId)}&fields=address_components,photos&key=${apiKey}`
    );
    if (!response.ok) return { neighborhood: null, locality: null, photoRefs: null };

    const data = await response.json();
    if (data.status !== "OK") return { neighborhood: null, locality: null, photoRefs: null };
    const result = data.result;
    if (!result) return { neighborhood: null, locality: null, photoRefs: null };

    let neighborhood: string | null = null;
    let locality: string | null = null;

    for (const component of (result.address_components || [])) {
      const types = component.types || [];
      if (types.includes("neighborhood") && !neighborhood) {
        neighborhood = component.long_name;
      }
      if (types.includes("sublocality_level_1") && !neighborhood) {
        neighborhood = component.long_name;
      }
      if (types.includes("sublocality") && !neighborhood) {
        neighborhood = component.long_name;
      }
      if (types.includes("locality") && !locality) {
        locality = component.long_name;
      }
    }

    const photoRefs = result.photos?.slice(0, 5).map((p: any) => p.photo_reference) || null;

    return { neighborhood, locality, photoRefs };
  } catch {
    return { neighborhood: null, locality: null, photoRefs: null };
  }
}

async function persistPlaces(places: PlaceResult[]): Promise<PlaceResult[]> {
  const results: PlaceResult[] = [];

  for (const place of places) {
    try {
      const details = await fetchPlaceDetailsForNeighborhood(place.googlePlaceId);
      const neighborhood = details.neighborhood;
      const locality = details.locality;

      const photoRefsData = details.photoRefs || place.photoRefs || (place.photoRef ? [place.photoRef] : []);

      const dbPlace = await prisma.place.upsert({
        where: { googlePlaceId: place.googlePlaceId },
        create: {
          googlePlaceId: place.googlePlaceId,
          name: place.name,
          formattedAddress: place.formattedAddress,
          neighborhood,
          locality,
          lat: place.lat,
          lng: place.lng,
          types: place.types || [],
          primaryType: place.primaryType,
          priceLevel: place.priceLevel ?? null,
          photoRefs: photoRefsData,
        },
        update: {
          name: place.name,
          formattedAddress: place.formattedAddress,
          neighborhood,
          locality,
          lat: place.lat,
          lng: place.lng,
          types: place.types || [],
          primaryType: place.primaryType,
          priceLevel: place.priceLevel ?? undefined,
          photoRefs: photoRefsData.length > 0 ? photoRefsData : undefined,
        },
      });

      const existingTags = await prisma.placeTag.findMany({
        where: { placeId: dbPlace.id },
        include: { tag: { include: { category: true } } },
      });

      const topTags = existingTags
        .filter(pt => pt.tag?.category)
        .sort((a, b) => (b.tag.category!.searchWeight || 1) - (a.tag.category!.searchWeight || 1))
        .slice(0, 5)
        .map(pt => ({
          slug: pt.tag.slug,
          displayName: pt.tag.displayName,
          categorySlug: pt.tag.category!.slug,
        }));

      results.push({
        ...place,
        dbId: dbPlace.id,
        neighborhood: dbPlace.neighborhood,
        photoRefs: dbPlace.photoRefs as string[] | null,
        tags: topTags.length > 0 ? topTags : null,
      });
    } catch (error) {
      console.error(`Failed to persist place ${place.name}:`, error);
      results.push(place);
    }
  }

  return results;
}

async function autoTagPlaces(places: PlaceResult[]): Promise<PlaceResult[]> {
  const placesToTag = places.filter(p => p.dbId && (!p.tags || p.tags.length === 0));
  if (placesToTag.length === 0) return places;

  try {
    const allTags = await prisma.tag.findMany({
      include: { category: true },
    });

    const tagsByCategory: Record<string, { slug: string; displayName: string; categorySlug: string }[]> = {};
    for (const tag of allTags) {
      if (!tag.category) continue;
      const catSlug = tag.category.slug;
      if (!tagsByCategory[catSlug]) tagsByCategory[catSlug] = [];
      tagsByCategory[catSlug].push({
        slug: tag.slug,
        displayName: tag.displayName,
        categorySlug: catSlug,
      });
    }

    const categoryList = Object.entries(tagsByCategory)
      .map(([cat, tags]) => `${cat}: ${tags.map(t => t.slug).join(", ")}`)
      .join("\n");

    const placeDescriptions = placesToTag.map((p, i) => {
      const parts = [`${i}: ${p.name}`];
      if (p.primaryType) parts.push(`(${p.primaryType})`);
      if (p.types.length > 0) parts.push(`[${p.types.slice(0, 3).join(", ")}]`);
      if (p.priceLevel) parts.push(`price:${p.priceLevel}`);
      if (p.neighborhood) parts.push(`in ${p.neighborhood}`);
      return parts.join(" ");
    }).join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `You are a place tagging assistant. Given places and available tag categories with their tags, assign the most relevant tags to each place. Only use tags from the provided list.

Available tags by category:
${categoryList}

Respond as JSON: {"places": [{"index": 0, "tags": ["tag-slug-1", "tag-slug-2"]}, ...]}
Assign 1-4 tags per place. Only use existing tag slugs from the list above.`,
        },
        { role: "user", content: placeDescriptions },
      ],
      max_completion_tokens: 500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return places;

    const parsed = JSON.parse(content);
    const tagAssignments: { index: number; tags: string[] }[] = parsed.places || [];

    const tagMap = new Map(allTags.map(t => [t.slug, t]));

    for (const assignment of tagAssignments) {
      if (typeof assignment.index !== "number" || assignment.index < 0 || assignment.index >= placesToTag.length) continue;
      if (!Array.isArray(assignment.tags)) continue;

      const place = placesToTag[assignment.index];
      if (!place?.dbId) continue;

      const assignedTags: { slug: string; displayName: string; categorySlug: string }[] = [];

      for (const tagSlug of assignment.tags) {
        if (typeof tagSlug !== "string") continue;
        const tag = tagMap.get(tagSlug);
        if (!tag?.category) continue;

        try {
          await prisma.placeTag.upsert({
            where: {
              placeId_tagId: {
                placeId: place.dbId,
                tagId: tag.id,
              },
            },
            create: {
              placeId: place.dbId,
              tagId: tag.id,
              source: "ai",
              confidence: 0.8,
            },
            update: {},
          });

          assignedTags.push({
            slug: tag.slug,
            displayName: tag.displayName,
            categorySlug: tag.category.slug,
          });
        } catch (e) {
          console.error(`Failed to assign tag ${tagSlug} to place ${place.name}:`, e);
        }
      }

      if (assignedTags.length > 0) {
        place.tags = assignedTags;
      }
    }
  } catch (e) {
    console.error("Auto-tagging failed:", e);
  }

  return places;
}

async function buildSystemPrompt(userId: string): Promise<string> {
  const [savedPlaces, lists] = await Promise.all([
    prisma.savedPlace.findMany({
      where: { userId },
      include: { place: true },
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
    prisma.list.findMany({
      where: { userId },
      include: { _count: { select: { listPlaces: true } } },
      take: 20,
    }),
  ]);

  const placesContext = savedPlaces.map(sp => {
    const ratingText = sp.hasBeen
      ? sp.rating === 1 ? "bad" : sp.rating === 2 ? "okay" : "great"
      : "want to go";
    return `- ${sp.place.name}: ${ratingText}`;
  }).join("\n");

  const listsContext = lists.map(l => `- ${l.name} (${l._count.listPlaces} places)`).join("\n");

  return `You are a concise place recommendation assistant. Help users find places to eat, drink, and visit.

User's saved places:
${placesContext || "None yet."}

User's lists:
${listsContext || "None yet."}

Rules:
- Use the search_places tool when users ask for recommendations.
- Keep conversational responses brief and helpful.
- If asked about a social media account or influencer, say you can't access social media and ask for a specific neighborhood or cuisine instead.
- Never output JSON, code, or technical data in your text.`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  try {
    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: user.id },
    });
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    await prisma.chatMessage.create({
      data: { conversationId, role: "user", content },
    });

    const existingMessages = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    const systemPrompt = await buildSystemPrompt(user.id);
    const chatMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...existingMessages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    let places: PlaceResult[] = [];
    let searchQuery = "";
    let searchLocation = "";

    const initialResponse = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: chatMessages,
      tools,
      tool_choice: "auto",
      max_completion_tokens: 1024,
    });

    const assistantMsg = initialResponse.choices[0].message;

    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      for (const toolCall of assistantMsg.tool_calls) {
        const fn = (toolCall as any).function;
        if (fn.name === "search_places") {
          try {
            const args = JSON.parse(fn.arguments);
            searchQuery = args.query || "";
            searchLocation = args.location || "";
            places = await searchPlaces(args.query, args.location);
            places = await assignEmojis(places, args.query);
            places = await persistPlaces(places);
            places = await autoTagPlaces(places);
          } catch (error) {
            console.error("search_places error:", error);
          }
        }
      }
    }

    const encoder = new TextEncoder();
    let fullResponse = "";

    let descriptionText = "";

    if (places.length > 0) {
      const placeDetails = places.map(p => {
        const parts = [p.name];
        if (p.primaryType) parts.push(`(${p.primaryType})`);
        if (p.rating) parts.push(`${p.rating} stars`);
        if (p.priceLevel) parts.push(`price level ${p.priceLevel}`);
        return parts.join(" ");
      }).join("; ");
      const descPrompt = `The user searched for "${searchQuery}"${searchLocation ? ` in ${searchLocation}` : ""}. Here are the results: ${placeDetails}.

Write 2-3 sentences that enrich the list. Call out specific places by name — mention if one is a local favorite, a newer spot, particularly well-known for something, a good pick for the occasion, or stands out from the rest. Give the user a reason to be excited about these results. Be conversational and specific, not generic.`;

      try {
        console.log("[Chat] Generating description for:", placeDetails);
        const descResponse = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            { role: "user", content: descPrompt },
          ],
          max_completion_tokens: 1024,
        });
        descriptionText = descResponse.choices[0]?.message?.content || "";
        console.log("[Chat] Description result:", descriptionText.substring(0, 100));
      } catch (err: any) {
        console.error("[Chat] Description generation error:", err?.message || err);
      }
    }

    let conversationalStream: any = null;
    if (!places.length) {
      if (assistantMsg.content) {
        fullResponse = assistantMsg.content;
      } else {
        conversationalStream = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: chatMessages,
          stream: true,
          max_completion_tokens: 1024,
        });
      }
    }

    const readable = new ReadableStream({
      async start(controller) {
        try {
          if (places.length > 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ places })}\n\n`));
          }

          if (descriptionText) {
            fullResponse = descriptionText;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: descriptionText })}\n\n`));
          } else if (fullResponse) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: fullResponse })}\n\n`));
          }

          if (conversationalStream) {
            for await (const chunk of conversationalStream) {
              const text = chunk.choices[0]?.delta?.content || "";
              if (text) {
                fullResponse += text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
              }
            }
          }

          if (!fullResponse.trim() && places.length > 0) {
            console.log("[Chat] WARNING: No description generated, using fallback");
            const fallback = `Here are ${places.length} spots I found for you. Tap any to see more details!`;
            fullResponse = fallback;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: fallback })}\n\n`));
          }

          await prisma.chatMessage.create({
            data: {
              conversationId,
              role: "assistant",
              content: fullResponse.trim(),
              places: places.length > 0 ? (places as any) : undefined,
            },
          });

          await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
          });

          if (existingMessages.length === 1 && conversation.title === "New Chat") {
            const title = content.length > 50 ? content.slice(0, 50) + "..." : content;
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { title },
            });
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
