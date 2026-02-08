import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { userIds } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "userIds array is required" }, { status: 400 });
    }

    const validUserIds = userIds.filter((id: string) => id !== user.id);

    const existingFollows = await prisma.follow.findMany({
      where: {
        followerId: user.id,
        followingId: { in: validUserIds },
      },
      select: { followingId: true },
    });

    const alreadyFollowing = new Set(existingFollows.map((f) => f.followingId));
    const newFollowIds = validUserIds.filter((id: string) => !alreadyFollowing.has(id));

    if (newFollowIds.length > 0) {
      await prisma.follow.createMany({
        data: newFollowIds.map((followingId: string) => ({
          followerId: user.id,
          followingId,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({
      followed: newFollowIds.length,
      total: validUserIds.length,
    });
  } catch (error) {
    console.error("Batch follow error:", error);
    return NextResponse.json(
      { error: "Failed to follow users" },
      { status: 500 }
    );
  }
}
