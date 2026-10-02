"use client";

/**
 * The Admin page: one header that never changes ("Admin") and tabs for its
 * sections. Every admin section renders inside it, and keeps its own
 * controls in its content.
 */

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppShell, ContentContainer, PageHeader } from "@/components/layout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminFetch } from "@/components/admin/admin-fetch";
import { useAuth } from "@/hooks/use-auth";

const SECTIONS = [
  { value: "review", label: "Review", href: "/admin/review" },
  { value: "creators", label: "Creators", href: "/admin/creators" },
  { value: "agents", label: "Agents", href: "/admin/agents" },
  { value: "history", label: "History", href: "/admin/runs" },
] as const;

type ReviewCounts = { total: number };

export function AdminShell({
  wide = false,
  children,
}: {
  /** Wider content for two-column sections (an agent's editor and playground). */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const section = SECTIONS.find((s) => pathname.startsWith(s.href))?.value ?? "none";
  // Shares the Review tab's "all" query, so the count costs nothing extra there.
  const { data: review } = useQuery<ReviewCounts>({
    queryKey: ["admin-review", "all"],
    queryFn: () => adminFetch("/api/admin/review"),
  });

  return (
    <AppShell user={user}>
      <PageHeader title="Admin" />
      <ContentContainer maxWidth={wide ? "xl" : "3xl"}>
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
      </ContentContainer>
    </AppShell>
  );
}
