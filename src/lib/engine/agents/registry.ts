/**
 * Agent versions live in the database (seeded with v1); output schemas live
 * in code. Every step records the version it ran.
 */

import { prisma } from "@/lib/prisma";
import type { Effort } from "../llm";

export type AgentKey = "read" | "resolve" | "tag" | "summarize";

export type AgentVersionConfig = {
  id: string;
  agentKey: AgentKey;
  version: number;
  systemPrompt: string;
  model: string;
  effort: Effort | null;
  maxTokens: number;
};

const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);

function toConfig(v: {
  id: string;
  agentKey: string;
  version: number;
  systemPrompt: string;
  model: string;
  effort: string | null;
  maxTokens: number;
}): AgentVersionConfig {
  return {
    id: v.id,
    agentKey: v.agentKey as AgentKey,
    version: v.version,
    systemPrompt: v.systemPrompt,
    model: v.model,
    effort: v.effort && EFFORTS.has(v.effort) ? (v.effort as Effort) : null,
    maxTokens: v.maxTokens,
  };
}

export async function activeVersion(agentKey: AgentKey): Promise<AgentVersionConfig> {
  const agent = await prisma.agent.findUnique({
    where: { key: agentKey },
    select: { activeVersion: true },
  });
  if (!agent?.activeVersion) throw new Error(`Agent ${agentKey} has no active version (is the v1 seed applied?)`);
  return toConfig(agent.activeVersion);
}

export async function versionById(id: string): Promise<AgentVersionConfig> {
  const v = await prisma.agentVersion.findUnique({ where: { id } });
  if (!v) throw new Error(`Agent version ${id} not found`);
  return toConfig(v);
}
