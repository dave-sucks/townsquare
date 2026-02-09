import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/worker/queue";
import { z } from "zod";

const importSchema = z.object({
  profileUrl: z.string().min(1),
  maxPosts: z.number().int().min(1).max(200).default(100),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { profileUrl, maxPosts } = parsed.data;

    const importJob = await prisma.importJob.create({
      data: {
        platform: "instagram",
        type: "profile",
        input: profileUrl,
        maxPosts,
        status: "pending",
      },
    });

    await enqueueJob("IMPORT_PROFILE", { importJobId: importJob.id });

    return NextResponse.json({
      importJobId: importJob.id,
      status: "pending",
    });
  } catch (error: any) {
    console.error("Import profile error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start import" },
      { status: 500 }
    );
  }
}
