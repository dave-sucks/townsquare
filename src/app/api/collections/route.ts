import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// ── Helpers ─────────────────────────────────────────────────────────────────

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function getBoundingBox(lat: number, lng: number, radiusMiles: number) {
  const latDelta = radiusMiles / 69;
  const lngDelta = radiusMiles / (69 * Math.cos((lat * Math.PI) / 180));
  return { latDelta, lngDelta };
}

async function buildCurrentUserPlaceData(userId: string, placeIds: string[]) {
  if (placeIds.length === 0) return {};
  const [savedPlaces, listPlaces] = await Promise.all([
    prisma.savedPlace.findMany({ where: { userId, placeId: { in: placeIds } } }),
    prisma.listPlace.findMany({
      where: { placeId: { in: placeIds }, list: { userId } },
      include: { list: { select: { id: true, name: true } } },
    }),
  ]);
  const placeToLists: Record<string, Array<{ id: string; name: string }>> = {};
  for (const lp of listPlaces) {
    if (!placeToLists[lp.placeId]) placeToLists[lp.placeId] = [];
    placeToLists[lp.placeId].push({ id: lp.list.id, name: lp.list.name });
  }
  const result: Record<string, any> = {};
  for (const pid of placeIds) {
    const sp = savedPlaces.find((s) => s.placeId === pid);
    result[pid] = {
      savedPlaceId: sp?.id || null,
      hasBeen: sp?.hasBeen || false,
      rating: sp?.rating || null,
      emoji: sp?.emoji || null,
      lists: placeToLists[pid] || [],
    };
  }
  return result;
}

const PLACE_TAGS_INCLUDE = {
  placeTags: {
    include: { tag: { include: { category: true } } },
    orderBy: [
      { tag: { category: { searchWeight: "desc" as const } } },
      { tag: { sortOrder: "asc" as const } },
    ],
    take: 5,
  },
};

function mapPlaceToResult(
  place: any,
  overrides: {
    id?: string;
    userId?: string | null;
    saveCount?: number;
    trendingCount?: number;
    savedBy?: any;
  } = {}
) {
  return {
    id: overrides.id ?? `place-${place.id}`,
    userId: overrides.userId ?? null,
    placeId: place.id,
    hasBeen: false,
    rating: null,
    emoji: null,
    visitedAt: null,
    createdAt: new Date().toISOString(),
    saveCount: overrides.saveCount ?? (place._count?.savedPlaces ?? 0),
    trendingCount: overrides.trendingCount ?? 0,
    place: {
      id: place.id,
      googlePlaceId: place.googlePlaceId,
      name: place.name,
      formattedAddress: place.formattedAddress,
      lat: place.lat,
      lng: place.lng,
      primaryType: place.primaryType,
      types: place.types,
      priceLevel: place.priceLevel,
      photoRefs: place.photoRefs,
      neighborhood: place.neighborhood,
      locality: place.locality,
      topTags: (place.placeTags || []).map((pt: any) => ({
        id: pt.tag.id,
        slug: pt.tag.slug,
        displayName: pt.tag.displayName,
        categorySlug: pt.tag.category?.slug,
      })),
    },
    savedBy: overrides.savedBy ?? null,
  };
}

