import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const photoRef = request.nextUrl.searchParams.get("photoRef");
  const maxWidth = request.nextUrl.searchParams.get("maxWidth") || "400";

  if (!photoRef) {
    return NextResponse.json({ error: "photoRef is required" }, { status: 400 });
  }

  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
    }

    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(photoRef)}&key=${apiKey}`;
    
    const response = await fetch(photoUrl);
    
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch photo" }, { status: 500 });
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
