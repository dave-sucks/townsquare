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
    const { status } = body;

    if (status !== "WANT" && status !== "BEEN") {
      return NextResponse.json({ error: "Invalid status. Must be WANT or BEEN" }, { status: 400 });
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
        status,
        visitedAt: status === "BEEN" ? new Date() : null,
      },
      include: { place: true },
    });

    await createActivity({
      actorId: user.id,
      type: status === "WANT" ? "PLACE_SAVED_WANT" : "PLACE_MARKED_BEEN",
      placeId: savedPlace.placeId,
      metadata: { placeName: updated.place.name },
    });

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
