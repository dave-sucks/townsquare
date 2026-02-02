import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const placeId = request.nextUrl.searchParams.get("place_id");
  if (!placeId) {
    return NextResponse.json({ error: "place_id is required" }, { status: 400 });
  }

  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=place_id,name,formatted_address,address_components,geometry,types,price_level,photos&key=${apiKey}`
    );

    const data = await response.json();
    
    if (data.status !== "OK") {
      console.error("Google Places Details API error:", data);
      return NextResponse.json({ error: "Failed to get place details" }, { status: 500 });
    }

    const result = data.result;
    
    const addressComponents = result.address_components || [];
    let neighborhood: string | null = null;
    let locality: string | null = null;
    
    for (const component of addressComponents) {
      const types = component.types || [];
      if (types.includes("neighborhood") && !neighborhood) {
        neighborhood = component.long_name;
      }
      if (types.includes("sublocality_level_1") && !neighborhood) {
        neighborhood = component.long_name;
      }
      if (types.includes("sublocality") && !neighborhood) {
        neighborhood = component.long_name;
      }
      if (types.includes("locality") && !locality) {
        locality = component.long_name;
      }
    }
    
    return NextResponse.json({
      place: {
        googlePlaceId: result.place_id,
        name: result.name,
        formattedAddress: result.formatted_address,
        neighborhood,
        locality,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        types: result.types || [],
        primaryType: result.types?.[0] || null,
        priceLevel: result.price_level?.toString() || null,
        photoRefs: result.photos?.slice(0, 5).map((p: any) => p.photo_reference) || [],
      },
    });
  } catch (error: any) {
    console.error("Place details error:", error);
    return NextResponse.json({ error: "Failed to get place details" }, { status: 500 });
  }
}
