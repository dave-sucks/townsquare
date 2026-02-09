import { claimNextJob, completeJob, failJob } from "./queue";
import { handleImportProfile } from "./handlers/import-profile";
import { handleProcessPost } from "./handlers/process-post";
import { handleEnrichReview } from "./handlers/enrich-review";
import { handleUpdatePlaceAggregates } from "./handlers/update-place-aggregates";
import { handleRefreshPlaceSummary } from "./handlers/refresh-place-summary";
import { job_type } from "@/generated/prisma";

const handlers: Record<job_type, (payload: any) => Promise<void>> = {
  IMPORT_PROFILE: handleImportProfile,
  PROCESS_POST: handleProcessPost,
  ENRICH_REVIEW: handleEnrichReview,
  UPDATE_PLACE_AGGREGATES: handleUpdatePlaceAggregates,
  REFRESH_PLACE_SUMMARY: handleRefreshPlaceSummary,
};

let isRunning = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;

async function tick() {
  if (isRunning) return;
  isRunning = true;

  try {
    const job = await claimNextJob();
    if (!job) {
      isRunning = false;
      return;
    }

    console.log(`[Worker] Processing job ${job.id} (${job.type}), attempt ${job.attempts}`);

    const handler = handlers[job.type];
    if (!handler) {
      await failJob(job.id, `Unknown job type: ${job.type}`, 1);
      console.error(`[Worker] Unknown job type: ${job.type}`);
      isRunning = false;
      return;
    }

    try {
      await handler(job.payload);
      await completeJob(job.id);
      console.log(`[Worker] Job ${job.id} (${job.type}) completed`);
    } catch (err: any) {
      console.error(`[Worker] Job ${job.id} (${job.type}) failed:`, err.message);
      await failJob(job.id, err.message || "Unknown error");
    }
  } catch (err: any) {
    console.error("[Worker] Tick error:", err.message);
  } finally {
    isRunning = false;
  }
}

export function startWorker(intervalMs = 3000) {
  if (pollInterval) return;
  console.log(`[Worker] Starting job worker (polling every ${intervalMs}ms)`);
  pollInterval = setInterval(tick, intervalMs);
  tick();
}

export function stopWorker() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log("[Worker] Worker stopped");
  }
}
