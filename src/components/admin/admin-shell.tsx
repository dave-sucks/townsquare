"use client";

/**
 * The Admin page: one header ("Admin", with the section's actions on the
 * right) and tabs for its sections, laid out like the Feed page. Every
 * admin section renders inside it.
 */

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/layout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminFetch } from "@/components/admin/admin-fetch";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { value: "review", label: "Review", href: "/admin/review" },
  { value: "creators", label: "Creators", href: "/admin/creators" },
  { value: "agents", label: "Agents", href: "/admin/agents" },
] as const;

type ReviewCounts = { total: number };

export function AdminShell({
  actions,
  wide = false,
  children,
}: {
  /** The section's own controls, on the right of the header. */
  actions?: React.ReactNode;
  /** Wider content for two-column sections (an agent's editor and playground). */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  // History pages (a run, the runs list) sit under Admin without a tab of their own.
  const section = SECTIONS.find((s) => pathname.startsWith(s.href))?.value ?? "none";
  // Shares the Review tab's "all" query, so the count costs nothing extra there.
  const { data: review } = useQuery<ReviewCounts>({
    queryKey: ["admin-review", "all"],
    queryFn: () => adminFetch("/api/admin/review"),
  });

  return (
    <AppShell user={user}>
      <PageHeader title="Admin">{actions}</PageHeader>
      <div className={cn("flex-1 overflow-auto p-4 mx-auto w-full pb-20 md:pb-4", wide ? "max-w-6xl" : "max-w-3xl")}>
        <Tabs
          value={section}
          onValueChange={(v) => {
            const next = SECTIONS.find((s) => s.value === v);
            if (next) router.push(next.href);
          }}
        >
          <TabsList className="justify-start" data-testid="tabs-admin">
            {SECTIONS.map((s) => (
              <TabsTrigger key={s.value} value={s.value} data-testid={`tab-admin-${s.value}`}>
                {s.label}
                {s.value === "review" && review?.total ? <span className="ml-1 text-xs text-muted-foreground tabular-nums">{review.total}</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="mt-4">{children}</div>
      </div>
    </AppShell>
  );
}
