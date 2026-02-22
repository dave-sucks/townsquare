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

    const { searchParams } = new URL(request.url);
    const includeUnresolved = searchParams.get("includeUnresolved") === "true";

    const statusFilter: Array<"failed" | "unresolved"> = ["failed"];
    if (includeUnresolved) {
      statusFilter.push("unresolved");
    }

    const postsToRetry = await prisma.ingestedPost.findMany({
      where: { importJobId: id, status: { in: statusFilter } },
    });

    let enqueued = 0;
    let unresolvedCount = 0;
    for (const post of postsToRetry) {
      if (post.status === "unresolved") {
        unresolvedCount++;
      }
      await prisma.ingestedPost.update({
        where: { id: post.id },
        data: {
          status: "new",
          error: null,
          resolveMethod: null,
          resolveConfidence: null,
          resolveCandidates: { set: null } as any,
        },
      });
      await enqueueJob("PROCESS_POST", { ingestedPostId: post.id });
      enqueued++;
    }

    if (unresolvedCount > 0) {
      await prisma.importJob.update({
        where: { id },
        data: { postsUnresolved: { decrement: unresolvedCount } },
      });
    }

    return NextResponse.json({ retriedCount: enqueued, unresolvedRetried: unresolvedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
