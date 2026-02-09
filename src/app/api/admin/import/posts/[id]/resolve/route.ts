import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/worker/queue";
import { z } from "zod";

const resolveSchema = z.object({
  googlePlaceId: z.string().min(1),
  confidence: z.number().min(0).max(1).default(1.0),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = resolveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { googlePlaceId, confidence } = parsed.data;

    const post = await prisma.ingestedPost.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    await prisma.ingestedPost.update({
      where: { id },
      data: {
        resolvedGooglePlaceId: googlePlaceId,
        resolveMethod: "manual",
        resolveConfidence: confidence,
        status: "new",
      },
    });

    await enqueueJob("PROCESS_POST", { ingestedPostId: id });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