// ── Route ────────────────────────────────────────────────────────────────────

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

    // ── Nearby ─────────────────────────────────────────────────────────────
    if (collection === "nearby") {
      const lat = parseFloat(searchParams.get("lat") || "0");
      const lng = parseFloat(searchParams.get("lng") || "0");
      const radius = parseFloat(searchParams.get("radius") || "1");
      const tags = searchParams.getAll("tag");
      const priceLevel = searchParams.get("price");

      if (!lat || !lng) {
        return NextResponse.json({ places: [], hasMore: false, nextCursor: null });
      }

      const { latDelta, lngDelta } = getBoundingBox(lat, lng, radius);

      const places = await prisma.place.findMany({
        where: {
          lat: { gte: lat - latDelta, lte: lat + latDelta },
          lng: { gte: lng - lngDelta, lte: lng + lngDelta },
          ...(tags.length > 0 ? { placeTags: { some: { tag: { slug: { in: tags } } } } } : {}),
          ...(priceLevel ? { priceLevel } : {}),
        },
        include: {
          ...PLACE_TAGS_INCLUDE,
          _count: { select: { savedPlaces: true } },
        },
        take: 300,
      });

      // Precise Haversine filter
      const withDist = places
        .map((p) => ({ ...p, _dist: haversineDistance(lat, lng, p.lat, p.lng) }))
        .filter((p) => p._dist <= radius);

      // Sort: save count desc, then distance asc
      withDist.sort((a, b) => {
        const diff = b._count.savedPlaces - a._count.savedPlaces;
        return diff !== 0 ? diff : a._dist - b._dist;
      });

      const cursorIdx = cursor
        ? withDist.findIndex((p) => `place-${p.id}` === cursor) + 1
        : 0;
      const pageItems = withDist.slice(cursorIdx, cursorIdx + limit);
      const hasMore = cursorIdx + limit < withDist.length;
      const nextCursor =
        hasMore && pageItems.length > 0 ? `place-${pageItems[pageItems.length - 1].id}` : null;

      const placeIds = pageItems.map((p) => p.id);
      const currentUserPlaceData = await buildCurrentUserPlaceData(user.id, placeIds);

      const mapped = pageItems.map((p) =>
        mapPlaceToResult(p, { saveCount: p._count.savedPlaces })
      );

      return NextResponse.json({ places: mapped, currentUserPlaceData, hasMore, nextCursor });
    }

    // ── Trending ───────────────────────────────────────────────────────────
    if (collection === "trending") {
      const lat = parseFloat(searchParams.get("lat") || "0");
      const lng = parseFloat(searchParams.get("lng") || "0");
      const radius = parseFloat(searchParams.get("radius") || "5");
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const postCounts = await prisma.review.groupBy({
        by: ["placeId"],
        where: { socialPostPostedAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 300,
      });

      if (postCounts.length === 0) {
        // Fallback: most saved places overall
        const fallbackWhere: any = {};
        if (lat && lng) {
          const { latDelta, lngDelta } = getBoundingBox(lat, lng, radius);
          fallbackWhere.lat = { gte: lat - latDelta, lte: lat + latDelta };
          fallbackWhere.lng = { gte: lng - lngDelta, lte: lng + lngDelta };
        }
        const fallbackPlaces = await prisma.place.findMany({
          where: fallbackWhere,
          include: {
            ...PLACE_TAGS_INCLUDE,
            _count: { select: { savedPlaces: true } },
          },
          orderBy: { savedPlaces: { _count: "desc" } },
          take: 100,
        });
        const pageItems = fallbackPlaces.slice(0, limit);
        const hasMore = fallbackPlaces.length > limit;
        const placeIds = pageItems.map((p) => p.id);
        const currentUserPlaceData = await buildCurrentUserPlaceData(user.id, placeIds);
        return NextResponse.json({
          places: pageItems.map((p) => mapPlaceToResult(p, { saveCount: p._count.savedPlaces })),
          currentUserPlaceData,
          hasMore,
          nextCursor: null,
        });
      }

      const trendingPlaceIds = postCounts.map((r) => r.placeId);
      const countMap = new Map(postCounts.map((r) => [r.placeId, r._count.id]));

      const whereClause: any = { id: { in: trendingPlaceIds } };
      if (lat && lng) {
        const { latDelta, lngDelta } = getBoundingBox(lat, lng, radius);
        whereClause.lat = { gte: lat - latDelta, lte: lat + latDelta };
        whereClause.lng = { gte: lng - lngDelta, lte: lng + lngDelta };
      }

      const places = await prisma.place.findMany({
        where: whereClause,
        include: {
          ...PLACE_TAGS_INCLUDE,
          _count: { select: { savedPlaces: true } },
        },
      });

      // Haversine filter if location provided
      let filtered = places;
      if (lat && lng) {
        filtered = places.filter((p) => haversineDistance(lat, lng, p.lat, p.lng) <= radius);
      }

      // Sort by trending count desc
      filtered.sort((a, b) => (countMap.get(b.id) || 0) - (countMap.get(a.id) || 0));

      const cursorIdx = cursor
        ? filtered.findIndex((p) => `place-${p.id}` === cursor) + 1
        : 0;
      const pageItems = filtered.slice(cursorIdx, cursorIdx + limit);
      const hasMore = cursorIdx + limit < filtered.length;
      const nextCursor =
        hasMore && pageItems.length > 0 ? `place-${pageItems[pageItems.length - 1].id}` : null;

      const placeIds = pageItems.map((p) => p.id);
      const currentUserPlaceData = await buildCurrentUserPlaceData(user.id, placeIds);

      const mapped = pageItems.map((p) =>
        mapPlaceToResult(p, {
          saveCount: p._count.savedPlaces,
          trendingCount: countMap.get(p.id) || 0,
        })
      );

      return NextResponse.json({ places: mapped, currentUserPlaceData, hasMore, nextCursor });
    }

    // ── For You ────────────────────────────────────────────────────────────
    if (collection === "for-you") {
      const lat = parseFloat(searchParams.get("lat") || "0");
      const lng = parseFloat(searchParams.get("lng") || "0");
      const radius = parseFloat(searchParams.get("radius") || "5");

      // Get user's top-rated saved places
      const topRatedSaves = await prisma.savedPlace.findMany({
        where: { userId: user.id, rating: { gte: 4 } },
        include: {
          place: { include: { placeTags: { select: { tagId: true } } } },
        },
        orderBy: { rating: "desc" },
        take: 30,
      });

      const userSavedIds = await prisma.savedPlace.findMany({
        where: { userId: user.id },
        select: { placeId: true },
      });
      const savedIds = userSavedIds.map((sp) => sp.placeId);

      const topTagIds = [
        ...new Set(topRatedSaves.flatMap((sp) => sp.place.placeTags.map((pt) => pt.tagId))),
      ];

      const whereClause: any = {
        ...(savedIds.length > 0 ? { id: { notIn: savedIds } } : {}),
        ...(topTagIds.length > 0
          ? { placeTags: { some: { tagId: { in: topTagIds } } } }
          : {}),
      };

      if (lat && lng) {
        const { latDelta, lngDelta } = getBoundingBox(lat, lng, radius);
        whereClause.lat = { gte: lat - latDelta, lte: lat + latDelta };
        whereClause.lng = { gte: lng - lngDelta, lte: lng + lngDelta };
      }

      const places = await prisma.place.findMany({
        where: whereClause,
        include: {
          ...PLACE_TAGS_INCLUDE,
          _count: { select: { savedPlaces: true } },
        },
        take: 200,
      });

      // Sort by save count
      places.sort((a, b) => b._count.savedPlaces - a._count.savedPlaces);

      const cursorIdx = cursor
        ? places.findIndex((p) => `place-${p.id}` === cursor) + 1
        : 0;
      const pageItems = places.slice(cursorIdx, cursorIdx + limit);
      const hasMore = cursorIdx + limit < places.length;
      const nextCursor =
        hasMore && pageItems.length > 0 ? `place-${pageItems[pageItems.length - 1].id}` : null;

      const placeIds = pageItems.map((p) => p.id);
      const currentUserPlaceData = await buildCurrentUserPlaceData(user.id, placeIds);

      const mapped = pageItems.map((p) =>
        mapPlaceToResult(p, { saveCount: p._count.savedPlaces })
      );

      const reason =
        topTagIds.length === 0
          ? "Popular places you haven't saved yet"
          : `Based on your ${topRatedSaves.length} top-rated places`;

      return NextResponse.json({ places: mapped, currentUserPlaceData, hasMore, nextCursor, reason });
    }

    // ── Following ──────────────────────────────────────────────────────────
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
              ...PLACE_TAGS_INCLUDE,
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
      const currentUserPlaceData = await buildCurrentUserPlaceData(user.id, placeIds);

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
        saveCount: 0,
        trendingCount: 0,
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

    // ── Burgers (legacy) ───────────────────────────────────────────────────
    if (collection === "burgers") {
      const burgerTags = await prisma.tag.findMany({
        where: { slug: { in: ["burgers", "smashburger"] } },
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
          place: { include: { ...PLACE_TAGS_INCLUDE } },
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

      const currentUserPlaceData = await buildCurrentUserPlaceData(user.id, allPlaceIds);

      const uniquePlaceIds = new Set(savedPlaces.map((sp) => sp.placeId));
      const unsavedPlaces = burgerPlacesByName.filter((p) => !uniquePlaceIds.has(p.id));

      const mapped = savedPlaces.map((sp) => ({
        id: sp.id,
        userId: sp.userId,
        placeId: sp.placeId,
        hasBeen: false,
        rating: null,
        emoji: null,
        visitedAt: null,
        createdAt: sp.createdAt.toISOString(),
        saveCount: 0,
        trendingCount: 0,
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
        saveCount: 0,
        trendingCount: 0,
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

      return NextResponse.json({
        places: [...mapped, ...unsavedMapped],
        currentUserPlaceData,
        hasMore: false,
        nextCursor: null,
      });
    }

    return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
  } catch (error) {
    console.error("Collections API error:", error);
    return NextResponse.json({ error: "Failed to fetch collection" }, { status: 500 });
  }
}
