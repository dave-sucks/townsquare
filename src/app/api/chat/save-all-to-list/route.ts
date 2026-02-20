import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";
import { getDefaultEmoji } from "@/lib/default-emoji";
import { autoTagPlace } from "@/lib/auto-tag-place";
import { autoSummaryPlace } from "@/lib/auto-summary-place";

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
    const { listName, listId, places } = body as { listName?: string; listId?: string; places: PlaceData[] };

    if (!places || places.length === 0) {
      return NextResponse.json({ error: "At least one place is required" }, { status: 400 });
    }

    let list;
    if (listId) {
      list = await prisma.list.findFirst({
        where: { id: listId, userId: user.id },
      });
      if (!list) {
        return NextResponse.json({ error: "List not found" }, { status: 404 });
      }
    } else {
      const autoName = listName?.trim() || `Saved Places (${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;
      list = await prisma.list.create({
        data: {
          userId: user.id,
          name: autoName,
          visibility: "PRIVATE",
        },
      });
    }

    let savedCount = 0;

    for (const placeData of places) {
      let place = await prisma.place.upsert({
        where: { googlePlaceId: placeData.googlePlaceId },
        create: {
          googlePlaceId: placeData.googlePlaceId,
          name: placeData.name,
          formattedAddress: placeData.formattedAddress,
          lat: placeData.lat,
          lng: placeData.lng,
          types: placeData.types || [],
          primaryType: placeData.primaryType,
          priceLevel: placeData.priceLevel ?? null,
          photoRefs: placeData.photoRef ? [placeData.photoRef] : [],
        },
        update: {
          name: placeData.name,
          formattedAddress: placeData.formattedAddress,
          types: placeData.types ?? undefined,
          primaryType: placeData.primaryType ?? undefined,
          priceLevel: placeData.priceLevel ?? undefined,
          photoRefs: placeData.photoRef ? [placeData.photoRef] : undefined,
        },
      });

      let savedPlace = await prisma.savedPlace.findUnique({
        where: {
          userId_placeId: {
            userId: user.id,
            placeId: place.id,
          },
        },
      });

      if (!savedPlace) {
        const emoji = placeData.emoji || getDefaultEmoji(placeData.primaryType, placeData.types);
        savedPlace = await prisma.savedPlace.create({
          data: {
            userId: user.id,
            placeId: place.id,
            hasBeen: false,
            emoji,
          },
        });
      } else if (!savedPlace.emoji) {
        const fallbackEmoji = placeData.emoji || getDefaultEmoji(placeData.primaryType, placeData.types);
        await prisma.savedPlace.update({
          where: { id: savedPlace.id },
          data: { emoji: fallbackEmoji },
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

      autoTagPlace(place.id).catch(() => {});
      autoSummaryPlace(place.id).catch(() => {});
    }

    if (!listId) {
      await createActivity({
        actorId: user.id,
        type: "LIST_CREATED",
        listId: list.id,
        metadata: { listName: list.name, placeCount: savedCount },
      });
    }

    return NextResponse.json({ 
      list: { id: list.id, name: list.name },
      savedCount,
    });
  } catch (error: any) {
    console.error("Save all to list error:", error);
    return NextResponse.json({ error: "Failed to save places to list" }, { status: 500 });
  }
}
