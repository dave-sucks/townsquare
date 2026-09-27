/**
 * The one writer for places: created from Google by id, and the fields the
 * engine owns (known-for, verdict counts, summary, search document).
 */

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { googlePlaceDetails } from "@/lib/places/google";
import { writeAudit } from "./audit";

/** The Place for a Google id: the existing one, or a new one from Place Details. */
export async function ensurePlace(googlePlaceId: string, opts: { runId?: string | null; actor: string }) {
  const existing = await prisma.place.findUnique({ where: { googlePlaceId }, select: { id: true, name: true } });
  if (existing) return { id: existing.id, name: existing.name, created: false };

  const d = await googlePlaceDetails(googlePlaceId);
  const place = await prisma.place.upsert({
    where: { googlePlaceId },
    update: {},
    create: {
      googlePlaceId,
      name: d.name,
      formattedAddress: d.formattedAddress,
      neighborhood: d.neighborhood,
      locality: d.locality,
      lat: d.lat,
      lng: d.lng,
      primaryType: d.primaryType,
      types: d.types,
      priceLevel: d.priceLevel,
      photoRefs: d.photoRefs,
    },
    select: { id: true, name: true },
  });
  await writeAudit({ entity: "place", entityId: place.id, action: "create", actor: opts.actor, runId: opts.runId, fieldChanges: { googlePlaceId: { from: null, to: googlePlaceId } } });
  return { id: place.id, name: place.name, created: true };
}

export type KnownForDish = { name: string; count: number };

export async function setPlaceRollup(placeId: string, data: { knownFor: KnownForDish[]; verdictCounts: Record<string, number> }) {
  await prisma.place.update({
    where: { id: placeId },
    data: {
      knownFor: data.knownFor as unknown as Prisma.InputJsonValue,
      verdictCounts: data.verdictCounts as Prisma.InputJsonValue,
    },
  });
}

/** Summarize is the only writer of ai_summary. */
export async function setPlaceSummary(
  placeId: string,
  data: { summary: string; knownFor?: KnownForDish[] },
  opts: { runId?: string | null; actor: string },
) {
  const before = await prisma.place.findUnique({ where: { id: placeId }, select: { aiSummary: true } });
  await prisma.place.update({
    where: { id: placeId },
    data: {
      aiSummary: data.summary,
      aiSummaryUpdatedAt: new Date(),
      ...(data.knownFor && data.knownFor.length > 0 ? { knownFor: data.knownFor as unknown as Prisma.InputJsonValue } : {}),
    },
  });
  if (before?.aiSummary !== data.summary) {
    await writeAudit({
      entity: "place",
      entityId: placeId,
      action: "summarize",
      actor: opts.actor,
      runId: opts.runId,
      fieldChanges: { aiSummary: { from: before?.aiSummary ?? null, to: data.summary } },
    });
  }
}

/**
 * The place's full-text document: A name, B tags + synonyms + known-for,
 * C the latest excerpts, D neighborhood and locality.
 */
export async function refreshSearchDocument(placeId: string, excerpts: number) {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE places p SET search_document =
      setweight(to_tsvector('english', coalesce(p.name, '')), 'A') ||
      setweight(to_tsvector('english',
        coalesce((SELECT string_agg(t.display_name || ' ' || array_to_string(t.synonyms, ' '), ' ')
                    FROM place_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.place_id = p.id), '') || ' ' ||
        coalesce((SELECT string_agg(x->>'name', ' ') FROM jsonb_array_elements(coalesce(p.known_for, '[]'::jsonb)) x), '')), 'B') ||
      setweight(to_tsvector('english',
        coalesce((SELECT string_agg(e, ' ') FROM (
                    SELECT coalesce(r.excerpt, left(r.social_post_caption, 300)) AS e FROM reviews r
                     WHERE r.place_id = p.id
                     ORDER BY coalesce(r.social_post_posted_at, r.created_at) DESC LIMIT ${excerpts}) z), '')), 'C') ||
      setweight(to_tsvector('english', coalesce(p.neighborhood, '') || ' ' || coalesce(p.locality, '')), 'D')
     WHERE p.id = ${placeId}`);
}
