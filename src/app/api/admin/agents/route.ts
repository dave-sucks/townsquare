import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

/** Each agent with its active version and the last 7 days of calls and cost. */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const [agents, stats] = await Promise.all([
    prisma.agent.findMany({
      orderBy: { key: "asc" },
      include: {
        activeVersion: { select: { id: true, version: true, model: true, effort: true } },
        _count: { select: { versions: true } },
      },
    }),
    prisma.$queryRaw<{ agent_key: string; calls: number; cost: number; failed: number }[]>(Prisma.sql`
      SELECT v.agent_key, count(*)::int AS calls, coalesce(sum(s.cost_usd), 0)::float AS cost,
             (count(*) FILTER (WHERE s.status = 'failed'))::int AS failed
        FROM engine_steps s JOIN agent_versions v ON v.id = s.agent_version_id
       WHERE s.started_at > now() - interval '7 days'
       GROUP BY v.agent_key`),
  ]);
  const byKey = new Map(stats.map((s) => [s.agent_key, s]));
  const order = ["read", "resolve", "tag", "summarize"];
  return NextResponse.json({
    agents: agents
      .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
      .map((a) => ({
        key: a.key,
        name: a.name,
        description: a.description,
        activeVersion: a.activeVersion,
        versions: a._count.versions,
        calls7d: byKey.get(a.key)?.calls ?? 0,
        cost7d: byKey.get(a.key)?.cost ?? 0,
        failed7d: byKey.get(a.key)?.failed ?? 0,
      })),
  });
}
