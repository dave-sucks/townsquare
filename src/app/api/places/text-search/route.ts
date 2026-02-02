import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("query");
  const location = request.nextUrl.searchParams.get("location");
  
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
    }

    const searchQuery = location ? `${query} in ${location}` : query;
    
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}`
    );

    const data = await response.json();
    
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Google Places Text Search API error:", data);
      return NextResponse.json({ error: "Failed to search places" }, { status: 500 });
    }

    const places = (data.results || []).slice(0, 5).map((result: any) => ({
      googlePlaceId: result.place_id,
      name: result.name,
      formattedAddress: result.formatted_address,
      lat: result.geometry?.location?.lat,
      lng: result.geometry?.location?.lng,
      types: result.types || [],
      primaryType: result.types?.[0] || null,
      priceLevel: result.price_level?.toString() || null,
      rating: result.rating || null,
      userRatingsTotal: result.user_ratings_total || null,
      photoRef: result.photos?.[0]?.photo_reference || null,
    }));

    return NextResponse.json({ places });
  } catch (error: any) {
    console.error("Places text search error:", error);
    return NextResponse.json({ error: "Failed to search places" }, { status: 500 });
  }
}
