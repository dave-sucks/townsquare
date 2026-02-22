import { prisma } from "@/lib/prisma";
import { enqueueJob } from "../queue";

interface ProcessPostPayload {
  ingestedPostId: string;
}

const CONFIDENCE_AUTO_THRESHOLD = 0.85;
const CONFIDENCE_CANDIDATE_THRESHOLD = 0.60;

export async function handleProcessPost(payload: ProcessPostPayload) {
  const { ingestedPostId } = payload;

  const post = await prisma.ingestedPost.findUnique({
    where: { id: ingestedPostId },
    include: { importJob: true },
  });
  if (!post) throw new Error(`IngestedPost ${ingestedPostId} not found`);

  try {
    if (post.resolvedGooglePlaceId && post.resolveMethod === "manual") {
      await prisma.importJob.update({
        where: { id: post.importJobId },
        data: { postsUnresolved: { decrement: 1 } },
      });
      await createReviewFromPost(
        post,
        post.resolvedGooglePlaceId,
        "manual",
        post.resolveConfidence || 1.0
      );
      return;
    }

    const allResults = await resolvePlaces(post);

    const autoResolved = allResults
      .filter(r => r.confidence >= CONFIDENCE_AUTO_THRESHOLD)
      .sort((a, b) => b.confidence - a.confidence);
    const allCandidates = allResults.flatMap(r => r.candidates);

    if (autoResolved.length === 0) {
      const bestResult = allResults.sort((a, b) => b.confidence - a.confidence)[0] || null;
      await prisma.ingestedPost.update({
        where: { id: ingestedPostId },
        data: {
          status: "unresolved",
          resolveMethod: bestResult?.method || "none",
          resolveConfidence: bestResult?.confidence || null,
          resolveCandidates: allCandidates.length > 0 ? (allCandidates as any) : null,
        },
      });
      await prisma.importJob.update({
        where: { id: post.importJobId },
        data: { postsUnresolved: { increment: 1 } },
      });
      return;
    }

    const primary = autoResolved[0];
    await createReviewFromPost(post, primary.googlePlaceId, primary.method, primary.confidence);

    for (let i = 1; i < autoResolved.length; i++) {
      const extra = autoResolved[i];
      try {
        await createReviewFromPost(post, extra.googlePlaceId, extra.method, extra.confidence, true);
      } catch (err: any) {
        console.error(`[ProcessPost] Additional place ${extra.googlePlaceId} failed:`, err.message);
      }
    }
  } catch (err: any) {
    await prisma.ingestedPost.update({
      where: { id: ingestedPostId },
      data: { status: "failed", error: err.message },
    });
    await prisma.importJob.update({
      where: { id: post.importJobId },
      data: { postsFailed: { increment: 1 } },
    });
    throw err;
  }
}

interface ResolveResult {
  googlePlaceId: string;
  confidence: number;
  method: "geotag" | "caption" | "hashtag" | "ai";
  candidates: Array<{
    googlePlaceId: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    types: string[];
    score: number;
  }>;
}

async function resolvePlaces(post: any): Promise<ResolveResult[]> {
  const raw = post.rawPayload as any;
  const caption = post.caption || "";
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY not configured");

  const results: ResolveResult[] = [];
  const seenPlaceIds = new Set<string>();

  function addResult(r: ResolveResult) {
    if (!seenPlaceIds.has(r.googlePlaceId)) {
      seenPlaceIds.add(r.googlePlaceId);
      results.push(r);
    }
  }

  const locationName = raw?.locationName || raw?.location?.name;
  if (locationName) {
    const result = await searchGooglePlaces(locationName, apiKey);
    if (result && result.candidates.length > 0) {
      const best = result.candidates[0];
      const geotagConfidence = best.name.toLowerCase().includes(locationName.toLowerCase().split(" ")[0])
        ? 0.95
        : Math.max(best.score, 0.85);
      addResult({
        googlePlaceId: best.googlePlaceId,
        confidence: geotagConfidence,
        method: "geotag",
        candidates: result.candidates,
      });
    }
  }

  const venueName = extractVenueFromCaption(caption);
  if (venueName) {
    const result = await searchGooglePlaces(venueName, apiKey);
    if (result && result.candidates.length > 0) {
      const best = result.candidates[0];
      addResult({
        googlePlaceId: best.googlePlaceId,
        confidence: Math.min(best.score, 0.85),
        method: "caption",
        candidates: result.candidates,
      });
    }
  }

  const hashtagVenue = extractVenueFromHashtags(caption);
  if (hashtagVenue) {
    const result = await searchGooglePlaces(hashtagVenue, apiKey);
    if (result && result.candidates.length > 0) {
      const best = result.candidates[0];
      addResult({
        googlePlaceId: best.googlePlaceId,
        confidence: Math.min(best.score, 0.75),
        method: "hashtag",
        candidates: result.candidates,
      });
    }
  }

  const taggedAccounts = extractTaggedAccounts(caption);
  for (const tag of taggedAccounts) {
    const result = await searchGooglePlaces(tag.replace(/[_.]/g, " "), apiKey);
    if (result && result.candidates.length > 0) {
      const best = result.candidates[0];
      if (best.score >= 0.7) {
        addResult({
          googlePlaceId: best.googlePlaceId,
          confidence: Math.min(best.score, 0.80),
          method: "caption",
          candidates: result.candidates,
        });
      }
    }
  }

  try {
    const aiVenues = await aiExtractVenues(caption);
    for (const venueName of aiVenues) {
      const result = await searchGooglePlaces(venueName, apiKey);
      if (result && result.candidates.length > 0) {
        const best = result.candidates[0];
        addResult({
          googlePlaceId: best.googlePlaceId,
          confidence: Math.min(best.score, 0.80),
          method: "ai",
          candidates: result.candidates,
        });
      }
    }
  } catch {
  }

  return results;
}

