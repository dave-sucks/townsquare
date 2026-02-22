import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/worker/queue";
import { z } from "zod";

const resolveSchema = z.object({
  googlePlaceIds: z.array(z.string().min(1)).min(1),
  confidence: z.number().min(0).max(1).default(1.0),
});

const legacyResolveSchema = z.object({
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

    let googlePlaceIds: string[];
    let confidence: number;

    const multiParsed = resolveSchema.safeParse(body);
    if (multiParsed.success) {
      googlePlaceIds = multiParsed.data.googlePlaceIds;
      confidence = multiParsed.data.confidence;
    } else {
      const legacyParsed = legacyResolveSchema.safeParse(body);
      if (!legacyParsed.success) {
        return NextResponse.json(
          { error: "Invalid request", details: multiParsed.error.issues },
          { status: 400 }
        );
      }
      googlePlaceIds = [legacyParsed.data.googlePlaceId];
      confidence = legacyParsed.data.confidence;
    }

    const post = await prisma.ingestedPost.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const primaryPlaceId = googlePlaceIds[0];

    await prisma.ingestedPost.update({
      where: { id },
      data: {
        resolvedGooglePlaceId: primaryPlaceId,
        resolveMethod: "manual",
        resolveConfidence: confidence,
        status: "new",
      },
    });

    await enqueueJob("PROCESS_POST", { ingestedPostId: id });

    if (googlePlaceIds.length > 1) {
      const extraCount = googlePlaceIds.length - 1;

      for (let i = 1; i < googlePlaceIds.length; i++) {
        const extraPost = await prisma.ingestedPost.create({
          data: {
            platform: post.platform,
            importJobId: post.importJobId,
            canonicalPostId: `${post.canonicalPostId}_place_${i}`,
            url: post.url,
            authorHandle: post.authorHandle,
            authorPlatformId: post.authorPlatformId,
            caption: post.caption,
            postedAt: post.postedAt,
            likeCount: post.likeCount,
            media: post.media as any,
            rawPayload: post.rawPayload as any,
            resolvedGooglePlaceId: googlePlaceIds[i],
            resolveMethod: "manual",
            resolveConfidence: confidence,
            status: "new",
          },
        });

        await enqueueJob("PROCESS_POST", { ingestedPostId: extraPost.id });
      }

      await prisma.importJob.update({
        where: { id: post.importJobId },
        data: {
          postsFetched: { increment: extraCount },
          postsUnresolved: { increment: extraCount },
        },
      });
    }

    return NextResponse.json({ success: true, placesResolved: googlePlaceIds.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
