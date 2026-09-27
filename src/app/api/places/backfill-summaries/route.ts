import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { autoSummaryPlace } from "@/lib/auto-summary-place";

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const placesWithoutSummary = await prisma.place.findMany({
      where: {
        OR: [
          { aiSummary: null },
          { aiSummary: "" },
        ],
      },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    });

    if (placesWithoutSummary.length === 0) {
      return NextResponse.json({ message: "All places already have summaries", summarized: 0 });
    }

    let summarized = 0;
    let failed = 0;

    for (const place of placesWithoutSummary) {
      try {
        await autoSummaryPlace(place.id);
        const updated = await prisma.place.findUnique({
          where: { id: place.id },
          select: { aiSummary: true },
        });
        if (updated?.aiSummary) {
          summarized++;
        } else {
          failed++;
        }
      } catch (err: any) {
        failed++;
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    return NextResponse.json({
      message: `Backfill complete: ${summarized} summarized, ${failed} failed out of ${placesWithoutSummary.length}`,
      summarized,
      failed,
      total: placesWithoutSummary.length,
    });
  } catch (err: any) {
    console.error("[BackfillSummaries] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