async function searchGooglePlaces(
  query: string,
  apiKey: string
): Promise<{
  candidates: Array<{
    googlePlaceId: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    types: string[];
    score: number;
  }>;
} | null> {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=restaurant|bar|cafe|food|bakery&key=${apiKey}`
  );

  if (!response.ok) return null;

  const data = await response.json();
  if (!data.results || data.results.length === 0) return null;

  const candidates = data.results.slice(0, 3).map((r: any, i: number) => ({
    googlePlaceId: r.place_id,
    name: r.name,
    address: r.formatted_address || "",
    lat: r.geometry?.location?.lat || 0,
    lng: r.geometry?.location?.lng || 0,
    types: r.types || [],
    score: Math.max(0.5, 1 - i * 0.15),
  }));

  return { candidates };
}

function extractVenueFromCaption(caption: string): string | null {
  const patterns = [
    /📍\s*([^•\n,]+)/,
    /(?:at|@)\s+([A-Z][A-Za-z\s'&]+(?:Diner|Restaurant|Cafe|Café|Bar|Grill|Kitchen|Bistro|Eatery|Pizzeria|Tavern|Bakery|Coffee|Pub|Lounge|House))/i,
    /^([A-Z][A-Za-z\s'&]+)\s*[-–—]\s/m,
    /(?:love|recommend|try|visit|went to|check out|stopped by)\s+(?:@)?([A-Z][A-Za-z\s'&]{2,30})/i,
  ];

  for (const pattern of patterns) {
    const match = caption.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function extractVenueFromHashtags(caption: string): string | null {
  const hashtags = caption.match(/#([\w]+)/g);
  if (!hashtags) return null;

  const restaurantHints = [
    "diner",
    "restaurant",
    "cafe",
    "bar",
    "grill",
    "kitchen",
    "bistro",
    "eatery",
    "pizzeria",
    "tavern",
    "bakery",
    "pub",
    "lounge",
  ];

  for (const tag of hashtags) {
    const clean = tag.replace("#", "");
    if (restaurantHints.some((h) => clean.toLowerCase().includes(h))) {
      return clean.replace(/([A-Z])/g, " $1").trim();
    }
  }

  return null;
}

function extractTaggedAccounts(caption: string): string[] {
  const tags = caption.match(/@([\w.]+)/g);
  return tags ? tags.map((t) => t.replace("@", "")) : [];
}

async function aiExtractVenues(caption: string): Promise<string[]> {
  if (!caption || caption.length < 10) return [];

  const openaiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!openaiKey) return [];

  try {
    const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              'Extract ALL restaurant, bar, cafe, and food venue names mentioned in this Instagram caption. A post may mention multiple places. Return a JSON array of venue name strings, e.g. ["Venue One", "Venue Two"]. If no venues can be identified, return []. Return ONLY the JSON array, nothing else.',
          },
          { role: "user", content: caption.substring(0, 500) },
        ],
        temperature: 0,
        max_tokens: 200,
      }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim();
    if (!result) return [];
    try {
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed)) {
        return parsed.filter((v: any) => typeof v === "string" && v.length > 0 && v.length <= 100);
      }
      if (typeof parsed === "string" && parsed !== "NONE" && parsed.length <= 100) {
        return [parsed];
      }
    } catch {
      if (result !== "NONE" && result.length <= 100) {
        return [result];
      }
    }
    return [];
  } catch {
    return [];
  }
}

export async function createReviewFromPost(
  post: any,
  googlePlaceId: string,
  method: string,
  confidence: number,
  isAdditionalPlace: boolean = false
) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY not configured");

  const details = await fetchPlaceDetails(googlePlaceId, apiKey);
  let place = await prisma.place.upsert({
    where: { googlePlaceId },
    create: {
      googlePlaceId,
      name: details.name,
      formattedAddress: details.formattedAddress,
      neighborhood: details.neighborhood || null,
      locality: details.locality || null,
      lat: details.lat,
      lng: details.lng,
      primaryType: details.primaryType || null,
      types: details.types || [],
      priceLevel: details.priceLevel ?? null,
      photoRefs: details.photoRefs || null,
    },
    update: {
      name: details.name,
      formattedAddress: details.formattedAddress,
      neighborhood: details.neighborhood ?? undefined,
      locality: details.locality ?? undefined,
      lat: details.lat,
      lng: details.lng,
      primaryType: details.primaryType ?? undefined,
      types: details.types ?? undefined,
      priceLevel: details.priceLevel ?? undefined,
      photoRefs: details.photoRefs ?? undefined,
    },
  });

  const user = await prisma.user.findFirst({
    where: { instagramHandle: post.authorHandle },
  });
  if (!user) throw new Error(`User not found for handle: ${post.authorHandle}`);

  const reviewPostId = isAdditionalPlace
    ? `${post.canonicalPostId}__place_${googlePlaceId}`
    : post.canonicalPostId;

  const existingReview = await prisma.review.findFirst({
    where: {
      instagramPostId: reviewPostId,
    },
  });
  if (existingReview) {
    if (!isAdditionalPlace) {
      await prisma.ingestedPost.update({
        where: { id: post.id },
        data: {
          status: "processed",
          resolvedGooglePlaceId: googlePlaceId,
          resolveMethod: method as any,
          resolveConfidence: confidence,
          reviewId: existingReview.id,
        },
      });
      await prisma.importJob.update({
        where: { id: post.importJobId },
        data: {
          postsProcessed: { increment: 1 },
        },
      });
    }
    return;
  }

  const mediaItems = (post.media as any[]) || [];

  const review = await prisma.review.create({
    data: {
      userId: user.id,
      placeId: place.id,
      source: "instagram",
      instagramPostId: reviewPostId,
      instagramShortcode: (post.rawPayload as any)?.shortCode || null,
      instagramUrl: post.url,
      socialPostCaption: post.caption || null,
      socialPostMediaUrl: mediaItems[0]?.url || null,
      socialPostMediaType:
        mediaItems.length > 1
          ? "carousel"
          : mediaItems[0]?.type || "image",
      socialPostLikes: post.likeCount || null,
      socialPostPostedAt: post.postedAt || null,
      note: post.caption ? post.caption.substring(0, 500) : null,
    },
  });

  if (mediaItems.length > 0) {
    await prisma.photo.createMany({
      data: mediaItems.map((m: any, i: number) => ({
        userId: user.id,
        placeId: place!.id,
        reviewId: review.id,
        url: m.url,
        isCarousel: mediaItems.length > 1,
        carouselPosition: i,
      })),
    });
  }

  await prisma.savedPlace.upsert({
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

  try {
    await prisma.activity.create({
      data: {
        actorId: user.id,
        type: "REVIEW_CREATED",
        placeId: place.id,
        dedupeKey: `review_import_${reviewPostId}`,
        createdAt: post.postedAt || new Date(),
      },
    });
  } catch (e: any) {
    if (!e.message?.includes("Unique constraint")) {
      console.error("[ProcessPost] Activity creation error:", e.message);
    }
  }

  if (!isAdditionalPlace) {
    await prisma.ingestedPost.update({
      where: { id: post.id },
      data: {
        status: "processed",
        resolvedGooglePlaceId: googlePlaceId,
        resolveMethod: method as any,
        resolveConfidence: confidence,
        reviewId: review.id,
      },
    });
  }

  await prisma.importJob.update({
    where: { id: post.importJobId },
    data: {
      postsProcessed: isAdditionalPlace ? undefined : { increment: 1 },
      reviewsCreated: { increment: 1 },
    },
  });

  await enqueueJob("ENRICH_REVIEW", { reviewId: review.id });
  await enqueueJob("UPDATE_PLACE_AGGREGATES", { placeId: place.id });

  const { autoTagPlace } = await import("@/lib/auto-tag-place");
  const { autoSummaryPlace } = await import("@/lib/auto-summary-place");
  autoTagPlace(place.id).catch(() => {});
  autoSummaryPlace(place.id).catch(() => {});

  const reviewCount = await prisma.review.count({
    where: { placeId: place.id },
  });
  if (reviewCount % 5 === 0 && reviewCount >= 2) {
    await enqueueJob("REFRESH_PLACE_SUMMARY", { placeId: place.id });
  }
}

async function fetchPlaceDetails(googlePlaceId: string, apiKey: string) {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(googlePlaceId)}&fields=place_id,name,formatted_address,geometry,types,price_level,address_components,photos&key=${apiKey}`
  );

  if (!response.ok) throw new Error(`Google Place Details failed: ${response.status}`);

  const data = await response.json();
  const result = data.result;
  if (!result) throw new Error("No place details found");

  let neighborhood: string | null = null;
  let locality: string | null = null;
  if (result.address_components) {
    for (const comp of result.address_components) {
      if (comp.types.includes("neighborhood")) {
        neighborhood = comp.long_name;
      }
      if (comp.types.includes("locality")) {
        locality = comp.long_name;
      }
    }
  }

  const photoRefs = result.photos
    ? result.photos.slice(0, 5).map((p: any) => p.photo_reference)
    : null;

  return {
    name: result.name,
    formattedAddress: result.formatted_address || "",
    neighborhood,
    locality,
    lat: result.geometry?.location?.lat || 0,
    lng: result.geometry?.location?.lng || 0,
    primaryType: result.types?.[0] || null,
    types: result.types || null,
    priceLevel: result.price_level != null ? result.price_level.toString() : null,
    photoRefs,
  };
}
