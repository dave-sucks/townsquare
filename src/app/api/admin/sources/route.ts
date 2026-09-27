import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { listSources } from "@/lib/engine/sources";
import { createSource } from "@/lib/engine/write/sources";
import { syncSourceNow } from "@/lib/engine/events";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  return NextResponse.json({ sources: await listSources() });
}

/** Add a source by handle or profile URL, and start its first sync. */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  const parsed = z.object({ handle: z.string().min(1) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter an Instagram handle" }, { status: 400 });
  try {
    const { source, created } = await createSource(parsed.data.handle, { actor: user.id });
    const queued = await syncSourceNow(source.id);
    return NextResponse.json({ source: { id: source.id, handle: source.handle }, created, queued });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to add the source" }, { status: 400 });
  }
}
