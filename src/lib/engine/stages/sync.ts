/**
 * Stage 1, Sync (code): fetch a source's new posts from Apify
 * (apify~instagram-scraper). The run is started without waiting, polled by
 * the Inngest function, and its dataset read once it succeeds, so a large
 * import never comes back partial.
 */

import { prisma } from "@/lib/prisma";
import { downloadAndStoreImage } from "@/lib/object-storage";
import { ENGINE } from "../config";
import { upsertSyncedPost } from "../write/posts";

const APIFY = "https://api.apify.com/v2";

function apifyToken(): string {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");
  return token;
}

async function apify<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${APIFY}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apifyToken()}`, ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Apify ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

export const profileUrl = (handle: string) => `https://www.instagram.com/${handle}/`;

/** Start a sync: an import_jobs row (the UI calls it a sync) and an Apify run. */
export async function startSync(sourceId: string, opts: { full?: boolean } = {}) {
  const source = await prisma.source.findUniqueOrThrow({ where: { id: sourceId } });
  const since =
    !opts.full && source.lastPostAt
      ? new Date(source.lastPostAt.getTime() - ENGINE.sync.overlapDays * 86_400_000)
      : null;
  const limit = since ? ENGINE.sync.resultsLimit : ENGINE.sync.firstSyncLimit;

  const job = await prisma.importJob.create({
    data: {
      platform: "instagram",
      type: "profile",
      input: profileUrl(source.handle),
      maxPosts: limit,
      status: "running",
      startedAt: new Date(),
      sourceId,
      since,
    },
    select: { id: true },
  });

  const run = await apify<{ data: { id: string } }>(`/acts/apify~instagram-scraper/runs`, {
    method: "POST",
    body: JSON.stringify({
      directUrls: [profileUrl(source.handle)],
      resultsType: "posts",
      resultsLimit: limit,
      addParentData: false,
      ...(since ? { onlyPostsNewerThan: since.toISOString().slice(0, 10) } : {}),
    }),
  });
  await prisma.importJob.update({ where: { id: job.id }, data: { apifyRunId: run.data.id } });
  return { syncId: job.id, apifyRunId: run.data.id, handle: source.handle, since: since?.toISOString() ?? null, limit };
}

export async function checkApifyRun(apifyRunId: string) {
  const run = await apify<{ data: { status: string; defaultDatasetId: string } }>(`/actor-runs/${apifyRunId}`);
  return { status: run.data.status, datasetId: run.data.defaultDatasetId };
}

type ApifyPost = Record<string, unknown> & {
  shortCode?: string;
  timestamp?: string;
  error?: string;
  errorDescription?: string;
  ownerFullName?: string;
};

/** Store the dataset's posts. Returns the ids of posts the engine hasn't seen before. */
export async function storeSyncResults(syncId: string, datasetId: string) {
  const job = await prisma.importJob.findUniqueOrThrow({ where: { id: syncId }, include: { source: true } });
  if (!job.source) throw new Error(`Sync ${syncId} has no source`);
  const res = await fetch(`${APIFY}/datasets/${datasetId}/items?format=json&clean=true`, {
    headers: { Authorization: `Bearer ${apifyToken()}` },
  });
  if (!res.ok) throw new Error(`Apify dataset ${datasetId}: ${res.status}`);
  const items = (await res.json()) as ApifyPost[];

  const posts = items.filter((i) => i.shortCode && !i.error);
  const errors = items.filter((i) => i.error).map((i) => `${i.error}: ${i.errorDescription ?? ""}`);
  if (posts.length === 0 && errors.length > 0) throw new Error(`Apify returned only errors: ${errors[0]}`);

  await ensureCreator(job.source.id, job.source.handle, posts[0]?.ownerFullName ?? null);

  const newPostIds: string[] = [];
  for (const raw of posts) {
    const stored = await upsertSyncedPost({ sourceId: job.source.id, importJobId: job.id, handle: job.source.handle, raw });
    if (stored?.created) newPostIds.push(stored.id);
  }

  const newest = posts.map((p) => (p.timestamp ? new Date(p.timestamp).getTime() : 0)).reduce((a, b) => Math.max(a, b), 0);
  await prisma.source.update({
    where: { id: job.source.id },
    data: {
      lastSyncedAt: new Date(),
      ...(newest && (!job.source.lastPostAt || newest > job.source.lastPostAt.getTime()) ? { lastPostAt: new Date(newest) } : {}),
    },
  });
  await prisma.importJob.update({
    where: { id: job.id },
    data: { status: "completed", completedAt: new Date(), postsFetched: posts.length, error: errors.length ? errors.slice(0, 3).join("; ") : null },
  });
  return { fetched: posts.length, newPostIds, errors: errors.length };
}

export async function failSync(syncId: string, error: string) {
  await prisma.importJob.update({ where: { id: syncId }, data: { status: "failed", error, completedAt: new Date() } });
}

/**
 * The creator's User: created (with a mirrored profile photo) the first time
 * a source syncs, and linked to the source.
 */
async function ensureCreator(sourceId: string, handle: string, fullName: string | null) {
  const source = await prisma.source.findUniqueOrThrow({ where: { id: sourceId }, select: { userId: true } });
  if (source.userId) return source.userId;

  let user = await prisma.user.findFirst({ where: { instagramHandle: { equals: handle, mode: "insensitive" } }, select: { id: true } });
  if (!user) {
    const [firstName, ...rest] = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
    let profileImageUrl: string | null = null;
    try {
      const pic = await fetchProfilePicUrl(handle);
      if (pic) profileImageUrl = await downloadAndStoreImage(pic, `profile-pics/${handle}.jpg`);
    } catch (err) {
      console.error(`[engine/sync] profile photo for @${handle}:`, err instanceof Error ? err.message : err);
    }
    user = await prisma.user.create({
      data: {
        instagramHandle: handle,
        username: handle,
        isInstagramImport: true,
        lastInstagramSync: new Date(),
        firstName: firstName ?? null,
        lastName: rest.join(" ") || null,
        profileImageUrl,
      },
      select: { id: true },
    });
  }
  await prisma.source.update({ where: { id: sourceId }, data: { userId: user.id } });
  return user.id;
}

async function fetchProfilePicUrl(handle: string): Promise<string | null> {
  const run = await apify<{ data: { defaultDatasetId?: string } }>(
    `/acts/apify~instagram-profile-scraper/runs?waitForFinish=120`,
    { method: "POST", body: JSON.stringify({ usernames: [handle] }) },
  );
  if (!run.data.defaultDatasetId) return null;
  const items = await apify<{ profilePicUrlHD?: string; profilePicUrl?: string }[]>(`/datasets/${run.data.defaultDatasetId}/items?format=json`);
  return items[0]?.profilePicUrlHD ?? items[0]?.profilePicUrl ?? null;
}
