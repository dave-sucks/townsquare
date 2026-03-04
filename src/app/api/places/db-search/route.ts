import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const lat = parseFloat(searchParams.get("lat") || "0");
    const lng = parseFloat(searchParams.get("lng") || "0");
    const radius = parseFloat(searchParams.get("radius") || "50");

    const whereClause: any = {};

    if (q) {
      whereClause.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { neighborhood: { contains: q, mode: "insensitive" } },
        { formattedAddress: { contains: q, mode: "insensitive" } },
      ];
    }

    if (lat && lng && radius < 100) {
      const latDelta = radius / 69;
      const lngDelta = radius / (69 * Math.cos((lat * Math.PI) / 180));
      whereClause.lat = { gte: lat - latDelta, lte: lat + latDelta };
      whereClause.lng = { gte: lng - lngDelta, lte: lng + lngDelta };
    }

    const places = await prisma.place.findMany({
      where: whereClause,
      include: {
        placeTags: {
          include: { tag: true },
          take: 3,
          orderBy: { tag: { sortOrder: "asc" } },
        },
        _count: { select: { savedPlaces: true } },
      },
      take: 8,
      orderBy: { savedPlaces: { _count: "desc" } },
    });

    // Trending counts for found places
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const placeIds = places.map((p) => p.id);
    const trendingCounts =
      placeIds.length > 0
        ? await prisma.review.groupBy({
            by: ["placeId"],
            where: { placeId: { in: placeIds }, socialPostPostedAt: { gte: thirtyDaysAgo } },
            _count: { id: true },
          })
        : [];
    const trendingMap = new Map(trendingCounts.map((t) => [t.placeId, t._count.id]));

    return NextResponse.json({
      places: places.map((p) => ({
        id: p.id,
        googlePlaceId: p.googlePlaceId,
        name: p.name,
        formattedAddress: p.formattedAddress,
        neighborhood: p.neighborhood,
        lat: p.lat,
        lng: p.lng,
        primaryType: p.primaryType,
        priceLevel: p.priceLevel,
        photoRefs: p.photoRefs,
        saveCount: p._count.savedPlaces,
        trendingCount: trendingMap.get(p.id) || 0,
        topTags: p.placeTags.map((pt) => ({
          slug: pt.tag.slug,
          displayName: pt.tag.displayName,
        })),
      })),
    });
  } catch (error) {
    console.error("DB search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
