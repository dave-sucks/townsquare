import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const list = await prisma.list.findUnique({
      where: { id: listId },
    });

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    if (list.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { placeId, note } = body;

    if (!placeId) {
      return NextResponse.json({ error: "placeId is required" }, { status: 400 });
    }

    const place = await prisma.place.findUnique({
      where: { id: placeId },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const existingListPlace = await prisma.listPlace.findUnique({
      where: {
        listId_placeId: {
          listId,
          placeId,
        },
      },
    });

    if (existingListPlace) {
      return NextResponse.json({ listPlace: existingListPlace });
    }

    const listPlace = await prisma.listPlace.create({
      data: {
        listId,
        placeId,
        note: note?.trim() || null,
      },
      include: { place: true },
    });

    await createActivity({
      actorId: user.id,
      type: "PLACE_ADDED_TO_LIST",
      placeId,
      listId,
      metadata: { placeName: place.name, listName: list.name },
    });

    return NextResponse.json({ listPlace });
  } catch (error: any) {
    console.error("Add place to list error:", error);
    return NextResponse.json({ error: "Failed to add place to list" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const list = await prisma.list.findUnique({
      where: { id: listId },
    });

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    if (list.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { placeId } = body;

    if (!placeId) {
      return NextResponse.json({ error: "placeId is required" }, { status: 400 });
    }

    const listPlace = await prisma.listPlace.findUnique({
      where: {
        listId_placeId: {
          listId,
          placeId,
        },
      },
    });

    if (!listPlace) {
      return NextResponse.json({ success: true });
    }

    await prisma.listPlace.delete({
      where: { id: listPlace.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Remove place from list error:", error);
    return NextResponse.json({ error: "Failed to remove place from list" }, { status: 500 });
  }
}
