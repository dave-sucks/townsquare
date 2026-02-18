import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const users = await prisma.user.findMany({
    where: {
      isInstagramImport: true,
      OR: [{ profileImageUrl: null }, { profileImageUrl: "" }],
    },
    select: { id: true, instagramHandle: true, username: true },
  });

  if (users.length === 0) {
    return NextResponse.json({ message: "All imported users already have avatars" });
  }

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: "APIFY_TOKEN not configured" }, { status: 500 });
  }

  const handles = users.map((u) => u.instagramHandle || u.username).filter(Boolean) as string[];

  try {
    const runResponse = await fetch(
      "https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs?waitForFinish=120",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apifyToken}`,
        },
        body: JSON.stringify({ usernames: handles }),
      }
    );

    if (!runResponse.ok) {
      return NextResponse.json({ error: `Apify failed: ${runResponse.status}` }, { status: 500 });
    }

    const runData = await runResponse.json();
    const datasetId = runData.data?.defaultDatasetId;
    if (!datasetId) {
      return NextResponse.json({ error: "No dataset returned" }, { status: 500 });
    }

    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?format=json`,
      { headers: { Authorization: `Bearer ${apifyToken}` } }
    );
    const profiles = await itemsRes.json();

    let updated = 0;
    for (const profile of profiles) {
      const picUrl = profile.profilePicUrlHD || profile.profilePicUrl;
      const handle = profile.username;
      if (!picUrl || !handle) continue;

      const user = users.find(
        (u) => u.instagramHandle === handle || u.username === handle
      );
      if (!user) continue;

      await prisma.user.update({
        where: { id: user.id },
        data: { profileImageUrl: picUrl },
      });
      updated++;
      console.log(`Updated avatar for @${handle}`);
    }

    return NextResponse.json({ total: users.length, updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
