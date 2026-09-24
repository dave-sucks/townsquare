"use client";

/**
 * Row for Anthropic's server-side web_search tool, as a ThinkingTrace
 * (Beautiful UI "Thinking", search variant): "Searching the web" shimmers
 * while it runs, then "Searched the web · N results" with the query and
 * linked results in the trace.
 *
 * Server-tool errors don't throw — they come back as a result object with an
 * error code — so an error result renders as a muted "Web search
 * unavailable" line instead of a result list.
 */

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { GlobeIcon, ThinkingTrace, type TraceRow } from "@/components/chat/thinking-trace";

type SearchResult = { url: string; title?: string; pageAge?: string | null };

const MAX_ROWS = 5;

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function favicon(url: string): string | null {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
  } catch {
    return null;
  }
}

function isResultList(v: unknown): v is SearchResult[] {
  return Array.isArray(v) && v.every((r) => r && typeof r === "object" && typeof (r as SearchResult).url === "string");
}

export const WebSearchRow: ToolCallMessagePartComponent<{ query?: string }> = ({ args, result, status }) => {
  const query = typeof args?.query === "string" ? args.query : "";
  const running = status?.type === "running";
  const results = isResultList(result) ? result : null;
  const failed = !running && (status?.type === "incomplete" || (result !== undefined && !results));

  if (failed) {
    return (
      <ThinkingTrace
        working={false}
        activeLabel=""
        doneLabel={`Web search unavailable${query ? ` for "${query}"` : ""}`}
        icon={<GlobeIcon />}
      />
    );
  }

  const rows: TraceRow[] = (results ?? []).slice(0, MAX_ROWS).map((r) => {
    const src = favicon(r.url);
    return {
      primary: r.title || hostname(r.url),
      secondary: hostname(r.url),
      href: r.url,
      leading: src ? (
        <img src={src} alt="" width={14} height={14} className="size-3.5 shrink-0 rounded-full" />
      ) : undefined,
    };
  });

  return (
    <ThinkingTrace
      working={running || !results}
      activeLabel="Searching the web"
      doneLabel={results ? `Searched the web · ${results.length} results` : "Searched the web"}
      icon={<GlobeIcon />}
      query={query || undefined}
      rows={rows}
      moreCount={results ? Math.max(0, results.length - MAX_ROWS) : 0}
    />
  );
};

/**
 * web_search_20260209 filters results with code execution on Anthropic's
 * side; those calls arrive as provider-executed `code_execution` parts with
 * encrypted output. They're plumbing, not something to show.
 */
export const HiddenToolRow: ToolCallMessagePartComponent = () => null;
