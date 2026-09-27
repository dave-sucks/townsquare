/**
 * engine/source.sync: fetch a source's new posts. Starts an Apify run,
 * polls it every 20 seconds for up to 20 minutes, stores the posts and sends
 * engine/post.ingested for each new one. One sync per source at a time.
 * Plus the daily sync of every active source at 06:00 New York time.
 */

import { prisma } from "@/lib/prisma";
import { ENGINE } from "../config";
import { inngest, postIngested, sourceSync } from "../inngest";
import { checkApifyRun, failSync, startSync, storeSyncResults } from "../stages/sync";

const FAILED = new Set(["FAILED", "ABORTED", "TIMED-OUT"]);

export const syncSource = inngest.createFunction(
  {
    id: "engine-source-sync",
    name: "Sync a source",
    triggers: [sourceSync],
    concurrency: { key: "event.data.sourceId", limit: 1 },
    retries: ENGINE.runtime.retries,
  },
  async ({ event, step }) => {
    const started = await step.run("start", () => startSync(event.data.sourceId));
    const polls = Math.ceil((ENGINE.sync.maxPollMinutes * 60) / ENGINE.sync.pollEverySeconds);

    let datasetId: string | null = null;
    for (let i = 0; i < polls; i++) {
      await step.sleep(`wait-${i}`, `${ENGINE.sync.pollEverySeconds}s`);
      const run = await step.run(`check-${i}`, () => checkApifyRun(started.apifyRunId));
      if (run.status === "SUCCEEDED") {
        datasetId = run.datasetId;
        break;
      }
      if (FAILED.has(run.status)) {
        await step.run("failed", () => failSync(started.syncId, `Apify run ${run.status}`));
        return { syncId: started.syncId, status: "failed" };
      }
    }
    if (!datasetId) {
      await step.run("timed-out", () => failSync(started.syncId, `Apify run still going after ${ENGINE.sync.maxPollMinutes} minutes`));
      return { syncId: started.syncId, status: "failed" };
    }

    const stored = await step.run("store", () => storeSyncResults(started.syncId, datasetId!));
    if (stored.newPostIds.length > 0) {
      await step.sendEvent("posts-ingested", stored.newPostIds.map((postId) => postIngested.create({ postId })));
    }
    return { syncId: started.syncId, status: "completed", ...stored };
  },
);

export const dailySync = inngest.createFunction(
  { id: "engine-daily-sync", name: "Daily sync of every active source", triggers: [{ cron: ENGINE.sync.dailyCron }] },
  async ({ step }) => {
    const sources = await step.run("active-sources", async () =>
      (await prisma.source.findMany({ where: { status: "active" }, select: { id: true } })).map((s) => s.id),
    );
    if (sources.length > 0) await step.sendEvent("sync-each", sources.map((sourceId) => sourceSync.create({ sourceId })));
    return { sources: sources.length };
  },
);
