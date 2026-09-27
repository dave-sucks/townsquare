/**
 * Few-shot selection. Every human decision is saved as an example (Phase 3
 * writes them); agents get up to three: same source first, then same post
 * type, human-confirmed or corrected only, newest first.
 */

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { AgentKey } from "./agents/registry";

export type ExampleRow = { id: string; input: unknown; expected: unknown };

export async function selectExamples(opts: {
  agentKey: AgentKey;
  sourceId?: string | null;
  postType?: string | null;
  excludePostId?: string | null;
  limit: number;
}): Promise<ExampleRow[]> {
  const rows = await prisma.$queryRaw<ExampleRow[]>(Prisma.sql`
    SELECT e.id, e.input, e.expected
      FROM examples e
      LEFT JOIN ingested_posts p ON p.id = e.post_id
     WHERE e.agent_key = ${opts.agentKey}
       AND e.source IN ('human_confirmed', 'human_corrected')
       AND (e.post_id IS NULL OR e.post_id <> ${opts.excludePostId ?? ""})
     ORDER BY (p.source_id IS NOT DISTINCT FROM ${opts.sourceId ?? null}) DESC,
              (p.post_type::text IS NOT DISTINCT FROM ${opts.postType ?? null}) DESC,
              e.created_at DESC
     LIMIT ${opts.limit}`);
  return rows;
}

/** Examples as one <examples> block, or "" when there are none. */
export function renderExamples(rows: ExampleRow[], describe: (row: ExampleRow) => string): string {
  if (rows.length === 0) return "";
  return `<examples>\n${rows.map((r, i) => `Example ${i + 1}:\n${describe(r)}`).join("\n\n")}\n</examples>`;
}

/**
 * Save a person's decision as an example for the agent whose output it
 * confirms or corrects. The next calls of that agent can use it as a
 * few-shot (and, later, as an eval case). The newest decision about a post
 * (or one of its mentions) replaces earlier ones for that agent, so saving a
 * post twice doesn't make it two examples; golden-set examples stay.
 */
export async function saveExample(opts: {
  agentKey: AgentKey;
  postId?: string | null;
  reviewId?: string | null;
  input: unknown;
  expected: unknown;
  source: "human_confirmed" | "human_corrected";
  note?: string | null;
  createdBy: string;
}) {
  if (opts.postId) {
    await prisma.example.deleteMany({
      where: { agentKey: opts.agentKey, postId: opts.postId, reviewId: opts.reviewId ?? null, inGoldenSet: false },
    });
  }
  return prisma.example.create({
    data: {
      agentKey: opts.agentKey,
      postId: opts.postId ?? null,
      reviewId: opts.reviewId ?? null,
      input: JSON.parse(JSON.stringify(opts.input ?? {})),
      expected: JSON.parse(JSON.stringify(opts.expected ?? {})),
      source: opts.source,
      note: opts.note ?? null,
      createdBy: opts.createdBy,
    },
    select: { id: true },
  });
}
