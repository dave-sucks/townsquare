import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
    }

    const placesWithoutPhotos = await prisma.place.findMany({
      where: {
        OR: [
          { photoRefs: { equals: [] as any } },
          { photoRefs: { equals: null as any } },
        ],
      },
      take: 20,
    });

    if (placesWithoutPhotos.length === 0) {
      return NextResponse.json({ 
        message: "All places already have photos",
        updated: 0,
        remaining: 0
      });
    }

    let updated = 0;
    const errors: string[] = [];
    const results: { name: string; photos: number }[] = [];

    for (const place of placesWithoutPhotos) {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place.googlePlaceId)}&fields=photos&key=${apiKey}`
        );
        const data = await response.json();

        if (data.status !== "OK") {
          errors.push(`${place.name}: ${data.status}`);
          continue;
        }

        const photoRefs = data.result?.photos?.slice(0, 5).map((p: any) => p.photo_reference) || [];
        
        if (photoRefs.length > 0) {
          await prisma.place.update({
            where: { id: place.id },
            data: { photoRefs },
          });
          updated++;
          results.push({ name: place.name, photos: photoRefs.length });
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        errors.push(`${place.name}: ${error.message}`);
      }
    }

    const remaining = await prisma.place.count({
      where: {
        OR: [
          { photoRefs: { equals: [] as any } },
          { photoRefs: { equals: null as any } },
        ],
      },
    });

    return NextResponse.json({
      message: `Photo backfill complete`,
      updated,
      remaining,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Photo backfill error:", error);
    return NextResponse.json({ error: "Photo backfill failed" }, { status: 500 });
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const total = await prisma.place.count();
    const withPhotos = await prisma.place.count({
      where: {
        NOT: { photoRefs: { equals: [] as any } },
      },
    });
    const withoutPhotos = total - withPhotos;

    return NextResponse.json({
      total,
      withPhotos,
      withoutPhotos,
    });
  } catch (error: any) {
    console.error("Photo backfill status error:", error);
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
  }
}
