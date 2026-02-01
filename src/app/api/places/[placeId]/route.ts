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

    const myReview = await prisma.review.findUnique({
      where: {
        userId_placeId: {
          userId: user.id,
          placeId: place.id,
        },
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

    return NextResponse.json({
      place,
      savedPlace,
      listsContainingPlace,
      friendsWhoSaved,
      myReview,
      reviews: sortedReviews,
      photos,
    });
  } catch (error: any) {
    console.error("Get place error:", error?.message || error);
    console.error("Stack:", error?.stack);
    return NextResponse.json({ error: "Failed to get place", details: error?.message }, { status: 500 });
  }
}
