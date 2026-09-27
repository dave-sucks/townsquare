/**
 * The one writer for agent versions: drafts, promotion (which is also how
 * rollback works: promote an older version) and archiving.
 */

import { prisma } from "@/lib/prisma";
import { isEngineModel } from "../pricing";
import { writeAudit } from "./audit";

export type DraftInput = {
  systemPrompt: string;
  model: string;
  effort: string | null;
  maxTokens: number;
  notes?: string | null;
};

const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);

function validate(d: DraftInput) {
  if (!d.systemPrompt.trim()) throw new Error("The prompt is empty");
  if (!isEngineModel(d.model)) throw new Error(`Unknown model ${d.model}`);
  if (d.effort && !EFFORTS.has(d.effort)) throw new Error(`Unknown effort ${d.effort}`);
  if (d.model.startsWith("claude-haiku") && d.effort) throw new Error("Haiku 4.5 doesn't take an effort setting");
  if (!Number.isInteger(d.maxTokens) || d.maxTokens < 100 || d.maxTokens > 32000) throw new Error("Max tokens must be 100–32000");
}

/** Save a draft: a new version, or an edit of an existing draft. */
export async function saveDraft(agentKey: string, input: DraftInput & { versionId?: string }, opts: { actor: string }) {
  validate(input);
  if (input.versionId) {
    const v = await prisma.agentVersion.findUniqueOrThrow({ where: { id: input.versionId } });
    if (v.agentKey !== agentKey) throw new Error("Version belongs to another agent");
    if (v.status !== "draft") throw new Error("Only drafts can be edited; save a new draft instead");
    const updated = await prisma.agentVersion.update({
      where: { id: v.id },
      data: { systemPrompt: input.systemPrompt, model: input.model, effort: input.effort, maxTokens: input.maxTokens, notes: input.notes ?? null },
    });
    await writeAudit({ entity: "agent_version", entityId: v.id, action: "edit", actor: opts.actor });
    return updated;
  }
  const last = await prisma.agentVersion.findFirst({ where: { agentKey }, orderBy: { version: "desc" }, select: { version: true } });
  const created = await prisma.agentVersion.create({
    data: {
      agentKey,
      version: (last?.version ?? 0) + 1,
      systemPrompt: input.systemPrompt,
      model: input.model,
      effort: input.effort,
      maxTokens: input.maxTokens,
      notes: input.notes ?? null,
      status: "draft",
      createdBy: opts.actor,
    },
  });
  await writeAudit({ entity: "agent_version", entityId: created.id, action: "create", actor: opts.actor, note: input.notes });
  return created;
}

/** Make a version the one the pipeline runs. Promoting an older version is a rollback. */
export async function promoteVersion(agentKey: string, versionId: string, opts: { actor: string; note?: string | null }) {
  const [agent, v] = await Promise.all([
    prisma.agent.findUniqueOrThrow({ where: { key: agentKey }, select: { activeVersionId: true } }),
    prisma.agentVersion.findUniqueOrThrow({ where: { id: versionId } }),
  ]);
  if (v.agentKey !== agentKey) throw new Error("Version belongs to another agent");
  await prisma.$transaction([
    ...(agent.activeVersionId && agent.activeVersionId !== versionId
      ? [prisma.agentVersion.update({ where: { id: agent.activeVersionId }, data: { status: "archived" } })]
      : []),
    prisma.agentVersion.update({ where: { id: versionId }, data: { status: "active" } }),
    prisma.agent.update({ where: { key: agentKey }, data: { activeVersionId: versionId } }),
  ]);
  await writeAudit({
    entity: "agent",
    entityId: agentKey,
    action: "promote",
    actor: opts.actor,
    note: opts.note,
    fieldChanges: { activeVersionId: { from: agent.activeVersionId, to: versionId } },
  });
}

export async function archiveVersion(agentKey: string, versionId: string, opts: { actor: string }) {
  const agent = await prisma.agent.findUniqueOrThrow({ where: { key: agentKey }, select: { activeVersionId: true } });
  if (agent.activeVersionId === versionId) throw new Error("Promote another version before archiving the active one");
  await prisma.agentVersion.update({ where: { id: versionId }, data: { status: "archived" } });
  await writeAudit({ entity: "agent_version", entityId: versionId, action: "archive", actor: opts.actor });
}
