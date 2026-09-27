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
      priceLevel: result.price_level != null ? result.price_level.toString() : null,
      photoRefs: result.photos?.slice(0, 5).map((p: any) => p.photo_reference) || [],
    },
    update: {
      name: result.name,
      formattedAddress: result.formatted_address,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      types: result.types || [],
      primaryType: result.types?.[0] || null,
      priceLevel: result.price_level != null ? result.price_level.toString() : null,
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
    } else if (!place.photoRefs || (place.photoRefs as any[]).length === 0) {
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
        placeId: true,
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

    // Every creator post that mentions this place, each with this place's own
    // excerpt. (A roundup has one activity, at its primary place; the mention
    // is what puts it on every place it names.)
    const mentionActivities = reviews
      .filter((r) => r.instagramUrl)
      .map((r) => ({
        id: `review-${r.id}`,
        actorId: r.userId,
        type: "REVIEW_CREATED" as const,
        placeId: place.id,
        listId: null,
        metadata: { note: r.note, rating: r.rating },
        dedupeKey: `review-${r.id}`,
        createdAt: r.socialPostPostedAt ?? r.createdAt,
        actor: r.user,
        place: {
          id: place.id,
          googlePlaceId: place.googlePlaceId,
          name: place.name,
          formattedAddress: place.formattedAddress,
          photoRefs: place.photoRefs,
        },
        list: null,
        socialPost: {
          author: r.user.username || r.user.firstName || "User",
          authorImage: r.user.profileImageUrl,
          caption: r.socialPostCaption,
          excerpt: r.excerpt,
          mediaUrl: r.socialPostMediaUrl,
          mediaType: r.socialPostMediaType,
          permalink: r.instagramUrl,
          source: "instagram" as const,
        },
      }));

    // Reviews written in the app (no Instagram post) keep their activity.
    const mentionActors = new Set(mentionActivities.map((a) => a.actorId));
    const appReviewActivities = await prisma.activity.findMany({
      where: { placeId: place.id, type: "REVIEW_CREATED", actorId: { notIn: [...mentionActors] } },
      include: {
        actor: { select: { id: true, username: true, firstName: true, lastName: true, profileImageUrl: true } },
        place: { select: { id: true, googlePlaceId: true, name: true, formattedAddress: true, photoRefs: true } },
        list: { select: { id: true, name: true, visibility: true, userId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const allActivities = [
      ...mentionActivities,
      ...appReviewActivities.map((a) => ({ ...a, socialPost: null })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);

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
