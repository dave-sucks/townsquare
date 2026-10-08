import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { listSources } from "@/lib/engine/sources";
import { updateSource } from "@/lib/engine/write/sources";
import { syncSourceNow } from "@/lib/engine/events";

type Params = { params: Promise<{ id: string }> };

/** A source by id, handle, or its creator's user id. */
async function findSource(key: string) {
  return prisma.source.findFirst({
    where: { OR: [{ id: key }, { handle: { equals: key.replace(/^@/, ""), mode: "insensitive" } }, { userId: key }] },
    select: { id: true },
  });
}

/** The source's card data and its sync history. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;
  const found = await findSource((await params).id);
  if (!found) return NextResponse.json({ source: null }, { status: 404 });
  const [source] = await listSources(Prisma.sql`s.id = ${found.id}`);
  const syncs = await prisma.importJob.findMany({
    where: { sourceId: found.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, status: true, createdAt: true, completedAt: true, postsFetched: true, since: true, error: true },
  });

  return NextResponse.json({ source, syncs });
}

const editSchema = z.object({
  status: z.enum(["active", "paused"]).optional(),
  homeCity: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  trustWeight: z.number().min(0).max(3).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  const found = await findSource((await params).id);
  if (!found) return NextResponse.json({ error: "Source not found" }, { status: 404 });
  const parsed = editSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  await updateSource(found.id, parsed.data, { actor: user.id });
  return NextResponse.json({ ok: true });
}

/** Sync now. */
export async function POST(_req: NextRequest, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;
  const found = await findSource((await params).id);
  if (!found) return NextResponse.json({ error: "Source not found" }, { status: 404 });
  const queued = await syncSourceNow(found.id);
  return NextResponse.json({ ok: queued, queued }, { status: queued ? 200 : 503 });
}
