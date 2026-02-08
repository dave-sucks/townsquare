import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      where: {
        id: { not: user.id },
        username: { not: null },
        OR: [
          { profileImageUrl: { not: null } },
          { firstName: { not: null } },
        ],
        NOT: [
          { username: { contains: "test", mode: "insensitive" } },
          { username: { contains: "fix", mode: "insensitive" } },
          { username: { contains: "chat", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        _count: {
          select: {
            savedPlaces: true,
            lists: true,
          },
        },
      },
      orderBy: [
        { profileImageUrl: "desc" },
        { createdAt: "asc" },
      ],
      take: 20,
    });

    const mapped = users
      .filter((u) => u._count.savedPlaces > 0)
      .map((u) => ({
        id: u.id,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        profileImageUrl: u.profileImageUrl,
        savedPlacesCount: u._count.savedPlaces,
        listsCount: u._count.lists,
      }));

    return NextResponse.json({ users: mapped });
  } catch (error) {
    console.error("Onboarding users error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
