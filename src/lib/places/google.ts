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
import { refreshPlaces } from "@/lib/engine/events";

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
  /** OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY (or null when Google doesn't say). */
  businessStatus: string | null;
};

type TextSearchResult = {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: { location?: { lat: number; lng: number } };
  types?: string[];
  price_level?: number;
  photos?: { photo_reference: string }[];
  business_status?: string;
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
      businessStatus: r.business_status ?? null,
    }));
}

export type GooglePlaceDetails = {
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  neighborhood: string | null;
  locality: string | null;
  lat: number;
  lng: number;
  primaryType: string | null;
  types: string[];
  priceLevel: string | null;
  photoRefs: string[];
  businessStatus: string | null;
};

/**
 * Legacy Place Details for one place. The neighborhood is Google's
 * `neighborhood` component only: `sublocality` is the borough in New York
 * ("Manhattan"), which isn't a neighborhood.
 */
export async function googlePlaceDetails(googlePlaceId: string): Promise<GooglePlaceDetails> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("Google Maps API key not configured");
  const fields = "place_id,name,formatted_address,geometry,types,price_level,address_components,photos,business_status";
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(googlePlaceId)}&fields=${fields}&key=${apiKey}`,
  );
  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    result?: TextSearchResult & { address_components?: { long_name: string; types: string[] }[] };
  };
  if (data.status !== "OK" || !data.result) {
    throw new Error(`Google Place Details: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`);
  }
  const r = data.result;
  let neighborhood: string | null = null;
  let locality: string | null = null;
  for (const c of r.address_components ?? []) {
    if (!neighborhood && c.types.includes("neighborhood")) neighborhood = c.long_name;
    if (!locality && c.types.includes("locality")) locality = c.long_name;
  }
  return {
    googlePlaceId: r.place_id,
    name: r.name,
    formattedAddress: r.formatted_address ?? "",
    neighborhood,
    locality,
    lat: r.geometry?.location?.lat ?? 0,
    lng: r.geometry?.location?.lng ?? 0,
    primaryType: r.types?.[0] ?? null,
    types: r.types ?? [],
    priceLevel: r.price_level != null ? String(r.price_level) : null,
    photoRefs: (r.photos ?? []).slice(0, 5).map((p) => p.photo_reference),
    businessStatus: r.business_status ?? null,
  };
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
 * refs expire), and new ones go to the engine. Returns Place ids in input order.
 */
export async function persistGooglePlaces(results: GoogleResult[]): Promise<string[]> {
  const ids: string[] = [];
  const created: string[] = [];
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
    if (!existing) created.push(place.id);
  }
  // New places go to the engine (Aggregate, then Summarize once creators mention them).
  if (created.length > 0) await refreshPlaces(created);
  return ids;
}

/**
 * Google photo references expire. When one stops working, find the place that
 * holds it, fetch fresh references from Place Details, save them, and return
 * the fresh reference at the same position (so a place's first photo stays its
 * first photo). Null when no place holds the reference or Google has none.
 */
// Old reference -> fresh one, for pages that loaded several references of a
// place before the first request refreshed them all. Per instance, best effort.
const refreshedRefs = new Map<string, string>();

/** Fresh photo references for a place from Place Details, saved on the place. */
export async function refreshPlacePhotos(place: { id: string; google_place_id: string }): Promise<string[] | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place.google_place_id)}&fields=photos&key=${apiKey}`,
  );
  const data = (await res.json()) as { status: string; result?: { photos?: { photo_reference: string }[] } };
  const fresh = (data.result?.photos ?? []).slice(0, 5).map((p) => p.photo_reference);
  if (data.status !== "OK" || fresh.length === 0) return null;
  await prisma.place.update({ where: { id: place.id }, data: { photoRefs: fresh } });
  return fresh;
}

/**
 * A working reference for one that failed. Found by the reference itself
 * when a place still stores it; otherwise by `googlePlaceId` (pages and
 * saved chats can hold references a place has since replaced). `force`
 * re-fetches even when the place's current references look fresh.
 */
export async function refreshStalePhotoRef(
  staleRef: string,
  googlePlaceId?: string | null,
  force = false,
): Promise<string | null> {
  if (!force) {
    const known = refreshedRefs.get(staleRef);
    if (known) return known;
  }

  const byRef = await prisma.$queryRaw<{ id: string; google_place_id: string; photo_refs: unknown }[]>`
    SELECT id, google_place_id, photo_refs FROM places
     WHERE photo_refs::jsonb @> jsonb_build_array(${staleRef}::text)
     LIMIT 1`;
  let place = byRef[0];

  if (!place && googlePlaceId) {
    const byId = await prisma.$queryRaw<{ id: string; google_place_id: string; photo_refs: unknown }[]>`
      SELECT id, google_place_id, photo_refs FROM places WHERE google_place_id = ${googlePlaceId} LIMIT 1`;
    place = byId[0];
    if (!place) return null;
    const current = Array.isArray(place.photo_refs) ? (place.photo_refs as unknown[]).filter((r): r is string => typeof r === "string") : [];
    // The place was refreshed since this reference was handed out; use what it has now.
    if (!force && current.length > 0) return current[0];
  }
  if (!place) return null;

  const fresh = await refreshPlacePhotos(place);
  if (!fresh) return null;

  const old = Array.isArray(place.photo_refs) ? (place.photo_refs as unknown[]) : [];
  old.forEach((ref, i) => {
    if (typeof ref === "string") refreshedRefs.set(ref, fresh[Math.min(i, fresh.length - 1)]);
  });
  refreshedRefs.set(staleRef, fresh[Math.min(Math.max(0, old.indexOf(staleRef)), fresh.length - 1)]);
  if (refreshedRefs.size > 5000) refreshedRefs.clear();
  return refreshedRefs.get(staleRef) ?? fresh[0];
}
