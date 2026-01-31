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

    return NextResponse.json({
      user,
      isOwnProfile,
      wantPlaces,
      beenPlaces,
      lists,
    });
  } catch (error: any) {
    console.error("Get user profile error:", error);
    return NextResponse.json({ error: "Failed to get user profile" }, { status: 500 });
  }
}
