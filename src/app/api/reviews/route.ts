import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";
import { z } from "zod";

const createReviewSchema = z.object({
  placeId: z.string().min(1),
  rating: z.number().int().min(0).max(10),
  note: z.string().optional().nullable(),
  visitedAt: z.string().datetime().optional().nullable(),
});

const updateReviewSchema = z.object({
  rating: z.number().int().min(0).max(10).optional(),
  note: z.string().optional().nullable(),
  visitedAt: z.string().datetime().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get("placeId");
    const userId = searchParams.get("userId");

    const where: any = {};
    if (placeId) where.placeId = placeId;
    if (userId) where.userId = userId;

    const reviews = await prisma.review.findMany({
      where,
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
        place: {
          select: {
            id: true,
            googlePlaceId: true,
            name: true,
          },
        },
        photos: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (user && placeId) {
      const followedUserIds = await prisma.follow.findMany({
        where: { followerId: user.id },
        select: { followingId: true },
      });
      const followedIds = new Set(followedUserIds.map((f) => f.followingId));
      followedIds.add(user.id);

      const followed = reviews.filter((r) => followedIds.has(r.userId));
      const others = reviews.filter((r) => !followedIds.has(r.userId));
      return NextResponse.json([...followed, ...others]);
    }

    return NextResponse.json(reviews);
  } catch (error: any) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createReviewSchema.parse(body);

    const place = await prisma.place.findUnique({
      where: { id: validated.placeId },
    });
    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const existingReview = await prisma.review.findUnique({
      where: {
        userId_placeId: {
          userId: user.id,
          placeId: validated.placeId,
        },
      },
    });
    if (existingReview) {
      return NextResponse.json({ error: "Review already exists" }, { status: 409 });
    }

    const review = await prisma.review.create({
      data: {
        userId: user.id,
        placeId: validated.placeId,
        rating: validated.rating,
        note: validated.note || null,
        visitedAt: validated.visitedAt ? new Date(validated.visitedAt) : null,
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
        place: {
          select: {
            id: true,
            googlePlaceId: true,
            name: true,
          },
        },
        photos: true,
      },
    });

    await createActivity({
      actorId: user.id,
      type: "REVIEW_CREATED",
      placeId: validated.placeId,
      metadata: { rating: validated.rating, placeName: place.name, note: validated.note || null },
    });

    return NextResponse.json(review);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Error creating review:", error);
    return NextResponse.json({ error: "Failed to create review" }, { status: 500 });
  }
}
