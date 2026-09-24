"use client";

import { createContext, useContext } from "react";

export type SourceChipData = {
  provider: string;
  title: string;
  url?: string;
  excerpt?: string;
};

const SourcesContext = createContext<SourceChipData[]>([]);

export function SourcesProvider({
  sources,
  children,
}: {
  sources: SourceChipData[];
  children: React.ReactNode;
}) {
  return (
    <SourcesContext.Provider value={sources}>
      {children}
    </SourcesContext.Provider>
  );
}

export function useSources(): SourceChipData[] {
  return useContext(SourcesContext);
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * The numbered source list a message's [N] markers point into.
 *
 * Web-search sources arrive as `source` parts (url). They are numbered by
 * distinct URL in order of first appearance — the same numbering
 * lib/agent/citations.ts uses when it writes the markers, so "[3]" is the
 * third distinct URL here.
 *
 * Tool results that carry a `sources` array (the ToolResult envelope) are
 * appended after, deduped by URL, for the tool rows' source chips.
 */
export function extractSourcesFromParts(
  parts: ReadonlyArray<{ type: string; [key: string]: unknown }>,
): SourceChipData[] {
  const all: SourceChipData[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    if (part.type !== "source" || part.sourceType !== "url") continue;
    const url = part.url;
    if (typeof url !== "string" || seen.has(url)) continue;
    seen.add(url);
    all.push({
      provider: hostname(url),
      title: typeof part.title === "string" && part.title ? part.title : hostname(url),
      url,
    });
  }

  for (const part of parts) {
    if (part.type !== "tool-call") continue;
    // AI SDK v6 streams tool outputs under `output`; assistant-ui exposes `result`.
    const raw = part.result ?? part.output;
    if (!raw || typeof raw !== "object") continue;
    const sources = (raw as Record<string, unknown>).sources;
    if (!Array.isArray(sources)) continue;
    for (const s of sources) {
      if (typeof s !== "object" || s === null || !("provider" in s) || !("title" in s)) continue;
      const url = typeof s.url === "string" ? s.url : undefined;
      if (url && seen.has(url)) continue;
      if (url) seen.add(url);
      all.push({
        provider: String(s.provider),
        title: String(s.title),
        url,
        excerpt: typeof (s as { excerpt?: unknown }).excerpt === "string" ? (s as { excerpt: string }).excerpt : undefined,
      });
    }
  }

  return all;
}
