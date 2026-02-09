import { prisma } from "@/lib/prisma";
import { enqueueJob } from "../queue";

interface ImportProfilePayload {
  importJobId: string;
}

export async function handleImportProfile(payload: ImportProfilePayload) {
  const { importJobId } = payload;

  const importJob = await prisma.importJob.findUnique({
    where: { id: importJobId },
  });
  if (!importJob) throw new Error(`ImportJob ${importJobId} not found`);

  await prisma.importJob.update({
    where: { id: importJobId },
    data: { status: "running", startedAt: new Date() },
  });

  try {
    const handle = extractHandle(importJob.input);
    if (!handle) throw new Error(`Invalid profile URL: ${importJob.input}`);

    const posts = await fetchProfilePosts(handle, importJob.maxPosts);

    const profilePicUrl = posts[0]?.ownerProfilePicUrl || posts[0]?.profilePicUrl || null;
    const fullName = posts[0]?.ownerFullName || posts[0]?.fullName || null;
    await upsertCreatorUser(handle, profilePicUrl, fullName);

    await prisma.importJob.update({
      where: { id: importJobId },
      data: { postsFetched: posts.length },
    });

    for (const post of posts) {
      const mediaItems = extractMedia(post);
      const canonicalPostId = post.shortCode || post.id || post.url;

      if (!canonicalPostId) continue;

      const existing = await prisma.ingestedPost.findUnique({
        where: {
          platform_canonicalPostId: {
            platform: "instagram",
            canonicalPostId: String(canonicalPostId),
          },
        },
      });
      if (existing) continue;

      const ingestedPost = await prisma.ingestedPost.create({
        data: {
          platform: "instagram",
          importJobId,
          canonicalPostId: String(canonicalPostId),
          url: post.url || `https://www.instagram.com/p/${post.shortCode}/`,
          authorHandle: handle,
          authorPlatformId: post.ownerId ? String(post.ownerId) : null,
          caption: post.caption || null,
          postedAt: post.timestamp ? new Date(post.timestamp) : null,
          likeCount: post.likesCount ?? post.likes ?? null,
          media: mediaItems,
          rawPayload: post as any,
          status: "new",
        },
      });

      await enqueueJob("PROCESS_POST", { ingestedPostId: ingestedPost.id });
    }

    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: "completed", completedAt: new Date() },
    });
  } catch (err: any) {
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: "failed", error: err.message, completedAt: new Date() },
    });
    throw err;
  }
}

function extractHandle(input: string): string | null {
  const match = input.match(/instagram\.com\/([^/?]+)/);
  if (match) return match[1].replace(/^@/, "");
  if (/^@?[\w.]+$/.test(input)) return input.replace(/^@/, "");
  return null;
}

async function upsertCreatorUser(handle: string, profilePicUrl?: string | null, fullName?: string | null) {
  const existing = await prisma.user.findUnique({
    where: { instagramHandle: handle },
  });

  const nameParts = fullName?.trim().split(/\s+/) || [];
  const firstName = nameParts[0] || null;
  const lastName = nameParts.slice(1).join(" ") || null;

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        lastInstagramSync: new Date(),
        ...(profilePicUrl && !existing.profileImageUrl ? { profileImageUrl: profilePicUrl } : {}),
        ...(firstName && !existing.firstName ? { firstName } : {}),
        ...(lastName && !existing.lastName ? { lastName } : {}),
      },
    });
    return existing;
  }

  return prisma.user.create({
    data: {
      instagramHandle: handle,
      username: handle,
      isInstagramImport: true,
      lastInstagramSync: new Date(),
      ...(profilePicUrl ? { profileImageUrl: profilePicUrl } : {}),
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    },
  });
}

async function fetchProfilePosts(
  handle: string,
  maxPosts: number
): Promise<any[]> {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) throw new Error("APIFY_TOKEN not configured");

  console.log(`[Apify] Starting Instagram scrape for @${handle}, max ${maxPosts} posts`);

  const runResponse = await fetch(
    "https://api.apify.com/v2/acts/apify~instagram-scraper/runs?waitForFinish=300",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apifyToken}`,
      },
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${handle}/`],
        resultsLimit: maxPosts,
        resultsType: "posts",
        addParentData: false,
      }),
    }
  );

  if (!runResponse.ok) {
    const errorText = await runResponse.text();
    throw new Error(`Apify run failed: ${runResponse.status} ${errorText}`);
  }

  const runData = await runResponse.json();
  const datasetId = runData.data?.defaultDatasetId;

  if (!datasetId) {
    if (runData.data?.status === "RUNNING" || runData.data?.status === "READY") {
      const runId = runData.data.id;
      return await pollForResults(apifyToken, runId);
    }
    throw new Error("No dataset ID returned from Apify");
  }

  const itemsResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?format=json`,
    { headers: { Authorization: `Bearer ${apifyToken}` } }
  );

  if (!itemsResponse.ok) {
    throw new Error(`Failed to fetch dataset: ${itemsResponse.status}`);
  }

  const items = await itemsResponse.json();
  console.log(`[Apify] Got ${items.length} posts for @${handle}`);
  return items;
}

async function pollForResults(token: string, runId: string): Promise<any[]> {
  const maxWait = 600000;
  const pollInterval = 10000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const statusData = await statusRes.json();
    const status = statusData.data?.status;

    if (status === "SUCCEEDED") {
      const datasetId = statusData.data.defaultDatasetId;
      const itemsRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?format=json`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return await itemsRes.json();
    }

    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify run ${status}`);
    }

    console.log(`[Apify] Run ${runId} status: ${status}, waiting...`);
  }

  throw new Error("Apify run timed out after 10 minutes");
}

function extractMedia(post: any): Array<{ url: string; type: string }> {
  const media: Array<{ url: string; type: string }> = [];

  if (post.images && Array.isArray(post.images)) {
    for (const img of post.images) {
      media.push({ url: img, type: "image" });
    }
  } else if (post.displayUrl) {
    media.push({ url: post.displayUrl, type: post.type === "Video" ? "video" : "image" });
  }

  if (post.childPosts && Array.isArray(post.childPosts)) {
    for (const child of post.childPosts) {
      if (child.displayUrl) {
        media.push({ url: child.displayUrl, type: child.type === "Video" ? "video" : "image" });
      }
    }
  }

  if (media.length === 0 && post.thumbnailUrl) {
    media.push({ url: post.thumbnailUrl, type: "image" });
  }

  return media;
}
