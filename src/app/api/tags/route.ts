import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/tags
// Returns all tag categories with their tags, ordered by sortOrder.
// Used by the explore filter panel to show dynamic filter chips.
export async function GET() {
  try {
    const categories = await prisma.tagCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        tags: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            slug: true,
            displayName: true,
            sortOrder: true,
          },
        },
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("GET /api/tags error:", error);
    return NextResponse.json({ categories: [] }, { status: 500 });
  }
}
