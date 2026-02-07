import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";

interface PlaceData {
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  types: string[];
  primaryType: string | null;
  priceLevel: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
  photoRef: string | null;
  emoji: string | null;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { listName, places } = body as { listName: string; places: PlaceData[] };

    if (!listName?.trim()) {
      return NextResponse.json({ error: "List name is required" }, { status: 400 });
    }

    if (!places || places.length === 0) {
      return NextResponse.json({ error: "At least one place is required" }, { status: 400 });
    }

    const list = await prisma.list.create({
      data: {
        userId: user.id,
        name: listName.trim(),
        visibility: "PRIVATE",
      },
    });

    let savedCount = 0;

    for (const placeData of places) {
      let place = await prisma.place.findUnique({
        where: { googlePlaceId: placeData.googlePlaceId },
      });

      if (!place) {
        place = await prisma.place.create({
          data: {
            googlePlaceId: placeData.googlePlaceId,
            name: placeData.name,
            formattedAddress: placeData.formattedAddress,
            lat: placeData.lat,
            lng: placeData.lng,
            types: placeData.types,
            primaryType: placeData.primaryType,
            priceLevel: placeData.priceLevel,
            photoRefs: placeData.photoRef ? [placeData.photoRef] : [],
          },
        });
      }

      let savedPlace = await prisma.savedPlace.findUnique({
        where: {
          userId_placeId: {
            userId: user.id,
            placeId: place.id,
          },
        },
      });

      if (!savedPlace) {
        savedPlace = await prisma.savedPlace.create({
          data: {
            userId: user.id,
            placeId: place.id,
            hasBeen: false,
            emoji: placeData.emoji,
          },
        });
      } else if (placeData.emoji && !savedPlace.emoji) {
        await prisma.savedPlace.update({
          where: { id: savedPlace.id },
          data: { emoji: placeData.emoji },
        });
      }

      const existingListPlace = await prisma.listPlace.findUnique({
        where: {
          listId_placeId: {
            listId: list.id,
            placeId: place.id,
          },
        },
      });

      if (!existingListPlace) {
        await prisma.listPlace.create({
          data: {
            listId: list.id,
            placeId: place.id,
          },
        });
        savedCount++;
      }
    }

    await createActivity({
      actorId: user.id,
      type: "LIST_CREATED",
      listId: list.id,
      metadata: { listName: list.name, placeCount: savedCount },
    });

    return NextResponse.json({ 
      list: { id: list.id, name: list.name },
      savedCount,
    });
  } catch (error: any) {
    console.error("Save all to list error:", error);
    return NextResponse.json({ error: "Failed to save places to list" }, { status: 500 });
  }
}
