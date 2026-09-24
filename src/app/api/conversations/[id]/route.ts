import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  convertPersistedToUIMessages,
  legacyChatMessagesToUIMessages,
} from "@/lib/agent/convert-messages";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // New chats store the full UIMessage[]; old ones only have ChatMessage
    // rows, converted on read so they open in the new thread.
    const messages = Array.isArray(conversation.uiMessages)
      ? convertPersistedToUIMessages(conversation.uiMessages as unknown[])
      : legacyChatMessagesToUIMessages(conversation.messages);

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages,
    });
  } catch (error) {
    console.error("Get conversation error:", error);
    return NextResponse.json({ error: "Failed to get conversation" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.id },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    await prisma.conversation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { title } = body;

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.id },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: { title },
    });

    return NextResponse.json({ conversation: updated });
  } catch (error) {
    console.error("Update conversation error:", error);
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}
