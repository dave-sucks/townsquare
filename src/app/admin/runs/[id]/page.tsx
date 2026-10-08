import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** A run opens in its post's window on History; a place refresh lands on the place's posts. */
export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(await getCurrentUser())) redirect("/");
  const run = await prisma.engineRun.findUnique({
    where: { id: (await params).id },
    select: { postId: true, place: { select: { googlePlaceId: true } } },
  });
  if (run?.postId) redirect(`/admin/history?open=${run.postId}`);
  if (run?.place) redirect(`/admin/history?place=${run.place.googlePlaceId}`);
  redirect("/admin/history");
}
