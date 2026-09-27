/**
 * Stage 5, Resolve (code, then agent when unsure): the Google listing a
 * mentioned place refers to. Code searches near the right city and scores
 * the candidates; only a clear winner is accepted without the agent, and
 * only a confident agent pick without a person.
 */

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { googleTextSearch, type GoogleResult } from "@/lib/places/google";
import { callStructured, type LlmUsage } from "../llm";
import { activeVersion } from "../agents/registry";
import { resolveSchema, type ResolveOutput } from "../agents/resolve/schema";
import { ENGINE } from "../config";
import { openReviewItem } from "../review";
import { distanceKm, nameSimilarity } from "../text";
import { ensurePlace } from "../write/places";
import type { StepResult } from "../write/runs";
import type { ReadPlaceResult } from "./read";

type Point = { lat: number; lng: number };
type Geo = Point & { isArea: boolean };

/** Google result types that make a hit an area (city, neighborhood, region) rather than a venue. */
const AREA_TYPES = new Set([
  "locality",
  "sublocality",
  "sublocality_level_1",
  "neighborhood",
  "colloquial_area",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "postal_code",
  "country",
]);

export type Candidate = {
  id: string;
  googlePlaceId: string;
  name: string;
  address: string;
  types: string[];
  businessStatus: string | null;
  distanceKm: number | null;
  nameSimilarity: number;
  score: number;
};

export type ResolveResult = {
  outcome: "accepted" | "review";
  resolvedBy: "code" | "agent" | null;
  googlePlaceId: string | null;
  placeId: string | null;
  placeName: string | null;
  confidence: number | null;
  query: string;
  bias: string | null;
  candidates: Candidate[];
  agent: ResolveOutput | null;
  reviewItemId: string | null;
};

const FOOD_TYPES = new Set(["restaurant", "bar", "cafe", "bakery", "food", "meal_takeaway", "meal_delivery", "night_club"]);

/** A name's coordinates, and whether it names an area, looked up once and cached. */
async function geocode(query: string, near?: Point | null): Promise<Geo | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  const cached = await prisma.geocodeCache.findUnique({ where: { query: key } });
  if (cached && cached.isArea != null) return { lat: cached.lat, lng: cached.lng, isArea: cached.isArea };
  const [hit] = await googleTextSearch(query, { near: near ?? undefined, radiusMeters: 50_000, limit: 1 });
  if (!hit) return null;
  const isArea = hit.types.some((t) => AREA_TYPES.has(t));
  await prisma.geocodeCache.upsert({
    where: { query: key },
    update: { lat: hit.lat, lng: hit.lng, isArea, label: hit.formattedAddress },
    create: { query: key, lat: hit.lat, lng: hit.lng, isArea, label: hit.formattedAddress },
  });
  return { lat: hit.lat, lng: hit.lng, isArea };
}

const cityName = (city: string) => city.split(",")[0].trim().toLowerCase();

/** Google Text Search through a short-lived cache. */
async function searchPlaces(query: string, opts: { near?: Point | null; radiusMeters: number; limit: number }): Promise<GoogleResult[]> {
  const where = opts.near ? `${opts.near.lat.toFixed(3)},${opts.near.lng.toFixed(3)}` : "-";
  const key = [query.trim().toLowerCase(), where, opts.radiusMeters, opts.limit].join("|");
  const hit = await prisma.googleSearchCache.findUnique({ where: { key } });
  if (hit && Date.now() - hit.fetchedAt.getTime() < ENGINE.resolve.searchCacheDays * 86_400_000) {
    return hit.results as unknown as GoogleResult[];
  }
  const results = await googleTextSearch(query, { near: opts.near ?? undefined, radiusMeters: opts.radiusMeters, limit: opts.limit });
  const json = results as unknown as Prisma.InputJsonValue;
  await prisma.googleSearchCache.upsert({
    where: { key },
    update: { query, results: json, fetchedAt: new Date() },
    create: { key, query, results: json },
  });
  return results;
}

function score(c: GoogleResult, name: string, bias: Point | null) {
  const w = ENGINE.resolve.weights;
  const sim = nameSimilarity(name, c.name);
  const food = c.types.some((t) => FOOD_TYPES.has(t)) ? 1 : 0;
  const d = bias ? distanceKm(bias, c) : null;
  const { nearKm, farKm } = ENGINE.resolve;
  const dist = d == null ? 0.5 : d <= nearKm ? 1 : d >= farKm ? 0 : 1 - (d - nearKm) / (farKm - nearKm);
  const status =
    c.businessStatus === "OPERATIONAL" ? 1 : c.businessStatus === "CLOSED_TEMPORARILY" ? 0.5 : c.businessStatus === "CLOSED_PERMANENTLY" ? 0.2 : 0.5;
  return {
    nameSimilarity: Math.round(sim * 1000) / 1000,
    distanceKm: d == null ? null : Math.round(d * 10) / 10,
    score: Math.round((w.name * sim + w.foodType * food + w.distance * dist + w.businessStatus * status) * 1000) / 1000,
  };
}

function describeCandidates(cs: Candidate[]): string {
  return cs
    .map(
      (c) =>
        `${c.id} · ${c.name} · ${c.address} · ${c.types.slice(0, 4).join(", ")} · ${(c.businessStatus ?? "status unknown").toLowerCase()}` +
        `${c.distanceKm != null ? ` · ${c.distanceKm} km from the expected area` : ""} · score ${c.score.toFixed(2)}`,
    )
    .join("\n");
}

