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
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    const following = await prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });

    const followingIds = following.map((f) => f.followingId);
    const actorIds = [user.id, ...followingIds];

    const activities = await prisma.activity.findMany({
      where: {
        actorId: { in: actorIds },
        type: "REVIEW_CREATED",
      },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true,
          },
        },
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
          select: {
            id: true,
            name: true,
            visibility: true,
            userId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = activities.length > limit;
    const items = hasMore ? activities.slice(0, limit) : activities;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // Fetch reviews for REVIEW_CREATED activities to get the actual note
    const reviewActivityIds = items
      .filter((a) => a.type === "REVIEW_CREATED" && a.placeId)
      .map((a) => ({ actorId: a.actorId, placeId: a.placeId! }));

    const reviews = reviewActivityIds.length > 0
      ? await prisma.review.findMany({
          where: {
            OR: reviewActivityIds.map((r) => ({
              userId: r.actorId,
              placeId: r.placeId,
            })),
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

    const reviewMap = new Map(
      reviews.map((r) => [`${r.userId}-${r.placeId}`, r])
    );

    const filteredItems = items.map((activity) => {
      if (activity.list && activity.list.visibility === "PRIVATE" && activity.list.userId !== user.id) {
        return { ...activity, list: null };
      }
      // Enrich REVIEW_CREATED activities with the actual review note and social post data
      if (activity.type === "REVIEW_CREATED" && activity.placeId) {
        const review = reviewMap.get(`${activity.actorId}-${activity.placeId}`);
        if (review) {
          const hasSocialPost = review.instagramUrl || review.socialPostMediaUrl || review.socialPostCaption;
          return {
            ...activity,
            metadata: {
              ...((activity.metadata as any) || {}),
              rating: review.rating,
              note: review.note,
            },
            socialPost: hasSocialPost ? {
              // Author comes from the activity actor (the user who created the review)
              author: activity.actor.username || `${activity.actor.firstName} ${activity.actor.lastName}`.trim(),
              authorImage: activity.actor.profileImageUrl,
              caption: review.socialPostCaption,
              mediaUrl: review.socialPostMediaUrl,
              mediaType: review.socialPostMediaType,
              likes: review.socialPostLikes,
              postedAt: review.socialPostPostedAt?.toISOString(),
              permalink: review.instagramUrl,
              source: review.source as 'instagram' | 'tiktok' | 'manual',
            } : null,
          };
        }
      }
      return activity;
    });

    return NextResponse.json({
      activities: filteredItems,
      nextCursor,
      hasMore,
    });
  } catch (error: any) {
    console.error("Get feed error:", error);
    return NextResponse.json({ error: "Failed to get feed" }, { status: 500 });
  }
}
