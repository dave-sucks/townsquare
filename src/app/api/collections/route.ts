import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const collection = searchParams.get("collection");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 50);

    if (collection === "following") {
      const followedUserIds = await prisma.follow.findMany({
        where: { followerId: user.id },
        select: { followingId: true },
      });

      const ids = followedUserIds.map((f) => f.followingId);

      if (ids.length === 0) {
        return NextResponse.json({ places: [], hasMore: false });
      }

      const savedPlaces = await prisma.savedPlace.findMany({
        where: { userId: { in: ids } },
        include: {
          place: {
            include: {
              placeTags: {
                include: { tag: { include: { category: true } } },
                orderBy: [
                  { tag: { category: { searchWeight: "desc" } } },
                  { tag: { sortOrder: "asc" } },
                ],
                take: 5,
              },
            },
          },
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profileImageUrl: true,
            },
          },
        },
        take: limit + 1,
        orderBy: { createdAt: "desc" },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const placeIds = savedPlaces.map((sp) => sp.placeId);
      const currentUserSavedPlaces = await prisma.savedPlace.findMany({
        where: { userId: user.id, placeId: { in: placeIds } },
      });
      const currentUserListPlaces = await prisma.listPlace.findMany({
        where: { placeId: { in: placeIds }, list: { userId: user.id } },
        include: { list: { select: { id: true, name: true } } },
      });
      const placeToLists: Record<string, Array<{ id: string; name: string }>> = {};
      for (const lp of currentUserListPlaces) {
        if (!placeToLists[lp.placeId]) placeToLists[lp.placeId] = [];
        placeToLists[lp.placeId].push({ id: lp.list.id, name: lp.list.name });
      }
      const currentUserPlaceData: Record<string, any> = {};
      for (const pid of placeIds) {
        const sp = currentUserSavedPlaces.find((s) => s.placeId === pid);
        currentUserPlaceData[pid] = {
          savedPlaceId: sp?.id || null,
          hasBeen: sp?.hasBeen || false,
          rating: sp?.rating || null,
          emoji: sp?.emoji || null,
          lists: placeToLists[pid] || [],
        };
      }

      const hasMore = savedPlaces.length > limit;
      const items = hasMore ? savedPlaces.slice(0, limit) : savedPlaces;
      const nextCursor = hasMore ? items[items.length - 1].id : null;

      const mapped = items.map((sp) => ({
        id: sp.id,
        userId: sp.userId,
        placeId: sp.placeId,
        hasBeen: false,
        rating: null,
        emoji: null,
        visitedAt: null,
        createdAt: sp.createdAt.toISOString(),
        place: {
          id: sp.place.id,
          googlePlaceId: sp.place.googlePlaceId,
          name: sp.place.name,
          formattedAddress: sp.place.formattedAddress,
          lat: sp.place.lat,
          lng: sp.place.lng,
          primaryType: sp.place.primaryType,
          types: sp.place.types,
          priceLevel: sp.place.priceLevel,
          photoRefs: sp.place.photoRefs,
          neighborhood: sp.place.neighborhood,
          locality: sp.place.locality,
          topTags: sp.place.placeTags.map((pt) => ({
            id: pt.tag.id,
            slug: pt.tag.slug,
            displayName: pt.tag.displayName,
            categorySlug: pt.tag.category.slug,
          })),
        },
        savedBy: sp.user,
      }));

      return NextResponse.json({ places: mapped, currentUserPlaceData, hasMore, nextCursor });
    }

    if (collection === "burgers") {
      const burgerTags = await prisma.tag.findMany({
        where: {
          slug: { in: ["burgers", "smashburger"] },
        },
        select: { id: true },
      });

      const tagIds = burgerTags.map((t) => t.id);

      let placeIds: string[] = [];
      if (tagIds.length > 0) {
        const taggedPlaces = await prisma.placeTag.findMany({
          where: { tagId: { in: tagIds } },
          select: { placeId: true },
          distinct: ["placeId"],
        });
        placeIds = taggedPlaces.map((tp) => tp.placeId);
      }

      const burgerPlacesByName = await prisma.place.findMany({
        where: {
          OR: [
            ...(placeIds.length > 0 ? [{ id: { in: placeIds } }] : []),
            { name: { contains: "burger", mode: "insensitive" as const } },
            { name: { contains: "smash", mode: "insensitive" as const } },
          ],
        },
        take: 50,
      });

      const allPlaceIds = burgerPlacesByName.map((p) => p.id);

      const savedPlaces = await prisma.savedPlace.findMany({
        where: { placeId: { in: allPlaceIds } },
        include: {
          place: {
            include: {
              placeTags: {
                include: { tag: { include: { category: true } } },
                orderBy: [
                  { tag: { category: { searchWeight: "desc" } } },
                  { tag: { sortOrder: "asc" } },
                ],
                take: 5,
              },
            },
          },
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profileImageUrl: true,
            },
          },
        },
        distinct: ["placeId"],
        take: 50,
        orderBy: { createdAt: "desc" },
      });

      const uniquePlaceIds = new Set(savedPlaces.map((sp) => sp.placeId));
      const unsavedPlaces = burgerPlacesByName.filter(
        (p) => !uniquePlaceIds.has(p.id)
      );

      const allBurgerPlaceIds = allPlaceIds;
      const currentUserSavedPlaces2 = await prisma.savedPlace.findMany({
        where: { userId: user.id, placeId: { in: allBurgerPlaceIds } },
      });
      const currentUserListPlaces2 = await prisma.listPlace.findMany({
        where: { placeId: { in: allBurgerPlaceIds }, list: { userId: user.id } },
        include: { list: { select: { id: true, name: true } } },
      });
      const placeToLists2: Record<string, Array<{ id: string; name: string }>> = {};
      for (const lp of currentUserListPlaces2) {
        if (!placeToLists2[lp.placeId]) placeToLists2[lp.placeId] = [];
        placeToLists2[lp.placeId].push({ id: lp.list.id, name: lp.list.name });
      }
      const currentUserPlaceData2: Record<string, any> = {};
      for (const pid of allBurgerPlaceIds) {
        const sp = currentUserSavedPlaces2.find((s) => s.placeId === pid);
        currentUserPlaceData2[pid] = {
          savedPlaceId: sp?.id || null,
          hasBeen: sp?.hasBeen || false,
          rating: sp?.rating || null,
          emoji: sp?.emoji || null,
          lists: placeToLists2[pid] || [],
        };
      }

      const mapped = savedPlaces.map((sp) => ({
        id: sp.id,
        userId: sp.userId,
        placeId: sp.placeId,
        hasBeen: false,
        rating: null,
        emoji: null,
        visitedAt: null,
        createdAt: sp.createdAt.toISOString(),
        place: {
          id: sp.place.id,
          googlePlaceId: sp.place.googlePlaceId,
          name: sp.place.name,
          formattedAddress: sp.place.formattedAddress,
          lat: sp.place.lat,
          lng: sp.place.lng,
          primaryType: sp.place.primaryType,
          types: sp.place.types,
          priceLevel: sp.place.priceLevel,
          photoRefs: sp.place.photoRefs,
          neighborhood: sp.place.neighborhood,
          locality: sp.place.locality,
          topTags: sp.place.placeTags.map((pt) => ({
            id: pt.tag.id,
            slug: pt.tag.slug,
            displayName: pt.tag.displayName,
            categorySlug: pt.tag.category.slug,
          })),
        },
        savedBy: sp.user,
      }));

      const unsavedMapped = unsavedPlaces.map((p) => ({
        id: `unsaved-${p.id}`,
        userId: null,
        placeId: p.id,
        hasBeen: false,
        rating: null,
        emoji: null,
        visitedAt: null,
        createdAt: new Date().toISOString(),
        place: {
          id: p.id,
          googlePlaceId: p.googlePlaceId,
          name: p.name,
          formattedAddress: p.formattedAddress,
          lat: p.lat,
          lng: p.lng,
          primaryType: p.primaryType,
          types: p.types,
          priceLevel: p.priceLevel,
          photoRefs: p.photoRefs,
          neighborhood: p.neighborhood,
          locality: p.locality,
          topTags: [],
        },
        savedBy: null,
      }));

      return NextResponse.json({ places: [...mapped, ...unsavedMapped], currentUserPlaceData: currentUserPlaceData2, hasMore: false, nextCursor: null });
    }

    return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
  } catch (error) {
    console.error("Collections API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch collection" },
      { status: 500 }
    );
  }
}
