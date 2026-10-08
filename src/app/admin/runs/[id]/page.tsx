import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/** A run opens in its post's window on History; a place refresh lands on the place's posts. */
export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const run = await prisma.engineRun.findUnique({
    where: { id: (await params).id },
    select: { postId: true, place: { select: { googlePlaceId: true } } },
  });
  if (run?.postId) redirect(`/admin/history?open=${run.postId}`);
  if (run?.place) redirect(`/admin/history?place=${run.place.googlePlaceId}`);
  redirect("/admin/history");
}
