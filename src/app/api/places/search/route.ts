import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ predictions: [] });
  }

  const lat = request.nextUrl.searchParams.get("lat");
  const lng = request.nextUrl.searchParams.get("lng");

  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
    }

    let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}`;

    if (lat && lng) {
      url += `&location=${lat},${lng}&radius=50000`;
    }

    const response = await fetch(url);

    const data = await response.json();
    
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Google Places API error:", data);
      return NextResponse.json({ error: "Failed to search places" }, { status: 500 });
    }

    return NextResponse.json({
      predictions: data.predictions || [],
    });
  } catch (error: any) {
    console.error("Places search error:", error);
    return NextResponse.json({ error: "Failed to search places" }, { status: 500 });
  }
}
