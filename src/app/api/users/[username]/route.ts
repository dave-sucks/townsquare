import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = await params;

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { id: username },
        ],
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isOwnProfile = user.id === currentUser.id;

    const isFollowing = !isOwnProfile && await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUser.id,
          followingId: user.id,
        },
      },
    }) !== null;

    const followerCount = await prisma.follow.count({
      where: { followingId: user.id },
    });

    const followingCount = await prisma.follow.count({
      where: { followerId: user.id },
    });

    const wantPlaces = await prisma.savedPlace.findMany({
      where: {
        userId: user.id,
        status: "WANT",
      },
      include: { place: true },
      orderBy: { createdAt: "desc" },
    });

    const beenPlaces = await prisma.savedPlace.findMany({
      where: {
        userId: user.id,
        status: "BEEN",
      },
      include: { place: true },
      orderBy: { createdAt: "desc" },
    });

    const lists = await prisma.list.findMany({
      where: {
        userId: user.id,
        ...(isOwnProfile ? {} : { visibility: "PUBLIC" }),
      },
      include: {
        _count: {
          select: { listPlaces: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const reviews = await prisma.review.findMany({
      where: { userId: user.id },
      include: {
        place: {
          select: {
            id: true,
            googlePlaceId: true,
            name: true,
            formattedAddress: true,
            lat: true,
            lng: true,
            primaryType: true,
            types: true,
            priceLevel: true,
            photoRefs: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all saved places with full place data for map display
    const allSavedPlaces = await prisma.savedPlace.findMany({
      where: { userId: user.id },
      include: {
        place: {
          select: {
            id: true,
            googlePlaceId: true,
            name: true,
            formattedAddress: true,
            lat: true,
            lng: true,
            primaryType: true,
            types: true,
            priceLevel: true,
            photoRefs: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get list places for list filtering (only visible lists)
    const listsWithPlaces = await prisma.list.findMany({
      where: {
        userId: user.id,
        ...(isOwnProfile ? {} : { visibility: "PUBLIC" }),
      },
      include: {
        listPlaces: {
          select: { placeId: true },
        },
        _count: {
          select: { listPlaces: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      user,
      isOwnProfile,
      isFollowing,
      followerCount,
      followingCount,
      wantPlaces,
      beenPlaces,
      allSavedPlaces,
      lists: listsWithPlaces,
      reviews,
    });
  } catch (error: any) {
    console.error("Get user profile error:", error);
    return NextResponse.json({ error: "Failed to get user profile" }, { status: 500 });
  }
}
