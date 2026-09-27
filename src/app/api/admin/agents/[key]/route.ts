import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ENGINE_MODELS } from "@/lib/engine/pricing";
import { versionById, type AgentVersionConfig } from "@/lib/engine/agents/registry";
import { archiveVersion, promoteVersion, saveDraft } from "@/lib/engine/write/agents";
import { lastStepOutput, type StepResult } from "@/lib/engine/write/runs";
import { runRead, type ReadResult } from "@/lib/engine/stages/read";
import { runResolve } from "@/lib/engine/stages/resolve";
import { runTag } from "@/lib/engine/stages/tag";
import { runSummarize } from "@/lib/engine/stages/summarize";
import type { LlmUsage } from "@/lib/engine/llm";

type Params = { params: Promise<{ key: string }> };
const KEYS = ["read", "resolve", "tag", "summarize"] as const;
type Key = (typeof KEYS)[number];

export async function GET(_req: NextRequest, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;
  const key = (await params).key;
  const agent = await prisma.agent.findUnique({
    where: { key },
    include: { versions: { orderBy: { version: "desc" } } },
  });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const recentPosts = await prisma.ingestedPost.findMany({
    where: { lastRunId: { not: null }, ...(key === "tag" ? { mentions: { some: {} } } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: { id: true, canonicalPostId: true, authorHandle: true, caption: true },
  });
  const recentPlaces =
    key === "summarize"
      ? await prisma.place.findMany({
          where: { aiSummaryUpdatedAt: { not: null }, reviews: { some: {} } },
          orderBy: { aiSummaryUpdatedAt: "desc" },
          take: 12,
          select: { id: true, name: true, googlePlaceId: true },
        })
      : [];
  return NextResponse.json({
    agent: { key: agent.key, name: agent.name, description: agent.description, activeVersionId: agent.activeVersionId },
    versions: agent.versions,
    models: ENGINE_MODELS,
    recentPosts: recentPosts.map((p) => ({ id: p.id, shortcode: p.canonicalPostId, handle: p.authorHandle, caption: p.caption?.slice(0, 90) ?? null })),
    recentPlaces,
  });
}

const draftSchema = z.object({
  action: z.literal("save_draft"),
  versionId: z.string().optional(),
  systemPrompt: z.string(),
  model: z.string(),
  effort: z.string().nullable(),
  maxTokens: z.number().int(),
  notes: z.string().nullable().optional(),
});
const actionSchema = z.discriminatedUnion("action", [
  draftSchema,
  z.object({ action: z.literal("promote"), versionId: z.string(), note: z.string().nullable().optional() }),
  z.object({ action: z.literal("archive"), versionId: z.string() }),
  z.object({
    action: z.literal("playground"),
    versionId: z.string(),
    compare: z.boolean().optional(),
    /** A post id, shortcode or Instagram URL; or a place id for Summarize. */
    target: z.string().min(1),
  }),
]);

function shortcodeOf(target: string) {
  return target.match(/instagram\.com\/(?:p|reel|reels)\/([^/?#]+)/)?.[1] ?? target.trim();
}

const totals = (usage: LlmUsage[] = []) => ({
  tokensIn: usage.reduce((n, u) => n + u.tokensIn, 0),
  tokensOut: usage.reduce((n, u) => n + u.tokensOut, 0),
  tokensCached: usage.reduce((n, u) => n + u.tokensCached, 0),
  costUsd: Math.round(usage.reduce((n, u) => n + u.costUsd, 0) * 1_000_000) / 1_000_000,
  latencyMs: usage.reduce((n, u) => n + u.latencyMs, 0),
});

/** Run one version on a post or place without writing anything. */
async function runPlayground(key: Key, version: AgentVersionConfig, target: string) {
  const dry = { version, dryRun: true } as const;
  if (key === "summarize") {
    const place = await prisma.place.findFirst({ where: { OR: [{ id: target }, { googlePlaceId: target }] }, select: { id: true } });
    if (!place) throw new Error("Pick a place for Summarize");
    const res = await runSummarize("playground", place.id, { ...dry, force: true });
    return { output: res.output, ...totals(res.usage) };
  }
  const code = shortcodeOf(target);
  const post = await prisma.ingestedPost.findFirst({
    where: { OR: [{ id: target }, { canonicalPostId: code }] },
    select: { id: true, authorHandle: true, rawPayload: true, source: { select: { handle: true, homeCity: true } } },
  });
  if (!post) throw new Error("That post isn't in Townsquare yet");
  if (key === "read") {
    const res = await runRead("playground", post.id, dry);
    return { output: res.output, ...totals(res.usage) };
  }
  if (key === "tag") {
    const mentions = await prisma.review.findMany({ where: { ingestedPostId: post.id }, select: { id: true, place: { select: { name: true } } }, take: 5 });
    if (mentions.length === 0) throw new Error("This post has no mentions to tag");
    const results: { place: string; output: unknown }[] = [];
    const usage: LlmUsage[] = [];
    for (const m of mentions) {
      const res: StepResult<unknown> = await runTag("playground", m.id, dry);
      results.push({ place: m.place.name, output: res.output });
      usage.push(...(res.usage ?? []));
    }
    return { output: results, ...totals(usage) };
  }
  // Resolve: the post's stored reading, each place decided again with the agent forced on.
  const read = await lastStepOutput<ReadResult>(post.id, "read");
  if (!read || read.places.length === 0) throw new Error("This post has no stored Read output with places");
  const results: unknown[] = [];
  const usage: LlmUsage[] = [];
  for (const place of read.places.slice(0, 5)) {
    const res = await runResolve("playground", post.id, place, {
      handle: post.source?.handle ?? post.authorHandle,
      homeCity: post.source?.homeCity ?? null,
      locationName: read.locationName,
    }, { ...dry, forceAgent: true });
    results.push({ place: place.name, ...res.output });
    usage.push(...(res.usage ?? []));
  }
  return { output: results, ...totals(usage) };
}

export async function POST(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  const key = (await params).key as Key;
  if (!KEYS.includes(key)) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const parsed = actionSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  const body = parsed.data;
  try {
    if (body.action === "save_draft") {
      const v = await saveDraft(key, body, { actor: user.id });
      return NextResponse.json({ version: v });
    }
    if (body.action === "promote") {
      await promoteVersion(key, body.versionId, { actor: user.id, note: body.note });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "archive") {
      await archiveVersion(key, body.versionId, { actor: user.id });
      return NextResponse.json({ ok: true });
    }
    const version = await versionById(body.versionId);
    const agent = await prisma.agent.findUniqueOrThrow({ where: { key }, select: { activeVersionId: true } });
    const [draft, active] = await Promise.all([
      runPlayground(key, version, body.target),
      body.compare && agent.activeVersionId && agent.activeVersionId !== version.id
        ? versionById(agent.activeVersionId).then((v) => runPlayground(key, v, body.target))
        : Promise.resolve(null),
    ]);
    return NextResponse.json({ draft, active });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