export async function runResolve(
  runId: string,
  postId: string,
  place: ReadPlaceResult,
  ctx: { handle: string; homeCity: string | null; locationName: string | null },
): Promise<StepResult<ResolveResult>> {
  const cfg = ENGINE.resolve;
  const home = ctx.homeCity ? await geocode(ctx.homeCity) : null;
  // The post's location tag: this venue itself, an area ("Chicago, Illinois"), or another venue.
  const tagIsVenue = !!ctx.locationName && nameSimilarity(ctx.locationName, place.name) >= cfg.locationTagMatch;
  const tagGeo = !tagIsVenue && ctx.locationName ? await geocode(ctx.locationName, home) : null;
  const tagArea = tagGeo?.isArea ? tagGeo : null;
  // An area hint means the area near the post's own city when it has one ("Lincoln Square" in Chicago).
  const area = place.areaHint ? await geocode(place.areaHint, tagArea ?? home) : null;
  const bias = area ?? tagGeo ?? home;
  const biasLabel = area ? place.areaHint : tagGeo ? ctx.locationName : home ? ctx.homeCity : null;

  const areaText = place.areaHint ?? (tagArea ? ctx.locationName : null);
  const areaPoint = area ?? tagArea;
  const includeHome =
    !!ctx.homeCity &&
    (!areaPoint || !home || distanceKm(areaPoint, home) <= cfg.homeCityMaxKm) &&
    !(areaText && areaText.toLowerCase().includes(cityName(ctx.homeCity)));
  const nameQuery = [place.name, place.addressHint, areaText, includeHome ? ctx.homeCity : null].filter(Boolean).join(" ");
  let query = tagIsVenue ? ctx.locationName! : nameQuery;
  let results = await searchPlaces(query, { near: bias, radiusMeters: cfg.biasRadiusMeters, limit: cfg.candidates });
  if (results.length === 0 && query !== nameQuery) {
    query = nameQuery;
    results = await searchPlaces(query, { near: bias, radiusMeters: cfg.biasRadiusMeters, limit: cfg.candidates });
  }

  const candidates: Candidate[] = results
    .map((r) => ({
      googlePlaceId: r.googlePlaceId,
      name: r.name,
      address: r.formattedAddress,
      types: r.types,
      businessStatus: r.businessStatus,
      ...score(r, place.name, bias),
    }))
    .sort((a, b) => b.score - a.score)
    .map((c, i) => ({ id: `c${i + 1}`, ...c }));

  const base = { query, bias: biasLabel, candidates };
  const accept = async (c: Candidate, resolvedBy: "code" | "agent", confidence: number, agent: ResolveOutput | null) => {
    const p = await ensurePlace(c.googlePlaceId, { runId, actor: resolvedBy === "code" ? "engine" : "resolve" });
    return {
      outcome: "accepted" as const,
      resolvedBy,
      googlePlaceId: c.googlePlaceId,
      placeId: p.id,
      placeName: p.name,
      confidence,
      agent,
      reviewItemId: null,
      ...base,
    };
  };

  // Code decides when one candidate clearly wins.
  const [top, next] = candidates;
  if (
    top &&
    top.score >= cfg.autoAccept.minScore &&
    top.score - (next?.score ?? 0) >= cfg.autoAccept.minLead &&
    top.nameSimilarity >= cfg.autoAccept.minNameSimilarity
  ) {
    return { output: await accept(top, "code", top.score, null) };
  }

  const usage: LlmUsage[] = [];
  let agent: ResolveOutput | null = null;
  let agentVersionId: string | null = null;
  if (candidates.length > 0) {
    const version = await activeVersion("resolve");
    agentVersionId = version.id;
    const res = await callStructured({
      model: version.model,
      system: version.systemPrompt,
      schema: resolveSchema(candidates.map((c) => c.id)),
      effort: version.effort,
      maxTokens: version.maxTokens,
      messages: [
        {
          role: "user",
          content: [
            `<mention>`,
            `Name in the post: ${place.name}`,
            place.excerpt ? `What the post says: "${place.excerpt.slice(0, 600)}"` : null,
            `Area hint: ${place.areaHint ?? "none"} · Address hint: ${place.addressHint ?? "none"} · Tagged account: ${place.taggedAccount ? `@${place.taggedAccount}` : "none"}`,
            `Post location tag: ${ctx.locationName ?? "none"}`,
            `Creator: @${ctx.handle}${ctx.homeCity ? `, based in ${ctx.homeCity}` : ""}`,
            `</mention>`,
            ``,
            `<candidates>`,
            describeCandidates(candidates),
            `</candidates>`,
          ]
            .filter((l) => l !== null)
            .join("\n"),
        },
      ],
    });
    usage.push(res);
    agent = res.output;
    const pick = candidates.find((c) => c.id === agent!.choice);
    if (pick && agent.confidence === "high") {
      return { output: await accept(pick, "agent", 0.9, agent), usage, agentVersionId };
    }
  }

  // A person picks.
  const item = await openReviewItem({
    kind: "confirm_place",
    postId,
    runId,
    question: `Which place is "${place.name}"?`,
    payload: { place, ...base, agent },
    priority: place.role === "primary" ? 2 : 1,
  });
  return {
    output: {
      outcome: "review",
      resolvedBy: null,
      googlePlaceId: null,
      placeId: null,
      placeName: null,
      confidence: null,
      agent,
      reviewItemId: item.id,
      ...base,
    },
    usage,
    agentVersionId,
  };
}
