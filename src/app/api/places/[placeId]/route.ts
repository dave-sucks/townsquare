import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function fetchAndCachePlaceFromGoogle(googlePlaceId: string) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("Google Maps API key not configured");
  }

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(googlePlaceId)}&fields=place_id,name,formatted_address,geometry,types,price_level,photos&key=${apiKey}`
  );

  const data = await response.json();
  
  if (data.status !== "OK" || !data.result) {
    return null;
  }

  const result = data.result;
  
  // Create or update the place in the database
  const place = await prisma.place.upsert({
    where: { googlePlaceId: result.place_id },
    create: {
      googlePlaceId: result.place_id,
      name: result.name,
      formattedAddress: result.formatted_address,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      types: result.types || [],
      primaryType: result.types?.[0] || null,
      priceLevel: result.price_level !== undefined ? `PRICE_LEVEL_${['FREE', 'INEXPENSIVE', 'MODERATE', 'EXPENSIVE', 'VERY_EXPENSIVE'][result.price_level] || 'MODERATE'}` : null,
      photoRefs: result.photos?.slice(0, 5).map((p: any) => p.photo_reference) || [],
    },
    update: {
      name: result.name,
      formattedAddress: result.formatted_address,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      types: result.types || [],
      primaryType: result.types?.[0] || null,
      priceLevel: result.price_level !== undefined ? `PRICE_LEVEL_${['FREE', 'INEXPENSIVE', 'MODERATE', 'EXPENSIVE', 'VERY_EXPENSIVE'][result.price_level] || 'MODERATE'}` : null,
      photoRefs: result.photos?.slice(0, 5).map((p: any) => p.photo_reference) || [],
    },
  });

  return place;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ placeId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { placeId } = await params;

  try {
    // First try to find the place in our database
    let place = await prisma.place.findUnique({
      where: { googlePlaceId: placeId },
    });

    // If not found locally, fetch from Google Places API and cache it
    if (!place) {
      place = await fetchAndCachePlaceFromGoogle(placeId);
    } else if (!place.photoRefs || place.photoRefs.length === 0) {
      // If place exists but has no photos, try to fetch them from Google
      const refreshedPlace = await fetchAndCachePlaceFromGoogle(placeId);
      if (refreshedPlace) {
        place = refreshedPlace;
      }
    }

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const savedPlace = await prisma.savedPlace.findUnique({
      where: {
        userId_placeId: {
          userId: user.id,
          placeId: place.id,
        },
      },
      select: {
        id: true,
        hasBeen: true,
        rating: true,
        emoji: true,
      },
    });

    const listsContainingPlace = await prisma.list.findMany({
      where: {
        userId: user.id,
        listPlaces: {
          some: {
            placeId: place.id,
          },
        },
      },
      include: {
        _count: {
          select: { listPlaces: true },
        },
      },
    });

    const following = await prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    const friendsWhoSaved = await prisma.savedPlace.findMany({
      where: {
        placeId: place.id,
        userId: { in: followingIds },
      },
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
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const myReview = await prisma.review.findFirst({
      where: {
        userId: user.id,
        placeId: place.id,
      },
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
        photos: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const reviews = await prisma.review.findMany({
      where: { placeId: place.id },
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
        photos: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const followedIds = new Set(followingIds);
    followedIds.add(user.id);
    const followedReviews = reviews.filter((r) => followedIds.has(r.userId));
    const otherReviews = reviews.filter((r) => !followedIds.has(r.userId));
    const sortedReviews = [...followedReviews, ...otherReviews];

    const photos = await prisma.photo.findMany({
      where: { placeId: place.id },
      orderBy: { createdAt: "desc" },
    });

    // Fetch tags for this place, grouped by category
    const placeTags = await prisma.placeTag.findMany({
      where: { placeId: place.id },
      include: {
        tag: {
          include: {
            category: true,
          },
        },
      },
      orderBy: [
        { tag: { category: { sortOrder: "asc" } } },
        { tag: { sortOrder: "asc" } },
      ],
    });

    // Transform tags into a grouped structure
    const tagsGrouped = placeTags.reduce((acc, pt) => {
      const categorySlug = pt.tag.category.slug;
      if (!acc[categorySlug]) {
        acc[categorySlug] = {
          category: {
            slug: pt.tag.category.slug,
            displayName: pt.tag.category.displayName,
            iconName: pt.tag.category.iconName,
            searchWeight: pt.tag.category.searchWeight,
          },
          tags: [],
        };
      }
      acc[categorySlug].tags.push({
        id: pt.tag.id,
        slug: pt.tag.slug,
        displayName: pt.tag.displayName,
        iconName: pt.tag.iconName,
      });
      return acc;
    }, {} as Record<string, { category: any; tags: any[] }>);

    const tags = Object.values(tagsGrouped);

    // Flat list of top tags for display in cards (sorted by category search weight)
    const topTags = placeTags
      .sort((a, b) => (b.tag.category.searchWeight || 1) - (a.tag.category.searchWeight || 1))
      .slice(0, 5)
      .map(pt => ({
        id: pt.tag.id,
        slug: pt.tag.slug,
        displayName: pt.tag.displayName,
        categorySlug: pt.tag.category.slug,
      }));

    // Fetch all activities related to this place
    const allActivitiesRaw = await prisma.activity.findMany({
      where: {
        placeId: place.id,
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
      take: 50,
    });

    // For REVIEW_CREATED activities, fetch the associated review data
    const reviewActivityActorIds = allActivitiesRaw
      .filter(a => a.type === "REVIEW_CREATED")
      .map(a => a.actorId);

    const reviewsWithInstagram = await prisma.review.findMany({
      where: {
        placeId: place.id,
        userId: { in: reviewActivityActorIds },
        instagramUrl: { not: null },
      },
      select: {
        userId: true,
        instagramUrl: true,
        instagramShortcode: true,
        socialPostCaption: true,
        socialPostMediaUrl: true,
        socialPostMediaType: true,
      },
    });

    // Create a map of userId -> review for quick lookup
    const reviewByUserId = new Map(reviewsWithInstagram.map(r => [r.userId, r]));

    // Transform activities to include socialPost data
    const allActivities = allActivitiesRaw.map(activity => {
      const review = activity.type === "REVIEW_CREATED" ? reviewByUserId.get(activity.actorId) : null;
      return {
        ...activity,
        socialPost: review?.instagramUrl ? {
          author: activity.actor.username || activity.actor.firstName || "User",
          authorImage: activity.actor.profileImageUrl,
          caption: review.socialPostCaption,
          mediaUrl: review.socialPostMediaUrl,
          mediaType: review.socialPostMediaType,
          permalink: review.instagramUrl,
          source: "instagram" as const,
        } : null,
      };
    });

    // Filter activities from people the user follows (+ own activities)
    const followingSet = new Set([...followingIds, user.id]);
    const followingActivities = allActivities.filter(a => followingSet.has(a.actorId));

    return NextResponse.json({
      place,
      savedPlace,
      listsContainingPlace,
      friendsWhoSaved,
      myReview,
      reviews: sortedReviews,
      photos,
      tags,
      topTags,
      activities: allActivities,
      followingActivities,
    });
  } catch (error: any) {
    console.error("Get place error:", error?.message || error);
    console.error("Stack:", error?.stack);
    return NextResponse.json({ error: "Failed to get place", details: error?.message }, { status: 500 });
  }
}
