/**
 * The one writer for places: created from Google by id, and the fields the
 * engine owns (known-for, verdict counts, summary, search document).
 */

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { googlePlaceDetails } from "@/lib/places/google";
import { saveExample } from "../examples";
import { diffFields, writeAudit } from "./audit";

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

// ── A person's edits ────────────────────────────────────────────────────────

export type PlaceFieldEdits = {
  name?: string;
  lat?: number;
  lng?: number;
  neighborhood?: string | null;
  priceLevel?: string | null;
  primaryType?: string | null;
  isHidden?: boolean;
};

export async function updatePlaceFields(placeId: string, edits: PlaceFieldEdits, opts: { actor: string; note?: string | null }) {
  const before = await prisma.place.findUniqueOrThrow({
    where: { id: placeId },
    select: { name: true, lat: true, lng: true, neighborhood: true, priceLevel: true, primaryType: true, isHidden: true },
  });
  const data = Object.fromEntries(Object.entries(edits).filter(([, v]) => v !== undefined));
  const changes = diffFields(before, data);
  if (Object.keys(changes).length === 0) return;
  await prisma.place.update({ where: { id: placeId }, data });
  await writeAudit({ entity: "place", entityId: placeId, action: "edit", actor: opts.actor, note: opts.note, fieldChanges: changes });
  if ("name" in changes || "neighborhood" in changes) await refreshSearchDocument(placeId, 20);
}

/**
 * Merge a duplicate place into another: its mentions, saves, list entries,
 * photos, activities and admin tags move to the target (where the target
 * already has the same row, the target's wins), and the duplicate is hidden
 * and points at the target.
 */
export async function mergePlace(fromId: string, intoId: string, opts: { actor: string; note?: string | null }) {
  if (fromId === intoId) throw new Error("A place can't merge into itself");
  const [from, into] = await Promise.all([
    prisma.place.findUniqueOrThrow({ where: { id: fromId }, select: { id: true, name: true } }),
    prisma.place.findUniqueOrThrow({ where: { id: intoId }, select: { id: true, name: true } }),
  ]);
  const moved = await prisma.$transaction(async (tx) => {
    const run = (sql: Prisma.Sql) => tx.$executeRaw(sql);
    // Rows that would collide with the target's own are dropped first.
    await run(Prisma.sql`DELETE FROM reviews r WHERE r.place_id = ${fromId}
      AND r.instagram_post_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM reviews x WHERE x.place_id = ${intoId} AND x.instagram_post_id = r.instagram_post_id)`);
    const reviews = await run(Prisma.sql`UPDATE reviews SET place_id = ${intoId} WHERE place_id = ${fromId}`);
    await run(Prisma.sql`DELETE FROM saved_places s WHERE s.place_id = ${fromId}
      AND EXISTS (SELECT 1 FROM saved_places x WHERE x.place_id = ${intoId} AND x.user_id = s.user_id)`);
    const saves = await run(Prisma.sql`UPDATE saved_places SET place_id = ${intoId} WHERE place_id = ${fromId}`);
    await run(Prisma.sql`DELETE FROM list_places l WHERE l.place_id = ${fromId}
      AND EXISTS (SELECT 1 FROM list_places x WHERE x.place_id = ${intoId} AND x.list_id = l.list_id)`);
    await run(Prisma.sql`UPDATE list_places SET place_id = ${intoId} WHERE place_id = ${fromId}`);
    await run(Prisma.sql`UPDATE photos SET place_id = ${intoId} WHERE place_id = ${fromId}`);
    await run(Prisma.sql`UPDATE activities SET place_id = ${intoId} WHERE place_id = ${fromId}`);
    await run(Prisma.sql`DELETE FROM place_tags p WHERE p.place_id = ${fromId}
      AND (p.source <> 'manual' OR EXISTS (SELECT 1 FROM place_tags x WHERE x.place_id = ${intoId} AND x.tag_id = p.tag_id))`);
    await run(Prisma.sql`UPDATE place_tags SET place_id = ${intoId} WHERE place_id = ${fromId}`);
    await run(Prisma.sql`DELETE FROM place_tag_aggregates WHERE place_id = ${fromId}`);
    await tx.place.update({ where: { id: fromId }, data: { isHidden: true, mergedIntoId: intoId } });
    return { reviews, saves };
  });
  await writeAudit({
    entity: "place",
    entityId: fromId,
    action: "merge",
    actor: opts.actor,
    note: opts.note,
    fieldChanges: { mergedInto: { from: null, to: `${into.name} (${intoId})` }, mentionsMoved: { from: 0, to: moved.reviews } },
  });
  return { from: from.name, into: into.name, ...moved };
}

/** A person rewrites a place's summary: Summarize learns from it. */
export async function editPlaceSummary(placeId: string, summary: string, opts: { actor: string; note?: string | null }) {
  const place = await prisma.place.findUniqueOrThrow({ where: { id: placeId }, select: { name: true, aiSummary: true } });
  await setPlaceSummary(placeId, { summary }, { actor: opts.actor });
  await saveExample({
    agentKey: "summarize",
    input: { place: place.name, previous: place.aiSummary },
    expected: { summary },
    source: "human_corrected",
    note: opts.note,
    createdBy: opts.actor,
  });
}
