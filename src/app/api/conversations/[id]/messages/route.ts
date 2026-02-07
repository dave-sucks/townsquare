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
- You MUST ALWAYS write text after finding places. Write 2-3 sentences providing context: why this area is great for what they're looking for, what style of food or vibe to expect, a local tip, or what makes these spots stand out. This context is important — the place cards only show names and ratings, so your text provides the color and personality. Don't repeat individual place names, addresses, or ratings — just provide the narrative.
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
    let finalMessages = [...chatMessages];

    const initialResponse = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: chatMessages,
      tools,
      tool_choice: "auto",
      max_completion_tokens: 512,
    });

    const assistantMsg = initialResponse.choices[0].message;

    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      finalMessages.push(assistantMsg);

      for (const toolCall of assistantMsg.tool_calls) {
        const fn = (toolCall as any).function;
        if (fn.name === "search_places") {
          try {
            const args = JSON.parse(fn.arguments);
            places = await searchPlaces(args.query, args.location);
            places = await assignEmojis(places, args.query);
            const typeSummary = [...new Set(places.map(p => p.primaryType).filter(Boolean))].slice(0, 3).join(", ");
            finalMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ 
                found: places.length, 
                query: args.query,
                location: args.location || "nearby",
                types: typeSummary || "various",
              }),
            });
          } catch (error) {
            console.error("search_places error:", error);
            finalMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: "Search failed" }),
            });
          }
        }
      }
    }

    const streamOptions: any = {
      model: "gpt-5-mini",
      messages: finalMessages,
      stream: true,
      max_completion_tokens: 300,
    };

    if (places.length > 0) {
      streamOptions.tools = tools;
      streamOptions.tool_choice = "none";
    }

    const stream = await openai.chat.completions.create(streamOptions);

    const encoder = new TextEncoder();
    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          if (places.length > 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ places })}\n\n`));
          }

          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              fullResponse += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
            }
          }

          if (!fullResponse.trim() && places.length > 0) {
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
