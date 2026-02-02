import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";

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
    const { hasBeen, rating } = body;

    if (rating !== undefined && (rating < 1 || rating > 3)) {
      return NextResponse.json({ error: "Rating must be between 1 and 3" }, { status: 400 });
    }

    const savedPlace = await prisma.savedPlace.findFirst({
      where: { id, userId: user.id },
    });

    if (!savedPlace) {
      return NextResponse.json({ error: "Saved place not found" }, { status: 404 });
    }

    const updated = await prisma.savedPlace.update({
      where: { id },
      data: {
        hasBeen: hasBeen ?? savedPlace.hasBeen,
        rating: hasBeen && rating ? rating : (hasBeen === false ? null : savedPlace.rating),
        visitedAt: hasBeen ? (savedPlace.visitedAt || new Date()) : (hasBeen === false ? null : savedPlace.visitedAt),
      },
      include: { place: true },
    });

    if (hasBeen && !savedPlace.hasBeen) {
      await createActivity({
        actorId: user.id,
        type: "PLACE_MARKED_BEEN",
        placeId: savedPlace.placeId,
        metadata: { placeName: updated.place.name, rating },
      });
    }

    return NextResponse.json({ savedPlace: updated });
  } catch (error: any) {
    console.error("Update saved place error:", error);
    return NextResponse.json({ error: "Failed to update saved place" }, { status: 500 });
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
    const savedPlace = await prisma.savedPlace.findFirst({
      where: { id, userId: user.id },
    });

    if (!savedPlace) {
      return NextResponse.json({ error: "Saved place not found" }, { status: 404 });
    }

    await prisma.savedPlace.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete saved place error:", error);
    return NextResponse.json({ error: "Failed to delete saved place" }, { status: 500 });
  }
}
