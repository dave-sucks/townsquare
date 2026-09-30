import { NextRequest, NextResponse } from "next/server";
import { refreshStalePhotoRef } from "@/lib/places/google";

export async function GET(request: NextRequest) {
  const photoRef = request.nextUrl.searchParams.get("photoRef");
  const maxWidth = request.nextUrl.searchParams.get("maxWidth") || "400";
  // The place's Google id, so a reference the place no longer stores can still heal.
  const placeId = request.nextUrl.searchParams.get("placeId");

  if (!photoRef) {
    return NextResponse.json({ error: "photoRef is required" }, { status: 400 });
  }

  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
    }

    const photoFor = (ref: string) =>
      fetch(`https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(ref)}&key=${apiKey}`);

    let response = await photoFor(photoRef);

    // Stored references expire; refresh the place's references and retry once.
    if (!response.ok) {
      const refresh = (force: boolean) =>
        refreshStalePhotoRef(photoRef, placeId, force).catch((e) => {
          console.error("[places/photo] refresh failed:", e);
          return null;
        });
      const fresh = await refresh(false);
      if (fresh) response = await photoFor(fresh);
      // The place's current references were stale too: fetch new ones.
      if (!response.ok && placeId) {
        const forced = await refresh(true);
        if (forced) response = await photoFor(forced);
      }
    }

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch photo" }, { status: 502 });
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (error: any) {
    console.error("Photo fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch photo" }, { status: 500 });
  }
}
