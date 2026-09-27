import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/tags
// Returns the tag categories with their active tags, ordered by sortOrder.
// Used by the explore filter panel to show dynamic filter chips.
export async function GET() {
  try {
    const categories = await prisma.tagCategory.findMany({
      where: { tags: { some: { status: "active" } } },
      orderBy: { sortOrder: "asc" },
      include: {
        tags: {
          where: { status: "active" },
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
