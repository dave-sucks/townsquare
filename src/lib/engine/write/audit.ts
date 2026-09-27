/**
 * The audit trail. Only the engine's write/ functions call writeAudit, in
 * the same transaction as the change it records, so every admin or agent
 * write to a post, mention, place, source or tag leaves a row.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type Db = PrismaClient | Prisma.TransactionClient;

export type FieldChanges = Record<string, { from: unknown; to: unknown }>;

/** The fields of `after` whose values differ from `before`. */
export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>): FieldChanges {
  const changes: FieldChanges = {};
  for (const [field, to] of Object.entries(after)) {
    const from = before[field];
    if (JSON.stringify(from ?? null) !== JSON.stringify(to ?? null)) changes[field] = { from: from ?? null, to: to ?? null };
  }
  return changes;
}

export type AuditEntry = {
  entity: string;
  entityId: string;
  action: string;
  fieldChanges?: FieldChanges;
  /** A user id, or an agent key (read, resolve, tag, summarize). */
  actor: string;
  runId?: string | null;
  note?: string | null;
};

export async function writeAudit(entry: AuditEntry, db: Db = prisma) {
  return db.auditLog.create({
    data: {
      entity: entry.entity,
      entityId: entry.entityId,
      action: entry.action,
      fieldChanges: (entry.fieldChanges ?? undefined) as Prisma.InputJsonValue | undefined,
      actor: entry.actor,
      runId: entry.runId ?? null,
      note: entry.note ?? null,
    },
  });
}
