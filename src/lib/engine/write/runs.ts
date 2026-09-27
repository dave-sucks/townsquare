/**
 * Runs and steps: the ledger of what the pipeline did. A run's status is
 * derived from its step rows and open review items, never from what a
 * model said.
 */

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { LlmOutputError, type LlmUsage } from "../llm";

export type Stage = "sync" | "media" | "read" | "resolve" | "mentions" | "tag" | "aggregate" | "summarize";

export async function startRun(opts: {
  kind: "post" | "place";
  postId?: string;
  placeId?: string;
  trigger: string;
  fromStage?: string | null;
  requestedBy?: string | null;
}): Promise<string> {
  const run = await prisma.engineRun.create({
    data: {
      kind: opts.kind,
      postId: opts.postId ?? null,
      placeId: opts.placeId ?? null,
      trigger: opts.trigger,
      fromStage: opts.fromStage ?? null,
      requestedBy: opts.requestedBy ?? null,
      status: "running",
    },
    select: { id: true },
  });
  if (opts.postId) {
    await prisma.ingestedPost.update({ where: { id: opts.postId }, data: { lastRunId: run.id } });
  }
  return run.id;
}

export type StepResult<T> = {
  output: T;
  /** Every model call the stage made (a gate retry makes two). */
  usage?: LlmUsage[];
  agentVersionId?: string | null;
  status?: "completed" | "skipped";
};

const json = (v: unknown) => (v === undefined ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue));

function totals(usage: LlmUsage[]) {
  return {
    model: usage[0]?.model ?? null,
    tokensIn: usage.reduce((n, u) => n + u.tokensIn, 0),
    tokensOut: usage.reduce((n, u) => n + u.tokensOut, 0),
    tokensCached: usage.reduce((n, u) => n + u.tokensCached, 0),
    costUsd: Math.round(usage.reduce((n, u) => n + u.costUsd, 0) * 1_000_000) / 1_000_000,
  };
}

/**
 * Runs one stage and records it as a step row. The same (run, stage, key)
 * again is an Inngest retry: the row is reused and its attempt bumped.
 * A failed model call that was still billed keeps its cost on the row.
 */
export async function recordStep<T>(
  runId: string,
  stage: Stage,
  key: string,
  input: unknown,
  fn: () => Promise<StepResult<T>>,
): Promise<T> {
  const step = await prisma.engineStep.upsert({
    where: { runId_stage_key: { runId, stage, key } },
    create: { runId, stage, key, input: json(input), status: "running" },
    update: { status: "running", attempt: { increment: 1 }, error: null, input: json(input), startedAt: new Date() },
    select: { id: true },
  });
  const started = Date.now();
  try {
    const result = await fn();
    const t = totals(result.usage ?? []);
    await prisma.engineStep.update({
      where: { id: step.id },
      data: {
        status: result.status ?? "completed",
        output: json(result.output),
        agentVersionId: result.agentVersionId ?? null,
        ...t,
        latencyMs: Date.now() - started,
        finishedAt: new Date(),
      },
    });
    return result.output;
  } catch (err) {
    const billed = err instanceof LlmOutputError ? totals([err.usage]) : null;
    await prisma.engineStep.update({
      where: { id: step.id },
      data: {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        ...(billed ?? {}),
        latencyMs: Date.now() - started,
        finishedAt: new Date(),
      },
    });
    throw err;
  }
}

/** Close a run: status from its steps and open review items, cost from its steps. */
export async function finishRun(runId: string, error?: string | null) {
  const [steps, openItems] = await Promise.all([
    prisma.engineStep.findMany({ where: { runId }, select: { status: true, costUsd: true } }),
    prisma.reviewItem.count({ where: { runId, status: "open" } }),
  ]);
  const failed = error != null || steps.some((s) => s.status === "failed");
  const status = failed ? "failed" : openItems > 0 ? "needs_review" : "completed";
  const costUsd = Math.round(steps.reduce((n, s) => n + s.costUsd, 0) * 1_000_000) / 1_000_000;
  return prisma.engineRun.update({
    where: { id: runId },
    data: { status, costUsd, finishedAt: new Date(), ...(error != null ? { error } : {}) },
    select: { id: true, status: true, costUsd: true },
  });
}

/** A step's stored output from the post's latest run, to start a re-run from a later stage. */
export async function lastStepOutput<T>(postId: string, stage: Stage, key = ""): Promise<T | null> {
  const step = await prisma.engineStep.findFirst({
    where: { stage, key, status: "completed", run: { postId } },
    orderBy: { startedAt: "desc" },
    select: { output: true },
  });
  return (step?.output as T | undefined) ?? null;
}
