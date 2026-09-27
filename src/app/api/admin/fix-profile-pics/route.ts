import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { downloadAndStoreImage } from "@/lib/object-storage";

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  const importUsers = await prisma.user.findMany({
    where: {
      isInstagramImport: true,
      profileImageUrl: { not: null },
    },
  });

  const results: { handle: string; status: string }[] = [];

  for (const u of importUsers) {
    if (!u.profileImageUrl || !u.instagramHandle) continue;

    if (u.profileImageUrl.includes("object-storage") || u.profileImageUrl.includes("replit")) {
      results.push({ handle: u.instagramHandle, status: "already stored" });
      continue;
    }

    try {
      const storedUrl = await downloadAndStoreImage(
        u.profileImageUrl,
        `profile-pics/${u.instagramHandle}.jpg`
      );
      await prisma.user.update({
        where: { id: u.id },
        data: { profileImageUrl: storedUrl },
      });
      results.push({ handle: u.instagramHandle, status: "fixed" });
    } catch (err: any) {
      results.push({ handle: u.instagramHandle, status: `error: ${err.message}` });
    }
  }

  return NextResponse.json({ results });
}
