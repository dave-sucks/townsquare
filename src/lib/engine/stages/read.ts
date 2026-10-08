/**
 * Stage 4, Read (agent): which places a post is about, with an excerpt,
 * dishes, verdict and score for each. Gates check what code can check; a
 * failed gate goes back to the model once with the exact reason.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { callStructured, type LlmUsage } from "../llm";
import { activeVersion } from "../agents/registry";
import { buildReadContext, type ReadFacts } from "../agents/read/context";
import { readSchema, type ReadOutput, type ReadPlace } from "../agents/read/schema";
import { CONFIDENCE_VALUE, ENGINE } from "../config";
import { selectExamples } from "../examples";
import { dismissOpenItems, openReviewItem } from "../review";
import { parseScore } from "../text";
import { latestReviewerNote, setPostReading } from "../write/posts";
import type { StepResult } from "../write/runs";
import type { StageOptions } from "./options";
import { checkRead, repairPlaces } from "./read-gates";

export type ReadPlaceResult = ReadPlace & {
  index: number;
  scoreValue: number | null;
  scoreOutOf: number | null;
  confidenceValue: number;
};

export type ReadResult = {
  postType: ReadOutput["postType"];
  sponsored: boolean;
  notPlaceReason: string | null;
  places: ReadPlaceResult[];
  locationName: string | null;
  taggedAccounts: string[];
  /** The model was sent back once because a gate failed. */
  retried: boolean;
  /** What the first answer got wrong, when it was sent back. */
  retryReasons: string[];
  /** Gate failures still standing after the retry (the fields that broke them were cleared). */
  gateFailures: string[];
};

export async function runRead(runId: string, postId: string, opts: StageOptions = {}): Promise<StepResult<ReadResult>> {
  const post = await prisma.ingestedPost.findUniqueOrThrow({
    where: { id: postId },
    select: {
      id: true,
      caption: true,
      postedAt: true,
      rawPayload: true,
      authorHandle: true,
      sourceId: true,
      postType: true,
      source: { select: { handle: true, homeCity: true, notes: true } },
    },
  });
  const version = opts.version ?? (await activeVersion("read"));
  const examples = await selectExamples({
    agentKey: "read",
    sourceId: post.sourceId,
    postType: post.postType,
    excludePostId: post.id,
    limit: ENGINE.read.examples,
  });
  const { text, facts } = buildReadContext({
    handle: post.source?.handle ?? post.authorHandle,
    homeCity: post.source?.homeCity ?? null,
    notes: post.source?.notes ?? null,
    caption: post.caption,
    postedAt: post.postedAt,
    raw: post.rawPayload,
    examples,
    reviewerNote: await latestReviewerNote(post.id),
  });

  const usage: LlmUsage[] = [];
  const call = async (messages: Anthropic.MessageParam[]) => {
    const res = await callStructured({
      model: version.model,
      system: version.systemPrompt,
      messages,
      schema: readSchema,
      effort: version.effort,
      maxTokens: version.maxTokens,
    });
    usage.push(res);
    return res;
  };

  const first: Anthropic.MessageParam = { role: "user", content: text };
  let res = await call([first]);
  let out = res.output;
  let failures = checkRead(out, facts);
  let retried = false;
  const retryReasons = failures.map((f) => f.message);
  if (failures.length > 0) {
    retried = true;
    res = await call([
      first,
      { role: "assistant", content: res.rawText },
      {
        role: "user",
        content: `Parts of that answer break the rules:\n${failures.map((f) => `- ${f.message}`).join("\n")}\n\nReturn the whole answer again with those fixed.`,
      },
    ]);
    out = res.output;
    failures = checkRead(out, facts);
  }

  // Whatever still fails goes to a person; the place keeps its name and loses the field that broke the rule.
  const kept = repairPlaces(out, failures);

  const places: ReadPlaceResult[] = kept.map((p, index) => {
    const score = parseScore(p.score);
    return {
      ...p,
      taggedAccount: p.taggedAccount ? p.taggedAccount.replace(/^@/, "").trim().toLowerCase() : null,
      index,
      scoreValue: score?.value ?? null,
      scoreOutOf: score?.outOf ?? null,
      confidenceValue: CONFIDENCE_VALUE[p.confidence],
    };
  });

  if (!opts.dryRun) await dismissOpenItems(post.id, ["fix_extraction", "check_not_a_place", "confirm_place"], "the post was read again");
  if (!opts.dryRun && failures.length > 0) {
    await openReviewItem({
      kind: "fix_extraction",
      postId: post.id,
      runId,
      question: "Couldn't read this post cleanly. Check its places.",
      payload: { failures: failures.map((f) => f.message), output: out },
      priority: 1,
    });
  }
  if (!opts.dryRun && out.postType === "not_a_place" && facts.locationName) {
    await openReviewItem({
      kind: "check_not_a_place",
      postId: post.id,
      runId,
      question: `Not about a place? It's tagged at "${facts.locationName}".`,
      payload: { reason: out.notPlaceReason, locationName: facts.locationName },
    });
  }

  if (!opts.dryRun) await setPostReading(post.id, { postType: out.postType, sponsored: out.sponsored }, runId);

  return {
    output: {
      postType: out.postType,
      sponsored: out.sponsored,
      notPlaceReason: out.notPlaceReason,
      places,
      locationName: facts.locationName,
      taggedAccounts: facts.taggedAccounts,
      retried,
      retryReasons,
      gateFailures: failures.map((f) => f.message),
    },
    usage,
    agentVersionId: version.id,
  };
}
