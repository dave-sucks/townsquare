/**
 * Google Places fallback for places Townsquare doesn't have yet — ported
 * from the old chat route (searchPlaces + persistPlaces), so the agent can
 * answer beyond our creators' posts and every result becomes a real Place
 * row (with a fresh photo reference) that can be saved and listed.
 *
 * Enrichment (AI summary) goes on the Job queue; nothing LLM-shaped runs
 * inline in a tool call.
 */

import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/worker/queue";

export type GoogleResult = {
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  types: string[];
  primaryType: string | null;
  priceLevel: string | null;
  photoRefs: string[];
};

type TextSearchResult = {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: { location?: { lat: number; lng: number } };
  types?: string[];
  price_level?: number;
  photos?: { photo_reference: string }[];
};

/** Legacy Text Search, biased to a point when we have one. */
export async function googleTextSearch(
  query: string,
  opts: { near?: { lat: number; lng: number }; radiusMeters?: number; limit?: number } = {},
): Promise<GoogleResult[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("Google Maps API key not configured");

  const params = new URLSearchParams({ query, key: apiKey });
  if (opts.near) {
    params.set("location", `${opts.near.lat},${opts.near.lng}`);
    params.set("radius", String(opts.radiusMeters ?? 3000));
  }
  const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
  const data = (await res.json()) as { status: string; results?: TextSearchResult[]; error_message?: string };
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`);
  }

  return (data.results ?? [])
    .filter((r) => r.geometry?.location)
    .slice(0, opts.limit ?? 6)
    .map((r) => ({
      googlePlaceId: r.place_id,
      name: r.name,
      formattedAddress: r.formatted_address ?? "",
      lat: r.geometry!.location!.lat,
      lng: r.geometry!.location!.lng,
      types: r.types ?? [],
      primaryType: r.types?.[0] ?? null,
      priceLevel: r.price_level != null ? String(r.price_level) : null,
      photoRefs: (r.photos ?? []).slice(0, 5).map((p) => p.photo_reference),
    }));
}

/** Neighborhood + locality from Place Details address components. */
async function neighborhoodFor(googlePlaceId: string): Promise<{ neighborhood: string | null; locality: string | null }> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { neighborhood: null, locality: null };
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(googlePlaceId)}&fields=address_components&key=${apiKey}`,
    );
    const data = (await res.json()) as {
      status: string;
      result?: { address_components?: { long_name: string; types: string[] }[] };
    };
    if (data.status !== "OK") return { neighborhood: null, locality: null };
    let neighborhood: string | null = null;
    let locality: string | null = null;
    for (const c of data.result?.address_components ?? []) {
      if (!neighborhood && (c.types.includes("neighborhood") || c.types.includes("sublocality_level_1") || c.types.includes("sublocality"))) {
        neighborhood = c.long_name;
      }
      if (!locality && c.types.includes("locality")) locality = c.long_name;
    }
    return { neighborhood, locality };
  } catch {
    return { neighborhood: null, locality: null };
  }
}

/**
 * Upsert Google results as Place rows. New places get their neighborhood
 * from Place Details; every place gets its photo refs refreshed (stored
 * refs expire) and an AI summary job. Returns Place ids in input order.
 */
export async function persistGooglePlaces(results: GoogleResult[]): Promise<string[]> {
  const ids: string[] = [];
  for (const r of results) {
    const existing = await prisma.place.findUnique({
      where: { googlePlaceId: r.googlePlaceId },
      select: { id: true, neighborhood: true },
    });
    const where = existing?.neighborhood ? null : await neighborhoodFor(r.googlePlaceId);
    const place = await prisma.place.upsert({
      where: { googlePlaceId: r.googlePlaceId },
      create: {
        googlePlaceId: r.googlePlaceId,
        name: r.name,
        formattedAddress: r.formattedAddress,
        neighborhood: where?.neighborhood ?? null,
        locality: where?.locality ?? null,
        lat: r.lat,
        lng: r.lng,
        types: r.types,
        primaryType: r.primaryType,
        priceLevel: r.priceLevel,
        photoRefs: r.photoRefs,
      },
      update: {
        ...(r.photoRefs.length > 0 ? { photoRefs: r.photoRefs } : {}),
        ...(where?.neighborhood ? { neighborhood: where.neighborhood, locality: where.locality } : {}),
      },
      select: { id: true },
    });
    ids.push(place.id);
    if (!existing) {
      await enqueueJob("REFRESH_PLACE_SUMMARY", { placeId: place.id }).catch((e) =>
        console.error("[google] enqueue summary failed:", e),
      );
    }
  }
  return ids;
}
