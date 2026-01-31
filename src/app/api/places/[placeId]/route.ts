import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ placeId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { placeId } = await params;

  try {
    const place = await prisma.place.findUnique({
      where: { googlePlaceId: placeId },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const savedPlace = await prisma.savedPlace.findUnique({
      where: {
        userId_placeId: {
          userId: user.id,
          placeId: place.id,
        },
      },
    });

    const listsContainingPlace = await prisma.list.findMany({
      where: {
        userId: user.id,
        listPlaces: {
          some: {
            placeId: place.id,
          },
        },
      },
      include: {
        _count: {
          select: { listPlaces: true },
        },
      },
    });

    const following = await prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    const friendsWhoSaved = await prisma.savedPlace.findMany({
      where: {
        placeId: place.id,
        userId: { in: followingIds },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      place,
      savedPlace,
      listsContainingPlace,
      friendsWhoSaved,
    });
  } catch (error: any) {
    console.error("Get place error:", error);
    return NextResponse.json({ error: "Failed to get place" }, { status: 500 });
  }
}
