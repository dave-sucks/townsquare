import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const ACTOR_SELECT = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
};

const ACTIVITY_INCLUDE = {
  actor: { select: ACTOR_SELECT },
  place: {
    select: {
      id: true,
      googlePlaceId: true,
      name: true,
      formattedAddress: true,
      photoRefs: true,
    },
  },
  list: {
    select: { id: true, name: true, visibility: true, userId: true },
  },
};

async function enrichActivities(items: any[], user: { id: string }) {
  const reviewActivityIds = items
    .filter((a) => a.type === "REVIEW_CREATED" && a.placeId)
    .map((a) => ({ actorId: a.actorId, placeId: a.placeId! }));

  const reviews =
    reviewActivityIds.length > 0
      ? await prisma.review.findMany({
          where: {
            OR: reviewActivityIds.map((r) => ({ userId: r.actorId, placeId: r.placeId })),
          },
          select: {
            userId: true,
            placeId: true,
            rating: true,
            note: true,
            source: true,
            instagramUrl: true,
            socialPostCaption: true,
            socialPostMediaUrl: true,
            socialPostMediaType: true,
            socialPostLikes: true,
            socialPostPostedAt: true,
          },
        })
      : [];

  const reviewMap = new Map(reviews.map((r) => [`${r.userId}-${r.placeId}`, r]));

  return items.map((activity) => {
    if (
      activity.list &&
      activity.list.visibility === "PRIVATE" &&
      activity.list.userId !== user.id
    ) {
      return { ...activity, list: null };
    }
    if (activity.type === "REVIEW_CREATED" && activity.placeId) {
      const review = reviewMap.get(`${activity.actorId}-${activity.placeId}`);
      if (review) {
        const hasSocialPost =
          review.instagramUrl || review.socialPostMediaUrl || review.socialPostCaption;
        return {
          ...activity,
          metadata: {
            ...((activity.metadata as any) || {}),
            rating: review.rating,
            note: review.note,
          },
          socialPost: hasSocialPost
            ? {
                author:
                  activity.actor.username ||
                  `${activity.actor.firstName} ${activity.actor.lastName}`.trim(),
                authorImage: activity.actor.profileImageUrl,
                caption: review.socialPostCaption,
                mediaUrl: review.socialPostMediaUrl,
                mediaType: review.socialPostMediaType,
                likes: review.socialPostLikes,
                postedAt: review.socialPostPostedAt?.toISOString(),
                permalink: review.instagramUrl,
                source: review.source as "instagram" | "tiktok" | "manual",
              }
            : null,
        };
      }
    }
    return activity;
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const filter = searchParams.get("filter") || "nearby";

    const following = await prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    // ── Nearby filter ──────────────────────────────────────────────────────
    if (filter === "nearby") {
      const lat = parseFloat(searchParams.get("lat") || "0");
      const lng = parseFloat(searchParams.get("lng") || "0");
      const radius = parseFloat(searchParams.get("radius") || "2");

      if (!lat || !lng) {
        // No location: fall back to all activity
        const activities = await prisma.activity.findMany({
          where: { type: "REVIEW_CREATED" },
          include: ACTIVITY_INCLUDE,
          orderBy: { createdAt: "desc" },
          take: limit + 1,
          ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        });

        const hasMore = activities.length > limit;
        const items = hasMore ? activities.slice(0, limit) : activities;
        const nextCursor = hasMore ? items[items.length - 1].id : null;
        const enriched = await enrichActivities(items, user);

        return NextResponse.json({
          activities: enriched,
          nextCursor,
          hasMore,
          hasFollowing: followingIds.length > 0,
        });
      }

      const latDelta = radius / 69;
      const lngDelta = radius / (69 * Math.cos((lat * Math.PI) / 180));

      // Get nearby place IDs
      const nearbyPlaces = await prisma.place.findMany({
        where: {
          lat: { gte: lat - latDelta, lte: lat + latDelta },
          lng: { gte: lng - lngDelta, lte: lng + lngDelta },
        },
        select: { id: true, lat: true, lng: true },
      });

      const nearbyPlaceIds = nearbyPlaces
        .filter((p) => haversineDistance(lat, lng, p.lat, p.lng) <= radius)
        .map((p) => p.id);

      if (nearbyPlaceIds.length === 0) {
        return NextResponse.json({
          activities: [],
          hasMore: false,
          nextCursor: null,
          hasFollowing: followingIds.length > 0,
        });
      }

      const activities = await prisma.activity.findMany({
        where: {
          type: "REVIEW_CREATED",
          placeId: { in: nearbyPlaceIds },
        },
        include: ACTIVITY_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });

      const hasMore = activities.length > limit;
      const items = hasMore ? activities.slice(0, limit) : activities;
      const nextCursor = hasMore ? items[items.length - 1].id : null;
      const enriched = await enrichActivities(items, user);

      return NextResponse.json({
        activities: enriched,
        nextCursor,
        hasMore,
        hasFollowing: followingIds.length > 0,
      });
    }

    // ── All / Following filters ────────────────────────────────────────────
    let actorFilter: any;
    if (filter === "all") {
      actorFilter = {};
    } else {
      const actorIds = [user.id, ...followingIds];
      actorFilter = { actorId: { in: actorIds } };
    }

    const activities = await prisma.activity.findMany({
      where: {
        ...actorFilter,
        type: "REVIEW_CREATED",
      },
      include: ACTIVITY_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = activities.length > limit;
    const items = hasMore ? activities.slice(0, limit) : activities;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    const enriched = await enrichActivities(items, user);

    return NextResponse.json({
      activities: enriched,
      nextCursor,
      hasMore,
      hasFollowing: followingIds.length > 0,
    });
  } catch (error: any) {
    console.error("Get feed error:", error);
    return NextResponse.json({ error: "Failed to get feed" }, { status: 500 });
  }
}
