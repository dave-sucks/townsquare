import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const lists = await prisma.list.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: { listPlaces: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ lists });
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
      },
      include: {
        _count: {
          select: { listPlaces: true },
        },
      },
    });

    return NextResponse.json({ list });
  } catch (error: any) {
    console.error("Create list error:", error);
    return NextResponse.json({ error: "Failed to create list" }, { status: 500 });
  }
}
