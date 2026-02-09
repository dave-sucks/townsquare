import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/worker/queue";

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

    const failedPosts = await prisma.ingestedPost.findMany({
      where: { importJobId: id, status: "failed" },
    });

    let enqueued = 0;
    for (const post of failedPosts) {
      await prisma.ingestedPost.update({
        where: { id: post.id },
        data: { status: "new", error: null },
      });
      await enqueueJob("PROCESS_POST", { ingestedPostId: post.id });
      enqueued++;
    }

    return NextResponse.json({ retriedCount: enqueued });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
