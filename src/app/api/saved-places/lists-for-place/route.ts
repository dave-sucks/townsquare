import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const googlePlaceId = request.nextUrl.searchParams.get("googlePlaceId");
  if (!googlePlaceId) {
    return NextResponse.json({ error: "googlePlaceId is required" }, { status: 400 });
  }

  const place = await prisma.place.findUnique({
    where: { googlePlaceId },
    select: { id: true },
  });

  if (!place) {
    return NextResponse.json({ listIds: [] });
  }

  const listPlaces = await prisma.listPlace.findMany({
    where: {
      placeId: place.id,
      list: { userId: user.id },
    },
    select: { listId: true },
  });

  return NextResponse.json({ listIds: listPlaces.map(lp => lp.listId) });
}
