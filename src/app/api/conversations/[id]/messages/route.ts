import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";

async function buildSystemPrompt(userId: string): Promise<string> {
  const [savedPlaces, lists] = await Promise.all([
    prisma.savedPlace.findMany({
      where: { userId },
      include: {
        place: true,
      },
      take: 100,
    }),
    prisma.list.findMany({
      where: { userId },
      include: {
        listPlaces: {
          include: { place: true },
        },
      },
      take: 50,
    }),
  ]);

  const placesContext = savedPlaces.map(sp => {
    const ratingText = sp.hasBeen 
      ? sp.rating === 1 ? "rated bad" : sp.rating === 2 ? "rated okay" : "rated great"
      : "want to go";
    return `- ${sp.place.name} (${sp.place.neighborhood || sp.place.locality || sp.place.formattedAddress}) - ${sp.place.primaryType || "place"}, ${ratingText}`;
  }).join("\n");

  const listsContext = lists.map(list => {
    const places = list.listPlaces.map(lp => lp.place.name).join(", ");
    return `- ${list.name}: ${places || "empty"}`;
  }).join("\n");

  return `You are a helpful assistant for a place-saving and discovery app. You help users find places, manage their saved places, and discover new spots to visit.

The user has the following saved places:
${placesContext || "No saved places yet."}

The user has the following lists:
${listsContext || "No lists yet."}

When users ask about places:
- Reference their saved places when relevant
- Suggest places based on their preferences and past ratings
- Help them organize places into lists
- Provide helpful information about neighborhoods and localities

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

    const chatMessages = [
      { role: "system" as const, content: systemPrompt },
      ...existingMessages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: chatMessages,
      stream: true,
      max_completion_tokens: 2048,
    });

    const encoder = new TextEncoder();
    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              fullResponse += content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }

          await prisma.chatMessage.create({
            data: {
              conversationId,
              role: "assistant",
              content: fullResponse,
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
