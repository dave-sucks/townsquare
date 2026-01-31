import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createPhotoSchema = z.object({
  placeId: z.string().min(1),
  reviewId: z.string().optional().nullable(),
  url: z.string().min(1),
  width: z.number().int().optional().nullable(),
  height: z.number().int().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createPhotoSchema.parse(body);

    const place = await prisma.place.findUnique({
      where: { id: validated.placeId },
    });
    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    if (validated.reviewId) {
      const review = await prisma.review.findUnique({
        where: { id: validated.reviewId },
      });
      if (!review || review.userId !== user.id) {
        return NextResponse.json({ error: "Review not found or not owned by user" }, { status: 404 });
      }
    }

    const photo = await prisma.photo.create({
      data: {
        userId: user.id,
        placeId: validated.placeId,
        reviewId: validated.reviewId || null,
        url: validated.url,
        width: validated.width || null,
        height: validated.height || null,
      },
    });

    return NextResponse.json(photo);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Error creating photo:", error);
    return NextResponse.json({ error: "Failed to create photo" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get("id");
    if (!photoId) {
      return NextResponse.json({ error: "Photo ID required" }, { status: 400 });
    }

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
    });
    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    if (photo.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.photo.delete({ where: { id: photoId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting photo:", error);
    return NextResponse.json({ error: "Failed to delete photo" }, { status: 500 });
  }
}
