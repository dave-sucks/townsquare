import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  validateInstagramUrl,
  extractShortcode,
  importInstagramPost,
} from "@/lib/instagram";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_URL", message: "URL is required" } },
        { status: 400 }
      );
    }

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

    const existingUser = await prisma.user.findFirst({
      where: { instagramHandle: postData.username },
    });

    let matchedPlace = null;
    if (postData.location?.name) {
      matchedPlace = await prisma.place.findFirst({
        where: {
          name: {
            contains: postData.location.name,
            mode: "insensitive",
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        instagram_user: {
          username: postData.username,
          profile_pic_url: postData.profilePicUrl,
          is_verified: postData.isVerified,
          exists_in_db: !!existingUser,
        },
        location: postData.location
          ? {
              name: postData.location.name,
              city: postData.location.city,
              state: postData.location.state,
              address: postData.location.address,
              matched_place_id: matchedPlace?.id || null,
              confidence: postData.location.confidence,
              source: postData.location.source,
            }
          : null,
        caption: postData.caption,
        media_type: postData.mediaType,
        media_urls: postData.mediaUrls,
        thumbnail_url: postData.thumbnailUrl,
        timestamp: postData.timestamp,
        already_imported: false,
      },
    });
  } catch (error: any) {
    console.error("Error previewing Instagram post:", error);

    const errorCode = error.message;
    const errorMessages: Record<string, string> = {
      INVALID_URL: "Not a valid Instagram URL",
      POST_NOT_FOUND: "Instagram post not found or is private",
      INSTAGRAM_API_ERROR: "Failed to fetch data from Instagram",
    };

    if (errorMessages[errorCode]) {
      return NextResponse.json(
        { success: false, error: { code: errorCode, message: errorMessages[errorCode] } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to preview Instagram post" } },
      { status: 500 }
    );
  }
}
