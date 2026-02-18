import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autoTagPlace } from "@/lib/auto-tag-place";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const placesWithoutTags = await prisma.place.findMany({
      where: {
        placeTags: { none: {} },
      },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    });

    if (placesWithoutTags.length === 0) {
      return NextResponse.json({ message: "All places already have tags", tagged: 0 });
    }

    let tagged = 0;
    let failed = 0;
    const results: Array<{ name: string; status: string }> = [];

    for (const place of placesWithoutTags) {
      try {
        await autoTagPlace(place.id);
        const count = await prisma.placeTag.count({ where: { placeId: place.id } });
        if (count > 0) {
          tagged++;
          results.push({ name: place.name, status: `tagged (${count} tags)` });
        } else {
          failed++;
          results.push({ name: place.name, status: "no tags assigned" });
        }
      } catch (err: any) {
        failed++;
        results.push({ name: place.name, status: `error: ${err.message}` });
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    return NextResponse.json({
      message: `Backfill complete: ${tagged} tagged, ${failed} failed out of ${placesWithoutTags.length}`,
      tagged,
      failed,
      total: placesWithoutTags.length,
      results,
    });
  } catch (err: any) {
    console.error("[BackfillTags] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
