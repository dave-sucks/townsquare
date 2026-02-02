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

    const placesWithoutNeighborhood = await prisma.place.findMany({
      where: {
        neighborhood: null,
      },
      take: 50,
    });

    if (placesWithoutNeighborhood.length === 0) {
      return NextResponse.json({ 
        message: "All places already have neighborhood data",
        updated: 0,
        remaining: 0
      });
    }

    let updated = 0;
    const errors: string[] = [];

    for (const place of placesWithoutNeighborhood) {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place.googlePlaceId)}&fields=address_components&key=${apiKey}`
        );
        const data = await response.json();

        if (data.status !== "OK") {
          errors.push(`${place.name}: ${data.status}`);
          continue;
        }

        const addressComponents = data.result?.address_components || [];
        let neighborhood: string | null = null;
        let locality: string | null = null;

        for (const component of addressComponents) {
          const types = component.types || [];
          if (types.includes("neighborhood") && !neighborhood) {
            neighborhood = component.long_name;
          }
          if (types.includes("sublocality_level_1") && !neighborhood) {
            neighborhood = component.long_name;
          }
          if (types.includes("sublocality") && !neighborhood) {
            neighborhood = component.long_name;
          }
          if (types.includes("locality") && !locality) {
            locality = component.long_name;
          }
        }

        if (neighborhood || locality) {
          await prisma.place.update({
            where: { id: place.id },
            data: {
              neighborhood,
              locality,
            },
          });
          updated++;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        errors.push(`${place.name}: ${error.message}`);
      }
    }

    const remaining = await prisma.place.count({
      where: { neighborhood: null },
    });

    return NextResponse.json({
      message: `Backfill complete`,
      updated,
      remaining,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Backfill error:", error);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const total = await prisma.place.count();
    const withNeighborhood = await prisma.place.count({
      where: {
        OR: [
          { neighborhood: { not: null } },
          { locality: { not: null } },
        ],
      },
    });
    const withoutNeighborhood = total - withNeighborhood;

    return NextResponse.json({
      total,
      withNeighborhood,
      withoutNeighborhood,
    });
  } catch (error: any) {
    console.error("Backfill status error:", error);
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
  }
}
