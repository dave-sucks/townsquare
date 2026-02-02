import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";

async function ensureSystemLists(userId: string) {
  const wantToGoList = await prisma.list.findFirst({
    where: { userId, systemSlug: "want-to-go" },
  });

  if (!wantToGoList) {
    await prisma.list.create({
      data: {
        userId,
        name: "Want to Go",
        description: "Places you want to visit",
        visibility: "PRIVATE",
        isSystem: true,
        systemSlug: "want-to-go",
      },
    });
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureSystemLists(user.id);

    const myLists = await prisma.list.findMany({
      where: { userId: user.id },
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
        listPlaces: {
          take: 5,
          orderBy: { addedAt: "desc" },
          include: {
            place: {
              select: {
                id: true,
                name: true,
                formattedAddress: true,
                photoRefs: true,
              },
            },
          },
        },
        _count: {
          select: { listPlaces: true },
        },
      },
      orderBy: [
        { isSystem: "desc" },
        { createdAt: "desc" },
      ],
    });

    const discoverLists = await prisma.list.findMany({
      where: {
        userId: { not: user.id },
        visibility: "PUBLIC",
        isSystem: false,
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
        listPlaces: {
          take: 5,
          orderBy: { addedAt: "desc" },
          include: {
            place: {
              select: {
                id: true,
                name: true,
                formattedAddress: true,
                photoRefs: true,
              },
            },
          },
        },
        _count: {
          select: { listPlaces: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ lists: myLists, discoverLists });
  } catch (error: any) {
    console.error("Get lists error:", error);
    return NextResponse.json({ error: "Failed to get lists" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, visibility } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (visibility && visibility !== "PRIVATE" && visibility !== "PUBLIC") {
      return NextResponse.json({ error: "Invalid visibility. Must be PRIVATE or PUBLIC" }, { status: 400 });
    }

    const list = await prisma.list.create({
      data: {
        userId: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        visibility: visibility || "PRIVATE",
        isSystem: false,
      },
      include: {
        _count: {
          select: { listPlaces: true },
        },
      },
    });

    await createActivity({
      actorId: user.id,
      type: "LIST_CREATED",
      listId: list.id,
      metadata: { listName: list.name },
    });

    return NextResponse.json({ list });
  } catch (error: any) {
    console.error("Create list error:", error);
    return NextResponse.json({ error: "Failed to create list" }, { status: 500 });
  }
}
