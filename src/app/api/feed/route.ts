import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    const following = await prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });

    const followingIds = following.map((f) => f.followingId);
    const actorIds = [user.id, ...followingIds];

    const activities = await prisma.activity.findMany({
      where: {
        actorId: { in: actorIds },
      },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true,
          },
        },
        place: {
          select: {
            id: true,
            googlePlaceId: true,
            name: true,
            formattedAddress: true,
          },
        },
        list: {
          select: {
            id: true,
            name: true,
            visibility: true,
            userId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = activities.length > limit;
    const items = hasMore ? activities.slice(0, limit) : activities;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const filteredItems = items.map((activity) => {
      if (activity.list && activity.list.visibility === "PRIVATE" && activity.list.userId !== user.id) {
        return { ...activity, list: null };
      }
      return activity;
    });

    return NextResponse.json({
      activities: filteredItems,
      nextCursor,
      hasMore,
    });
  } catch (error: any) {
    console.error("Get feed error:", error);
    return NextResponse.json({ error: "Failed to get feed" }, { status: 500 });
  }
}
