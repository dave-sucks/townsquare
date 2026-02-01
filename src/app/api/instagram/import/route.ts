import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";
import {
  validateInstagramUrl,
  extractShortcode,
  importInstagramPost,
} from "@/lib/instagram";
import { z } from "zod";

const importSchema = z.object({
  url: z.string().url(),
  overrides: z.object({
    place_name: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    note: z.string().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = importSchema.parse(body);
    const { url, overrides } = validated;

    if (!validateInstagramUrl(url)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_URL", message: "Not a valid Instagram URL" } },
        { status: 400 }
      );
    }

    const shortcode = extractShortcode(url);
    if (!shortcode) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_URL", message: "Could not extract post ID from URL" } },
        { status: 400 }
      );
    }

    const existingReview = await prisma.review.findFirst({
      where: { instagramShortcode: shortcode },
      select: { id: true },
    });

    if (existingReview) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ALREADY_IMPORTED",
            message: "This Instagram post has already been imported",
            existing_review_id: existingReview.id,
          },
        },
        { status: 409 }
      );
    }

    const postData = await importInstagramPost(url);

    let importRecord = await prisma.instagramImport.create({
      data: {
        instagramPostId: postData.instagramPostId,
        instagramUrl: postData.instagramUrl,
        instagramShortcode: postData.instagramShortcode,
        status: "processing",
        importedBy: user.id,
        rawData: postData as any,
      },
    });

    try {
      let instagramUser = await prisma.user.findFirst({
        where: { instagramHandle: postData.username },
      });

      let userCreated = false;
      if (!instagramUser) {
        instagramUser = await prisma.user.create({
          data: {
            username: postData.username,
            instagramHandle: postData.username,
            instagramId: postData.authorId || null,
            firstName: postData.username,
            lastName: "",
            isInstagramImport: true,
            isVerified: postData.isVerified || false,
            profileImageUrl: postData.profilePicUrl || null,
            instagramPostCount: 1,
            lastInstagramSync: new Date(),
          },
        });
        userCreated = true;
      } else {
        await prisma.user.update({
          where: { id: instagramUser.id },
          data: {
            instagramPostCount: { increment: 1 },
            lastInstagramSync: new Date(),
          },
        });
      }

      const locationName = overrides?.place_name || postData.location?.name;
      const city = overrides?.city || postData.location?.city;
      const state = overrides?.state || postData.location?.state;

      if (!locationName) {
        await prisma.instagramImport.update({
          where: { id: importRecord.id },
          data: { status: "failed", errorMessage: "No location found in post" },
        });
        return NextResponse.json(
          { success: false, error: { code: "NO_LOCATION", message: "Could not detect a location from this post" } },
          { status: 400 }
        );
      }

      let place = await prisma.place.findFirst({
        where: {
          name: {
            contains: locationName,
            mode: "insensitive",
          },
        },
      });

      let placeCreated = false;
      if (!place) {
        const formattedAddress = [city, state].filter(Boolean).join(", ") || "Unknown Location";
        
        place = await prisma.place.create({
          data: {
            googlePlaceId: `instagram_import_${shortcode}_${Date.now()}`,
            name: locationName,
            formattedAddress,
            lat: 0,
            lng: 0,
            primaryType: "restaurant",
            types: JSON.stringify(["restaurant"]),
          },
        });
        placeCreated = true;
      }

      const note = overrides?.note
        ? `${postData.caption || ""}\n\n${overrides.note}`.trim()
        : postData.caption || "";

      const review = await prisma.review.create({
        data: {
          userId: instagramUser.id,
          placeId: place.id,
          rating: null,
          note,
          visitedAt: postData.timestamp ? new Date(postData.timestamp) : new Date(),
          instagramPostId: postData.instagramPostId,
          instagramUrl: postData.instagramUrl,
          instagramEmbedHtml: postData.instagramEmbedHtml,
          instagramShortcode: postData.instagramShortcode,
          source: "instagram",
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profileImageUrl: true,
              instagramHandle: true,
            },
          },
          place: {
            select: {
              id: true,
              googlePlaceId: true,
              name: true,
              formattedAddress: true,
            },
          },
        },
      });

      const isCarousel = postData.mediaUrls.length > 1;
      const photos = [];

      for (let i = 0; i < postData.mediaUrls.length; i++) {
        const photo = await prisma.photo.create({
          data: {
            userId: instagramUser.id,
            placeId: place.id,
            reviewId: review.id,
            url: postData.mediaUrls[i],
            carouselPosition: i,
            isCarousel,
          },
        });
        photos.push(photo);
      }

      await prisma.instagramImport.update({
        where: { id: importRecord.id },
        data: {
          status: "completed",
          userId: instagramUser.id,
          placeId: place.id,
          reviewId: review.id,
        },
      });

      // Save the place to the importing user's account as "WANT to go"
      const existingSavedPlace = await prisma.savedPlace.findFirst({
        where: {
          userId: user.id,
          placeId: place.id,
        },
      });

      let savedPlaceCreated = false;
      if (!existingSavedPlace) {
        await prisma.savedPlace.create({
          data: {
            userId: user.id,
            placeId: place.id,
            status: "WANT",
          },
        });
        savedPlaceCreated = true;

        // Create activity for the importing user saving the place
        await createActivity({
          actorId: user.id,
          type: "PLACE_SAVED_WANT",
          placeId: place.id,
          metadata: {
            placeName: place.name,
            source: "instagram_import",
          },
        });
      }

      await createActivity({
        actorId: instagramUser.id,
        type: "REVIEW_CREATED",
        placeId: place.id,
        metadata: {
          placeName: place.name,
          source: "instagram",
          instagramShortcode: postData.instagramShortcode,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          import_id: importRecord.id,
          user: {
            id: instagramUser.id,
            username: instagramUser.username,
            created: userCreated,
          },
          place: {
            id: place.id,
            name: place.name,
            created: placeCreated,
          },
          review: {
            id: review.id,
            rating: review.rating,
            note: review.note,
            instagram_embed_html: review.instagramEmbedHtml,
            photos: photos.map((p) => ({
              id: p.id,
              url: p.url,
              carousel_position: p.carouselPosition,
            })),
          },
        },
      });
    } catch (error: any) {
      console.error("Error during import processing:", error);

      await prisma.instagramImport.update({
        where: { id: importRecord.id },
        data: { status: "failed", errorMessage: error.message },
      });

      throw error;
    }
  } catch (error: any) {
    console.error("Error importing Instagram post:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request body" } },
        { status: 400 }
      );
    }

    const errorCode = error.message;
    const errorMessages: Record<string, string> = {
      INVALID_URL: "Not a valid Instagram URL",
      POST_NOT_FOUND: "Instagram post not found or is private",
      INSTAGRAM_API_ERROR: "Failed to fetch data from Instagram",
      NO_LOCATION: "Could not detect a location from this post",
    };

    if (errorMessages[errorCode]) {
      return NextResponse.json(
        { success: false, error: { code: errorCode, message: errorMessages[errorCode] } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to import Instagram post" } },
      { status: 500 }
    );
  }
}
