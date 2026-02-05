import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();

  try {
    const list = await prisma.list.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true,
          },
        },
        listPlaces: {
          include: { 
            place: {
              include: {
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
                },
                savedPlaces: true
              }
            }
          },
          orderBy: { addedAt: "desc" },
        },
        _count: {
          select: { listPlaces: true },
        },
      },
    });

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    if (list.visibility === "PRIVATE" && (!user || list.userId !== user.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerSavedPlaceEmojis: Record<string, string | null> = {};
    list.listPlaces.forEach(lp => {
      const ownerSavedPlace = lp.place.savedPlaces.find(sp => sp.userId === list.userId);
      if (ownerSavedPlace) {
        ownerSavedPlaceEmojis[lp.placeId] = ownerSavedPlace.emoji;
      }
    });

    const formattedList = {
      ...list,
      listPlaces: list.listPlaces.map(lp => ({
        ...lp,
        emoji: ownerSavedPlaceEmojis[lp.placeId] || null,
        place: {
          id: lp.place.id,
          googlePlaceId: lp.place.googlePlaceId,
          name: lp.place.name,
          formattedAddress: lp.place.formattedAddress,
          neighborhood: lp.place.neighborhood,
          locality: lp.place.locality,
          lat: lp.place.lat,
          lng: lp.place.lng,
          primaryType: lp.place.primaryType,
          types: lp.place.types,
          priceLevel: lp.place.priceLevel,
          photoRefs: lp.place.photoRefs,
          topTags: lp.place.placeTags.map(pt => ({
            id: pt.tag.id,
            slug: pt.tag.slug,
            displayName: pt.tag.displayName,
            categorySlug: pt.tag.category.slug,
          })),
        },
      })),
    };

    return NextResponse.json({ list: formattedList });
  } catch (error: any) {
    console.error("Get list error:", error);
    return NextResponse.json({ error: "Failed to get list" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const existingList = await prisma.list.findUnique({
      where: { id },
    });

    if (!existingList) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    if (existingList.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, visibility } = body;

    if (visibility && visibility !== "PRIVATE" && visibility !== "PUBLIC") {
      return NextResponse.json({ error: "Invalid visibility. Must be PRIVATE or PUBLIC" }, { status: 400 });
    }

    const list = await prisma.list.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(visibility !== undefined && { visibility }),
      },
      include: {
        _count: {
          select: { listPlaces: true },
        },
      },
    });

    return NextResponse.json({ list });
  } catch (error: any) {
    console.error("Update list error:", error);
    return NextResponse.json({ error: "Failed to update list" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const existingList = await prisma.list.findUnique({
      where: { id },
    });

    if (!existingList) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    if (existingList.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.list.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete list error:", error);
    return NextResponse.json({ error: "Failed to delete list" }, { status: 500 });
  }
}
