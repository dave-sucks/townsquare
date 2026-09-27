/**
 * Stage 8, Summarize (agent, per place): the summary at the top of the
 * place page and its known-for dishes, from the place's mentions. The only
 * writer of ai_summary; runs only when the mentions changed.
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { formatPriceLevel } from "@/lib/places/format";
import { callStructured } from "../llm";
import { activeVersion } from "../agents/registry";
import { summarizeSchema } from "../agents/summarize/schema";
import { ENGINE } from "../config";
import { dishKey } from "../text";
import { setPlaceSummary, type KnownForDish } from "../write/places";
import type { StepResult } from "../write/runs";
import { countDishes } from "./aggregate";

export type SummarizeResult =
  | { skipped: true; reason: string; inputHash?: string }
  | { skipped: false; inputHash: string; summary: string; knownFor: KnownForDish[]; droppedKnownFor: string[] };

export async function runSummarize(runId: string, placeId: string): Promise<StepResult<SummarizeResult>> {
  const place = await prisma.place.findUniqueOrThrow({
    where: { id: placeId },
    select: { name: true, types: true, priceLevel: true, neighborhood: true, locality: true, verdictCounts: true },
  });
  const reviews = await prisma.review.findMany({
    where: { placeId },
    select: {
      id: true,
      excerpt: true,
      socialPostCaption: true,
      verdict: true,
      dishes: true,
      socialPostLikes: true,
      socialPostPostedAt: true,
      createdAt: true,
      user: { select: { username: true, instagramHandle: true } },
    },
  });
  if (reviews.length === 0) return { output: { skipped: true, reason: "no mentions" }, status: "skipped" };

  const mentions = reviews
    .map((r) => ({
      id: r.id,
      handle: r.user.instagramHandle ?? r.user.username ?? "creator",
      date: (r.socialPostPostedAt ?? r.createdAt).toISOString().slice(0, 10),
      postedAt: r.socialPostPostedAt ?? r.createdAt,
      likes: r.socialPostLikes ?? 0,
      verdict: r.verdict ?? "unknown",
      text: r.excerpt ?? (r.socialPostCaption ?? "").slice(0, 400),
      dishes: r.dishes,
    }))
    .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime() || b.likes - a.likes)
    .slice(0, ENGINE.summarize.mentions);

  const inputHash = createHash("sha1")
    .update(JSON.stringify(mentions.map((m) => [m.id, m.text, m.verdict])))
    .digest("hex");
  const last = await prisma.engineStep.findFirst({
    where: { stage: "summarize", status: "completed", run: { placeId } },
    orderBy: { startedAt: "desc" },
    select: { output: true },
  });
  if ((last?.output as { inputHash?: string } | null)?.inputHash === inputHash) {
    return { output: { skipped: true, reason: "mentions unchanged", inputHash }, status: "skipped" };
  }

  const dishCounts = countDishes(reviews.map((r) => ({ dishes: r.dishes, postedAt: r.socialPostPostedAt ?? r.createdAt })));
  const verdicts = (place.verdictCounts ?? {}) as Record<string, number>;
  const types = (Array.isArray(place.types) ? place.types : []) as string[];
  const version = await activeVersion("summarize");
  const message = [
    `<place>`,
    `${place.name} · ${types.filter((t) => t !== "point_of_interest" && t !== "establishment").slice(0, 4).join(", ")}`,
    `Price: ${formatPriceLevel(place.priceLevel) ?? "unknown"} · Area: ${[place.neighborhood, place.locality].filter(Boolean).join(", ") || "unknown"}`,
    `</place>`,
    ``,
    `<verdicts>`,
    `loved ${verdicts.loved ?? 0} · liked ${verdicts.liked ?? 0} · mixed ${verdicts.mixed ?? 0} · disliked ${verdicts.disliked ?? 0}`,
    `</verdicts>`,
    ``,
    `<dishes>`,
    dishCounts.length ? dishCounts.slice(0, 15).map((d) => `- ${d.name} (${d.count})`).join("\n") : "(no dishes named)",
    `</dishes>`,
    ``,
    `<mentions>`,
    mentions.map((m) => `- @${m.handle} · ${m.date} · ${m.verdict}: "${m.text}"`).join("\n"),
    `</mentions>`,
  ].join("\n");

  const res = await callStructured({
    model: version.model,
    system: version.systemPrompt,
    schema: summarizeSchema,
    effort: version.effort,
    maxTokens: version.maxTokens,
    messages: [{ role: "user", content: message }],
  });

  // Gate: known-for dishes come from the list; anything else is dropped.
  const byKey = new Map(dishCounts.map((d) => [dishKey(d.name), d]));
  const knownFor: KnownForDish[] = [];
  const droppedKnownFor: string[] = [];
  for (const name of res.output.knownFor) {
    const hit = byKey.get(dishKey(name));
    if (hit && !knownFor.includes(hit) && knownFor.length < ENGINE.summarize.knownFor) knownFor.push(hit);
    else droppedKnownFor.push(name);
  }

  await setPlaceSummary(placeId, { summary: res.output.summary, knownFor }, { runId, actor: "summarize" });
  return {
    output: { skipped: false, inputHash, summary: res.output.summary, knownFor, droppedKnownFor },
    usage: [res],
    agentVersionId: version.id,
  };
}
