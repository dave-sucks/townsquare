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
    console.log("Instagram post data:", JSON.stringify(postData, null, 2));

    // Check for existing import record (from a failed previous attempt)
    // and delete it if it's not completed
    const existingImport = await prisma.instagramImport.findFirst({
      where: { instagramPostId: postData.instagramPostId },
    });
    
    if (existingImport) {
      if (existingImport.status === "completed") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "ALREADY_IMPORTED",
              message: "This Instagram post has already been imported",
            },
          },
          { status: 409 }
        );
      }
      // Delete the incomplete import record to retry
      await prisma.instagramImport.delete({
        where: { id: existingImport.id },
      });
    }

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

      // First try to find existing place by name
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
        // Search Google Places API for the real place
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          await prisma.instagramImport.update({
            where: { id: importRecord.id },
            data: { status: "failed", errorMessage: "Google Maps API key not configured" },
          });
          return NextResponse.json(
            { success: false, error: { code: "CONFIG_ERROR", message: "Google Maps API not configured" } },
            { status: 500 }
          );
        }

        // Build search query with location context
        const searchQuery = [locationName, city, state].filter(Boolean).join(", ");
        console.log("Searching Google Places for:", searchQuery);
        
        // Use Google Places Text Search to find the place
        const searchResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}`
        );
        const searchData = await searchResponse.json();
        console.log("Google Places search response status:", searchData.status);

        if (searchData.status !== "OK" || !searchData.results?.length) {
          await prisma.instagramImport.update({
            where: { id: importRecord.id },
            data: { status: "failed", errorMessage: `Could not find "${locationName}" on Google Maps` },
          });
          return NextResponse.json(
            { success: false, error: { code: "PLACE_NOT_FOUND", message: `Could not find "${locationName}" on Google Maps. Try a different post or check the location name.` } },
            { status: 400 }
          );
        }

        const googlePlace = searchData.results[0];
        
        // Get detailed place info
        const detailsResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(googlePlace.place_id)}&fields=place_id,name,formatted_address,geometry,types,price_level,photos&key=${apiKey}`
        );
        const detailsData = await detailsResponse.json();
        
        if (detailsData.status !== "OK") {
          await prisma.instagramImport.update({
            where: { id: importRecord.id },
            data: { status: "failed", errorMessage: "Failed to get place details from Google" },
          });
          return NextResponse.json(
            { success: false, error: { code: "PLACE_DETAILS_ERROR", message: "Failed to get place details from Google Maps" } },
            { status: 500 }
          );
        }

        const placeDetails = detailsData.result;
        
        // Check again if this place already exists by googlePlaceId
        place = await prisma.place.findUnique({
          where: { googlePlaceId: placeDetails.place_id },
        });

        if (!place) {
          const photoRefs = placeDetails.photos?.slice(0, 5).map((p: any) => p.photo_reference) || [];
          
          place = await prisma.place.create({
            data: {
              googlePlaceId: placeDetails.place_id,
              name: placeDetails.name,
              formattedAddress: placeDetails.formatted_address,
              lat: placeDetails.geometry.location.lat,
              lng: placeDetails.geometry.location.lng,
              primaryType: placeDetails.types?.[0] || "restaurant",
              types: JSON.stringify(placeDetails.types || ["restaurant"]),
              priceLevel: placeDetails.price_level != null ? String(placeDetails.price_level) : null,
              photoRefs: photoRefs.length > 0 ? JSON.stringify(photoRefs) : undefined,
            },
          });
          placeCreated = true;
        }
      }

      const note = overrides?.note
        ? `${postData.caption || ""}\n\n${overrides.note}`.trim()
        : postData.caption || "";

      // CRITICAL: Create SavedPlace BEFORE Review - enforces business rule
      // Use transaction to ensure atomic creation of all related records
      
      // Check if importing user already has this place saved (before transaction)
      const existingImporterSave = await prisma.savedPlace.findFirst({
        where: { userId: user.id, placeId: place.id },
      });
      const importerSavedPlaceIsNew = !existingImporterSave;
      
      const result = await prisma.$transaction(async (tx) => {
        // Step 1: Create/update SavedPlace for the Instagram user (BEEN status)
        const savedPlaceForInstagramUser = await tx.savedPlace.upsert({
          where: {
            userId_placeId: {
              userId: instagramUser.id,
              placeId: place.id,
            },
          },
          update: {
            hasBeen: true,
            visitedAt: postData.timestamp ? new Date(postData.timestamp) : new Date(),
          },
          create: {
            userId: instagramUser.id,
            placeId: place.id,
            hasBeen: true,
            rating: 2, // Default to "Okay"
            visitedAt: postData.timestamp ? new Date(postData.timestamp) : new Date(),
          },
        });

        // Step 2: Create/update SavedPlace for the importing user (saved but not visited)
        const savedPlaceForImporter = await tx.savedPlace.upsert({
          where: {
            userId_placeId: {
              userId: user.id,
              placeId: place.id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            placeId: place.id,
            hasBeen: false,
          },
        });

        // Step 3: Now create the Review (SavedPlace exists, rule satisfied)
        const review = await tx.review.create({
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

        // Step 4: Create photos for the review
        const isCarousel = postData.mediaUrls.length > 1;
        const photos = [];
        for (let i = 0; i < postData.mediaUrls.length; i++) {
          const photo = await tx.photo.create({
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

        return { review, photos };
      });

      const { review, photos } = result;

      // Update import record
      await prisma.instagramImport.update({
        where: { id: importRecord.id },
        data: {
          status: "completed",
          userId: instagramUser.id,
          placeId: place.id,
          reviewId: review.id,
        },
      });

      // Create activity for the importing user only if this was a NEW save
      if (importerSavedPlaceIsNew) {
        await createActivity({
          actorId: user.id,
          type: "PLACE_SAVED",
          placeId: place.id,
          metadata: {
            placeName: place.name,
            source: "instagram_import",
          },
        });
      }

      // Create activity for the Instagram user's review
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
    console.error("Error stack:", error.stack);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);

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
