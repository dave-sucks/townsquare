import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || "";

  try {
    const following = await prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    const followingIds = new Set(following.map((f) => f.followingId));

    const users = await prisma.user.findMany({
      where: {
        id: { not: user.id },
        OR: search
          ? [
              { username: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ]
          : undefined,
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        _count: {
          select: { savedPlaces: true, lists: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const usersWithFollowStatus = users.map((u) => ({
      ...u,
      isFollowing: followingIds.has(u.id),
    }));

    return NextResponse.json({ users: usersWithFollowStatus });
  } catch (error: any) {
    console.error("Get users error:", error);
    return NextResponse.json({ error: "Failed to get users" }, { status: 500 });
  }
}
