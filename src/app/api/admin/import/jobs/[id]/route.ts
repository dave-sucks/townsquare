import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const importJob = await prisma.importJob.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            ingestedPosts: true,
          },
        },
      },
    });

    if (!importJob) {
      return NextResponse.json({ error: "Import job not found" }, { status: 404 });
    }

    const statusCounts = await prisma.ingestedPost.groupBy({
      by: ["status"],
      where: { importJobId: id },
      _count: true,
    });

    const counts: Record<string, number> = {};
    for (const s of statusCounts) {
      counts[s.status] = s._count;
    }

    return NextResponse.json({
      ...importJob,
      statusBreakdown: counts,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
