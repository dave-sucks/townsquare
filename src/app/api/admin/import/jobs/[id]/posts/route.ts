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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;

    const posts = await prisma.ingestedPost.findMany({
      where: {
        importJobId: id,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const resolvedPlaceIds = posts
      .map((p) => p.resolvedGooglePlaceId)
      .filter(Boolean) as string[];

    let placesMap: Record<string, { name: string; formattedAddress: string }> = {};
    if (resolvedPlaceIds.length > 0) {
      const places = await prisma.place.findMany({
        where: { googlePlaceId: { in: resolvedPlaceIds } },
        select: { googlePlaceId: true, name: true, formattedAddress: true },
      });
      for (const p of places) {
        placesMap[p.googlePlaceId] = { name: p.name, formattedAddress: p.formattedAddress };
      }
    }

    const postsWithPlaces = posts.map((post) => ({
      ...post,
      resolvedPlace: post.resolvedGooglePlaceId
        ? placesMap[post.resolvedGooglePlaceId] || null
        : null,
    }));

    return NextResponse.json({ posts: postsWithPlaces });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
