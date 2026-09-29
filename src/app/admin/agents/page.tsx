"use client";

/**
 * Agents: the four prompts the pipeline runs, each with its active version,
 * model, the last 7 days of calls and cost, and live precision (how often a
 * person who checked its output confirmed it).
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiBrain01Icon } from "@hugeicons/core-free-icons";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { adminFetch } from "@/components/admin/admin-fetch";
import { formatCost, shortModel } from "@/components/admin/run-format";

type AgentRow = {
  key: string;
  name: string;
  description: string | null;
  activeVersion: { id: string; version: number; model: string; effort: string | null } | null;
  versions: number;
  calls7d: number;
  cost7d: number;
  failed7d: number;
  confirmed30d: number;
  corrected30d: number;
};

function precision(a: AgentRow) {
  const checked = a.confirmed30d + a.corrected30d;
  if (checked === 0) return "not checked yet";
  return `${Math.round((a.confirmed30d / checked) * 100)}% right (${checked} checked)`;
}

export default function AgentsPage() {
  const { data, isLoading } = useQuery<{ agents: AgentRow[] }>({
    queryKey: ["admin-agents"],
    queryFn: () => adminFetch("/api/admin/agents"),
  });

  return (
    <AdminShell>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">The AI steps that read each post, match its places, tag them and write summaries. Open one to change its prompt and test it before it goes live.</p>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[104px] w-full rounded-xl" />
            ))}
          </div>
        ) : (data?.agents.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <HugeiconsIcon icon={AiBrain01Icon} className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium">No agents</p>
            <p className="text-sm text-muted-foreground mt-1">Seed them with scripts/agents-v1.ts.</p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="list-agents">
            {data!.agents.map((a) => (
              <Link key={a.key} href={`/admin/agents/${a.key}`} className="block">
                <Card className="hover-elevate cursor-pointer" data-testid={`card-agent-${a.key}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{a.name}</p>
                        {a.description && <p className="text-xs text-muted-foreground truncate">{a.description}</p>}
                      </div>
                      <p className="shrink-0 text-sm tabular-nums">
                        {a.activeVersion ? `v${a.activeVersion.version}` : "No active version"}
                        <span className="text-muted-foreground">
                          {a.activeVersion ? ` · ${shortModel(a.activeVersion.model)}${a.activeVersion.effort ? ` · ${a.activeVersion.effort}` : ""}` : ""}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
                      <span>{a.calls7d} calls this week</span>
                      <span>{formatCost(a.cost7d)}</span>
                      {a.failed7d > 0 && <span className="text-red-600">{a.failed7d} failed</span>}
                      <span>{precision(a)}</span>
                      <span>
                        {a.versions} {a.versions === 1 ? "version" : "versions"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
