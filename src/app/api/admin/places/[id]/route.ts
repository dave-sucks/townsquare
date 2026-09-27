import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { editPlaceSummary, ensurePlace, mergePlace, updatePlaceFields } from "@/lib/engine/write/places";
import { setPlaceTagOverride } from "@/lib/engine/write/tags";
import { refreshPlaces } from "@/lib/engine/events";

type Params = { params: Promise<{ id: string }> };

async function findPlace(id: string) {
  return prisma.place.findFirst({ where: { OR: [{ id }, { googlePlaceId: id }] }, select: { id: true, googlePlaceId: true } });
}

/** The place's admin view: its editable fields, runs and tag overrides. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;
  const place = await findPlace((await params).id);
  if (!place) return NextResponse.json({ error: "Place not found" }, { status: 404 });
  const [row, runs, suppressed] = await Promise.all([
    prisma.place.findUnique({
      where: { id: place.id },
      select: { id: true, googlePlaceId: true, name: true, lat: true, lng: true, neighborhood: true, locality: true, priceLevel: true, primaryType: true, isHidden: true, mergedIntoId: true, aiSummaryUpdatedAt: true },
    }),
    prisma.engineRun.findMany({ where: { placeId: place.id }, orderBy: { startedAt: "desc" }, take: 5, select: { id: true, status: true, startedAt: true, costUsd: true } }),
    prisma.placeTagAggregate.findMany({ where: { placeId: place.id, isSuppressed: true }, select: { tag: { select: { slug: true, displayName: true } } } }),
  ]);
  return NextResponse.json({ place: row, runs, suppressedTags: suppressed.map((s) => s.tag) });
}

const fieldsSchema = z.object({
  name: z.string().trim().min(1).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  neighborhood: z.string().trim().nullable().optional(),
  priceLevel: z.enum(["0", "1", "2", "3", "4"]).nullable().optional(),
  primaryType: z.string().trim().nullable().optional(),
  isHidden: z.boolean().optional(),
  note: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  const place = await findPlace((await params).id);
  if (!place) return NextResponse.json({ error: "Place not found" }, { status: 404 });
  const parsed = fieldsSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  const { note, ...fields } = parsed.data;
  await updatePlaceFields(place.id, fields, { actor: user.id, note });
  return NextResponse.json({ ok: true });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("merge"), intoGooglePlaceId: z.string(), note: z.string().nullable().optional() }),
  z.object({ action: z.literal("refresh") }),
  z.object({ action: z.literal("summary"), summary: z.string().trim().min(1), note: z.string().nullable().optional() }),
  z.object({ action: z.literal("tag"), slug: z.string(), show: z.boolean(), note: z.string().nullable().optional() }),
]);

export async function POST(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  const place = await findPlace((await params).id);
  if (!place) return NextResponse.json({ error: "Place not found" }, { status: 404 });
  const parsed = actionSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  const body = parsed.data;
  try {
    if (body.action === "merge") {
      const into = await ensurePlace(body.intoGooglePlaceId, { actor: user.id });
      const result = await mergePlace(place.id, into.id, { actor: user.id, note: body.note });
      await refreshPlaces([into.id]);
      return NextResponse.json({ ok: true, ...result, intoGooglePlaceId: body.intoGooglePlaceId });
    }
    if (body.action === "refresh") {
      const queued = await refreshPlaces([place.id], { force: true });
      return NextResponse.json({ ok: queued, queued }, { status: queued ? 200 : 503 });
    }
    if (body.action === "summary") {
      await editPlaceSummary(place.id, body.summary, { actor: user.id, note: body.note });
      return NextResponse.json({ ok: true });
    }
    await setPlaceTagOverride(place.id, body.slug, body.show, { actor: user.id, note: body.note });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
