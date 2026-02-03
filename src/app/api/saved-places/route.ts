import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const savedPlaces = await prisma.savedPlace.findMany({
      where: { userId: user.id },
      include: { 
        place: {
          include: {
            listPlaces: {
              include: {
                list: {
                  select: { id: true, name: true }
                }
              },
              where: {
                list: { userId: user.id }
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedPlaces = savedPlaces.map(sp => ({
      ...sp,
      place: {
        id: sp.place.id,
        googlePlaceId: sp.place.googlePlaceId,
        name: sp.place.name,
        formattedAddress: sp.place.formattedAddress,
        neighborhood: sp.place.neighborhood,
        locality: sp.place.locality,
        lat: sp.place.lat,
        lng: sp.place.lng,
        primaryType: sp.place.primaryType,
        types: sp.place.types,
        priceLevel: sp.place.priceLevel,
        photoRefs: sp.place.photoRefs,
      },
      lists: sp.place.listPlaces.map(lp => lp.list),
    }));

    return NextResponse.json({ savedPlaces: formattedPlaces });
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
    const { googlePlaceId, name, formattedAddress, neighborhood, locality, lat, lng, primaryType, types, priceLevel, photoRefs, hasBeen, rating  } = body;

    if (!googlePlaceId || !name || !formattedAddress || lat === undefined || lng === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
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
          neighborhood: neighborhood || null,
          locality: locality || null,
          lat,
          lng,
          primaryType: primaryType || null,
          types: types || null,
          priceLevel: priceLevel || null,
          photoRefs: photoRefs || null,
        },
      });
    } else if (!place.neighborhood && (neighborhood || locality)) {
      place = await prisma.place.update({
        where: { id: place.id },
        data: {
          neighborhood: neighborhood || null,
          locality: locality || null,
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
        hasBeen: hasBeen ?? false,
        rating: hasBeen && rating ? rating : null,
        visitedAt: hasBeen ? new Date() : null,
      },
      create: {
        userId: user.id,
        placeId: place.id,
        hasBeen: hasBeen ?? false,
        rating: hasBeen && rating ? rating : null,
        visitedAt: hasBeen ? new Date() : null,
      },
      include: { place: true },
    });

    await createActivity({
      actorId: user.id,
      type: hasBeen ? "PLACE_MARKED_BEEN" : "PLACE_SAVED",
      placeId: place.id,
      metadata: { placeName: place.name, rating: hasBeen ? rating : undefined },
    });

    return NextResponse.json({ savedPlace });
  } catch (error: any) {
    console.error("Save place error:", error);
    return NextResponse.json({ error: "Failed to save place" }, { status: 500 });
  }
}
