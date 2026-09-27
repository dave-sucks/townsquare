/**
 * The one writer for sources: the creator accounts the engine follows.
 */

import { prisma } from "@/lib/prisma";
import { diffFields, writeAudit } from "./audit";

/** "@Handle", "instagram.com/handle/" → "handle". */
export function normalizeHandle(input: string): string | null {
  const fromUrl = input.match(/instagram\.com\/([^/?#]+)/i)?.[1];
  const handle = (fromUrl ?? input).trim().replace(/^@/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(handle) ? handle : null;
}

export async function createSource(input: string, opts: { actor: string; homeCity?: string | null }) {
  const handle = normalizeHandle(input);
  if (!handle) throw new Error("That doesn't look like an Instagram handle");
  const existing = await prisma.source.findUnique({ where: { platform_handle: { platform: "instagram", handle } } });
  if (existing) return { source: existing, created: false };
  // A creator already in Townsquare becomes this source's user; otherwise the first sync makes one.
  const user = await prisma.user.findFirst({ where: { instagramHandle: { equals: handle, mode: "insensitive" } }, select: { id: true } });
  const source = await prisma.source.create({
    data: { platform: "instagram", handle, userId: user?.id ?? null, homeCity: opts.homeCity ?? "New York, NY" },
  });
  await writeAudit({ entity: "source", entityId: source.id, action: "create", actor: opts.actor, fieldChanges: { handle: { from: null, to: handle } } });
  return { source, created: true };
}

export type SourceEdits = {
  status?: "active" | "paused";
  homeCity?: string | null;
  notes?: string | null;
  trustWeight?: number;
};

export async function updateSource(sourceId: string, edits: SourceEdits, opts: { actor: string }) {
  const before = await prisma.source.findUniqueOrThrow({
    where: { id: sourceId },
    select: { status: true, homeCity: true, notes: true, trustWeight: true },
  });
  const data = Object.fromEntries(Object.entries(edits).filter(([, v]) => v !== undefined)) as SourceEdits;
  const changes = diffFields(before, data);
  if (Object.keys(changes).length === 0) return before;
  const after = await prisma.source.update({ where: { id: sourceId }, data });
  await writeAudit({ entity: "source", entityId: sourceId, action: "edit", actor: opts.actor, fieldChanges: changes });
  return after;
}
