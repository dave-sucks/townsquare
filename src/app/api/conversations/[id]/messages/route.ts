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
      description: "Search for restaurants, cafes, bars, or other places. Use this when the user asks for recommendations or wants to find places to visit.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query, e.g., 'best coffee shops', 'Italian restaurants', 'rooftop bars'",
          },
          location: {
            type: "string",
            description: "The location to search in, e.g., 'Chelsea NYC', 'Brooklyn', 'Manhattan'. If not specified, search broadly.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_save_to_list",
      description: "Offer the user a button to save all currently found places to a new list. Call this after presenting search results to the user, suggesting a creative and descriptive list name based on the search context.",
      parameters: {
        type: "object",
        properties: {
          listName: {
            type: "string",
            description: "A creative, descriptive name for the list, e.g., 'West Village Tacos', 'Brooklyn Coffee Crawl', 'Date Night Spots'",
          },
        },
        required: ["listName"],
      },
    },
  },
];

async function searchPlaces(query: string, location?: string): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("Google Maps API key not configured");
  }

  const searchQuery = location ? `${query} in ${location}` : query;
  
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}`
  );

  const data = await response.json();
  
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("Google Places Text Search API error:", data);
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
          content: `You assign a single contextual emoji to each place. Respond with a JSON object: {"emojis": ["emoji1", "emoji2", ...]}. One emoji per place, in order. Choose emojis that match the cuisine, vibe, or type of each place based on the search query and place names. Examples: tacos place -> "🌮", pizza -> "🍕", coffee -> "☕", bar -> "🍸", sushi -> "🍣", burger -> "🍔".`,
        },
        {
          role: "user",
          content: `Search query: "${query}"\n\nPlaces:\n${placeNames}`,
        },
      ],
      max_completion_tokens: 100,
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const emojis: string[] = Array.isArray(parsed.emojis) ? parsed.emojis : [];
      return places.map((p, i) => ({
        ...p,
        emoji: emojis[i] || null,
      }));
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
      include: {
        place: true,
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
    prisma.list.findMany({
      where: { userId },
      include: {
        listPlaces: {
          include: { place: true },
          take: 5,
        },
        _count: {
          select: { listPlaces: true },
        },
      },
      take: 20,
    }),
  ]);

  const placesContext = savedPlaces.map(sp => {
    const ratingText = sp.hasBeen 
      ? sp.rating === 1 ? "bad" : sp.rating === 2 ? "okay" : "great"
      : "want";
    const location = sp.place.neighborhood || sp.place.locality || "";
    return `- ${sp.place.name}${location ? ` (${location})` : ""}: ${sp.place.primaryType || "place"}, ${ratingText}`;
  }).join("\n");

  const listsContext = lists.map(list => {
    const placeCount = list._count.listPlaces;
    const samplePlaces = list.listPlaces.slice(0, 3).map(lp => lp.place.name).join(", ");
    const extra = placeCount > 3 ? ` +${placeCount - 3} more` : "";
    return `- ${list.name} (${placeCount}): ${samplePlaces || "empty"}${extra}`;
  }).join("\n");

  return `You are a helpful assistant for a place-saving and discovery app. You help users find places, manage their saved places, and discover new spots to visit.

The user has the following saved places:
${placesContext || "No saved places yet."}

The user has the following lists:
${listsContext || "No lists yet."}

IMPORTANT: When users ask for place recommendations, you MUST use the search_places function to find real places. Always search when the user asks things like:
- "best coffee shops in [area]"
- "recommend restaurants near [location]"
- "find bars in [neighborhood]"

After searching, present the results naturally. ALWAYS also call the suggest_save_to_list tool with a creative list name based on the search context (e.g., "West Village Tacos", "Brooklyn Coffee Crawl"). This gives the user a one-click option to save all found places.

Be conversational, helpful, and concise. Focus on helping users discover and manage places they love.`;
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
      data: {
        conversationId,
        role: "user",
        content,
      },
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
    let suggestedListName: string | null = null;
    let finalMessages = [...chatMessages];

    const initialResponse = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: chatMessages,
      tools,
      tool_choice: "auto",
      max_completion_tokens: 2048,
    });

    const assistantMessage = initialResponse.choices[0].message;
    
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      finalMessages.push(assistantMessage);
      
      for (const toolCall of assistantMessage.tool_calls) {
        const fn = (toolCall as any).function;
        if (fn.name === "search_places") {
          try {
            const args = JSON.parse(fn.arguments);
            places = await searchPlaces(args.query, args.location);
            places = await assignEmojis(places, args.query);
            
            finalMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ places }),
            });
          } catch (error) {
            console.error("Tool execution error:", error);
            finalMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: "Failed to search places" }),
            });
          }
        } else if (fn.name === "suggest_save_to_list") {
          try {
            const args = JSON.parse(fn.arguments);
            suggestedListName = args.listName;
            finalMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ success: true, listName: suggestedListName }),
            });
          } catch (error) {
            console.error("suggest_save_to_list error:", error);
            finalMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: "Failed to suggest list" }),
            });
          }
        }
      }
    }

    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: finalMessages,
      stream: true,
      max_completion_tokens: 2048,
    });

    const encoder = new TextEncoder();
    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ places })}\n\n`));

          if (suggestedListName && places.length > 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              action: { type: "save_to_list", listName: suggestedListName } 
            })}\n\n`));
          }

          for await (const chunk of stream) {
            const chunkContent = chunk.choices[0]?.delta?.content || "";
            if (chunkContent) {
              fullResponse += chunkContent;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunkContent })}\n\n`));
            }
          }

          await prisma.chatMessage.create({
            data: {
              conversationId,
              role: "assistant",
              content: fullResponse,
              places: places.length > 0 ? (places as any) : undefined,
            },
          });

          await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
          });

          const isFirstMessage = existingMessages.length === 1;
          if (isFirstMessage && conversation.title === "New Chat") {
            const titleContent = content.slice(0, 50);
            const title = titleContent.length < content.length ? titleContent + "..." : titleContent;
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
