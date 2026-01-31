import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const savedPlaces = await prisma.savedPlace.findMany({
      where: { userId: user.id },
      include: { place: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ savedPlaces });
  } catch (error: any) {
    console.error("Get saved places error:", error);
    return NextResponse.json({ error: "Failed to get saved places" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { googlePlaceId, name, formattedAddress, lat, lng, primaryType, types, priceLevel, photoRefs, status } = body;

    if (!googlePlaceId || !name || !formattedAddress || lat === undefined || lng === undefined || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (status !== "WANT" && status !== "BEEN") {
      return NextResponse.json({ error: "Invalid status. Must be WANT or BEEN" }, { status: 400 });
    }

    let place = await prisma.place.findUnique({
      where: { googlePlaceId },
    });

    if (!place) {
      place = await prisma.place.create({
        data: {
          googlePlaceId,
          name,
          formattedAddress,
          lat,
          lng,
          primaryType: primaryType || null,
          types: types || null,
          priceLevel: priceLevel || null,
          photoRefs: photoRefs || null,
        },
      });
    }

    const savedPlace = await prisma.savedPlace.upsert({
      where: {
        userId_placeId: {
          userId: user.id,
          placeId: place.id,
        },
      },
      update: {
        status,
        visitedAt: status === "BEEN" ? new Date() : null,
      },
      create: {
        userId: user.id,
        placeId: place.id,
        status,
        visitedAt: status === "BEEN" ? new Date() : null,
      },
      include: { place: true },
    });

    return NextResponse.json({ savedPlace });
  } catch (error: any) {
    console.error("Save place error:", error);
    return NextResponse.json({ error: "Failed to save place" }, { status: 500 });
  }
}
