import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = await params;

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { id: username },
        ],
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isOwnProfile = user.id === currentUser.id;

    const isFollowing = !isOwnProfile && await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUser.id,
          followingId: user.id,
        },
      },
    }) !== null;

    const followerCount = await prisma.follow.count({
      where: { followingId: user.id },
    });

    const followingCount = await prisma.follow.count({
      where: { followerId: user.id },
    });

    const wantPlaces = await prisma.savedPlace.findMany({
      where: {
        userId: user.id,
        hasBeen: false,
      },
      include: { place: true },
      orderBy: { createdAt: "desc" },
    });

    const beenPlaces = await prisma.savedPlace.findMany({
      where: {
        userId: user.id,
        hasBeen: true,
      },
      include: { place: true },
      orderBy: { createdAt: "desc" },
    });

    const lists = await prisma.list.findMany({
      where: {
        userId: user.id,
        ...(isOwnProfile ? {} : { visibility: "PUBLIC" }),
      },
      include: {
        _count: {
          select: { listPlaces: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const reviews = await prisma.review.findMany({
      where: { userId: user.id },
      include: {
        place: {
          select: {
            id: true,
            googlePlaceId: true,
            name: true,
            formattedAddress: true,
            lat: true,
            lng: true,
            primaryType: true,
            types: true,
            priceLevel: true,
            photoRefs: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get user's activities for the feed tab
    const activities = await prisma.activity.findMany({
      where: { actorId: user.id },
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
      take: 50,
    });

    // Fetch reviews for REVIEW_CREATED activities to get the actual note
    const reviewActivityIds = activities
      .filter((a) => a.type === "REVIEW_CREATED" && a.placeId)
      .map((a) => ({ actorId: a.actorId, placeId: a.placeId! }));

    const activityReviews = reviewActivityIds.length > 0
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
      activityReviews.map((r) => [`${r.userId}-${r.placeId}`, r])
    );

    // Filter out private list activities and enrich review activities
    const filteredActivities = activities
      .filter((activity) => {
        if (activity.list && activity.list.visibility === "PRIVATE" && activity.list.userId !== currentUser.id) {
          return false;
        }
        return true;
      })
      .map((activity) => {
        // Enrich REVIEW_CREATED activities with the actual review note and social post data
        if (activity.type === "REVIEW_CREATED" && activity.placeId) {
          const review = reviewMap.get(`${activity.actorId}-${activity.placeId}`);
          if (review) {
            const hasSocialPost = review.socialPostMediaUrl || review.socialPostCaption;
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

    // Get all saved places with full place data for map display
    const allSavedPlaces = await prisma.savedPlace.findMany({
      where: { userId: user.id },
      include: {
        place: {
          select: {
            id: true,
            googlePlaceId: true,
            name: true,
            formattedAddress: true,
            lat: true,
            lng: true,
            primaryType: true,
            types: true,
            priceLevel: true,
            photoRefs: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // When viewing another user's profile, get the current user's save status for these places
    let currentUserPlaceData: Record<string, {
      savedPlaceId: string | null;
      hasBeen: boolean;
      rating: number | null;
      lists: Array<{ id: string; name: string }>;
    }> = {};

    if (!isOwnProfile) {
      // Get all place IDs from the profile
      const placeIds = allSavedPlaces.map(sp => sp.placeId);
      
      // Get current user's saves for these places
      const currentUserSaves = await prisma.savedPlace.findMany({
        where: {
          userId: currentUser.id,
          placeId: { in: placeIds },
        },
        select: {
          id: true,
          placeId: true,
          hasBeen: true,
          rating: true,
        },
      });

      // Get current user's lists that contain these places
      const currentUserListPlaces = await prisma.listPlace.findMany({
        where: {
          placeId: { in: placeIds },
          list: { userId: currentUser.id },
        },
        include: {
          list: {
            select: { id: true, name: true },
          },
        },
      });

      // Build a map of placeId -> listIds for current user
      const placeListsMap: Record<string, Array<{ id: string; name: string }>> = {};
      for (const lp of currentUserListPlaces) {
        if (!placeListsMap[lp.placeId]) {
          placeListsMap[lp.placeId] = [];
        }
        placeListsMap[lp.placeId].push({ id: lp.list.id, name: lp.list.name });
      }

      // Build the currentUserPlaceData map
      for (const placeId of placeIds) {
        const userSave = currentUserSaves.find(s => s.placeId === placeId);
        currentUserPlaceData[placeId] = {
          savedPlaceId: userSave?.id || null,
          hasBeen: userSave?.hasBeen || false,
          rating: userSave?.rating || null,
          lists: placeListsMap[placeId] || [],
        };
      }
    }

    // Get list places for list filtering (only visible lists)
    const listsWithPlaces = await prisma.list.findMany({
      where: {
        userId: user.id,
        ...(isOwnProfile ? {} : { visibility: "PUBLIC" }),
      },
      include: {
        listPlaces: {
          select: { placeId: true },
        },
        _count: {
          select: { listPlaces: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      user,
      isOwnProfile,
      isFollowing,
      followerCount,
      followingCount,
      wantPlaces,
      beenPlaces,
      allSavedPlaces,
      lists: listsWithPlaces,
      reviews,
      activities: filteredActivities,
      currentUserPlaceData: isOwnProfile ? null : currentUserPlaceData,
    });
  } catch (error: any) {
    console.error("Get user profile error:", error);
    return NextResponse.json({ error: "Failed to get user profile" }, { status: 500 });
  }
}
