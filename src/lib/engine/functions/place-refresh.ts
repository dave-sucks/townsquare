/**
 * engine/place.refresh: Aggregate then Summarize for one place, debounced
 * so a burst of changes (a roundup, a backfill) refreshes the place once.
 */

import { prisma } from "@/lib/prisma";
import { ENGINE } from "../config";
import { inngest, placeChanged } from "../inngest";
import { runAggregate } from "../stages/aggregate";
import { runSummarize } from "../stages/summarize";
import { finishRun, recordStep, startRun } from "../write/runs";

type TimeStr = `${number}${"s" | "m" | "h"}`;

export const placeRefresh = inngest.createFunction(
  {
    id: "engine-place-refresh",
    name: "Refresh a place",
    triggers: [placeChanged],
    debounce: { key: "event.data.placeId", period: ENGINE.runtime.placeDebounce as TimeStr },
    concurrency: { limit: ENGINE.runtime.postConcurrency },
    retries: ENGINE.runtime.retries,
  },
  async ({ event, step }) => {
    const { placeId, force } = event.data;
    const exists = await step.run("check", async () => !!(await prisma.place.findUnique({ where: { id: placeId }, select: { id: true } })));
    if (!exists) return { skipped: "place no longer exists" };

    const runId = await step.run("start", () => startRun({ kind: "place", placeId, trigger: "place_changed" }));
    await step.run("aggregate", () => recordStep(runId, "aggregate", "", { placeId }, () => runAggregate(placeId)));
    await step.run("summarize", () => recordStep(runId, "summarize", "", { placeId }, () => runSummarize(runId, placeId, { force })));
    return step.run("finish", () => finishRun(runId));
  },
);
