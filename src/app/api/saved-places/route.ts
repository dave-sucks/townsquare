import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";
import { getDefaultEmoji } from "@/lib/default-emoji";
import { autoTagPlace } from "@/lib/auto-tag-place";
import { autoSummaryPlace } from "@/lib/auto-summary-place";

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
            },
            placeTags: {
              include: {
                tag: {
                  include: {
                    category: true
                  }
                }
              },
              orderBy: [
                { tag: { category: { searchWeight: "desc" } } },
                { tag: { sortOrder: "asc" } }
              ],
              take: 5
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
        topTags: sp.place.placeTags.map(pt => ({
          id: pt.tag.id,
          slug: pt.tag.slug,
          displayName: pt.tag.displayName,
          categorySlug: pt.tag.category.slug,
        })),
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

    let place = await prisma.place.upsert({
      where: { googlePlaceId },
      create: {
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
      update: {},
    });

    const placeUpdates: Record<string, any> = {};
    if (!place.neighborhood && (neighborhood || locality)) {
      placeUpdates.neighborhood = neighborhood || null;
      placeUpdates.locality = locality || null;
    }
    if ((!place.photoRefs || (Array.isArray(place.photoRefs) && (place.photoRefs as string[]).length === 0)) && photoRefs && photoRefs.length > 0) {
      placeUpdates.photoRefs = photoRefs;
    }
    if (Object.keys(placeUpdates).length > 0) {
      place = await prisma.place.update({
        where: { id: place.id },
        data: placeUpdates,
      });
    }

    const defaultEmoji = getDefaultEmoji(place.primaryType, place.types as string[] | null);

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
        emoji: defaultEmoji,
      },
      include: { place: true },
    });

    await createActivity({
      actorId: user.id,
      type: hasBeen ? "PLACE_MARKED_BEEN" : "PLACE_SAVED",
      placeId: place.id,
      metadata: { placeName: place.name, rating: hasBeen ? rating : undefined },
    });

    autoTagPlace(place.id).catch(() => {});
    autoSummaryPlace(place.id).catch(() => {});

    return NextResponse.json({ savedPlace });
  } catch (error: any) {
    console.error("Save place error:", error);
    return NextResponse.json({ error: "Failed to save place" }, { status: 500 });
  }
}
