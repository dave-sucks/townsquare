"use client";

/**
 * Chain of thought — consecutive "quiet" parts of an assistant message
 * (reasoning, web searches, generic tool steps) collapse into ONE trace in
 * Beautiful UI's "Thinking" style; "loud" parts (the place list, a question)
 * and prose break out of it.
 *
 * Wiring: AssistantMessage renders MessagePrimitive.Unstable_PartsGrouped
 * with makeGroupingFunction() and <TraceGroup> as its Group component. Part
 * components render as TraceSteps when useInTrace() is true.
 *
 * Replaces Hindsight's ToolGroup/ToolCallGroup: its groupId phases and
 * "(+N more)" header survive here as one trace per run of quiet parts, and a
 * tool call identical to the previous one (in this message, or the last call
 * of the assistant message right before it) is still skipped.
 *
 * That cross-message check is a pure lookup of the previous message
 * (lastToolKey), not Hindsight's render-order cursor. The cursor was reset
 * only when the whole Thread re-rendered; while a message streams, only
 * that message re-renders, so its second pass compared its first tool call
 * against its own last one and a single-call message deduped itself out of
 * existence. Seen 2026-09-23: the place list vanished mid-stream.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMessage } from "@assistant-ui/react";
import { normalizeToolResult, inferToolUI } from "@/lib/agent/tool-result";
import { toolLabel } from "@/lib/agent/tool-labels";
import { SparkleIcon } from "@/components/chat/thinking-trace";
import { cn } from "@/lib/utils";

// ── Grouping ────────────────────────────────────────────────────────────────

type ContentPart = {
  type: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  status?: { type: string };
};

/** Tool calls that are plumbing — part of a trace, never shown. */
export const HIDDEN_TOOLS = new Set(["code_execution"]);

function isLoudToolPart(part: ContentPart): boolean {
  if (part.type !== "tool-call" || !part.toolName) return false;
  const ui =
    part.result != null ? normalizeToolResult(part.toolName, part.result) : null;
  const kind = ui ? (ui.ok ? ui.ui : "tool-ui") : inferToolUI(part.toolName);
  // A search that came back empty is a step in the thinking, not an answer.
  if (kind === "place-list" && ui?.ok && isEmptyPlaceList(ui.data)) return false;
  return kind === "place-list" || kind === "ask-question";
}

export function isEmptyPlaceList(data: unknown): boolean {
  const places = (data as { places?: unknown[] } | null)?.places;
  return Array.isArray(places) && places.length === 0;
}

function isQuietPart(part: ContentPart): boolean {
  if (part.type === "reasoning") return true;
  if (part.type === "tool-call") return !isLoudToolPart(part);
  return false;
}

type Group = { groupKey: string | undefined; indices: number[] };

/** `toolName::JSON(args)` for a visible tool-call part, else null. */
export function toolCallKey(part: unknown): string | null {
  const p = part as ContentPart;
  if (p?.type !== "tool-call" || !p.toolName || HIDDEN_TOOLS.has(p.toolName)) return null;
  try {
    return `${p.toolName}::${JSON.stringify(p.args ?? {})}`;
  } catch {
    return p.toolName;
  }
}

/** The key of the last visible tool call in a message's parts. */
export function lastToolKey(parts: readonly unknown[] | undefined): string | null {
  if (!parts) return null;
  for (let i = parts.length - 1; i >= 0; i--) {
    const k = toolCallKey(parts[i]);
    if (k) return k;
  }
  return null;
}

/**
 * Runs of quiet parts → one "trace-N" group each; every other part (text,
 * loud tools) → its own ungrouped entry, in order. A tool call with the same
 * name + args as the previous one — in this message, or `prevMessageKey`
 * (the last call of the assistant message before this one) — is dropped.
 * Pure: same parts + same key → same groups, however often it runs.
 */
export function makeGroupingFunction(prevMessageKey: string | null) {
  return (parts: readonly unknown[]): Group[] => {
    const groups: Group[] = [];
    let trace: Group | null = null;
    let traces = 0;
    let prevKey = prevMessageKey;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] as ContentPart;

      const key = toolCallKey(part);
      if (key) {
        if (key === prevKey) continue;
        prevKey = key;
      }

      // Source parts render nothing (they feed the citation list). They
      // arrive between a search and the thinking after it, so they must not
      // split the trace.
      if (part.type === "source") continue;

      if (isQuietPart(part)) {
        if (!trace) {
          trace = { groupKey: `trace-${traces++}`, indices: [] };
          groups.push(trace);
        }
        trace.indices.push(i);
      } else {
        trace = null;
        groups.push({ groupKey: undefined, indices: [i] });
      }
    }
    return groups;
  };
}

// ── Trace context ───────────────────────────────────────────────────────────

const TraceContext = createContext(false);
export const useInTrace = () => useContext(TraceContext);

// ── Past tense for the settled header ───────────────────────────────────────

const PAST: Record<string, string> = {
  Finding: "Found",
  Searching: "Searched",
  Checking: "Checked",
  Reading: "Read",
  Opening: "Opened",
  Looking: "Looked",
  Saving: "Saved",
  Adding: "Added",
  Marking: "Marked",
  Asking: "Asked",
};

export function pastTense(label: string): string {
  const [first, ...rest] = label.split(" ");
  const past = PAST[first];
  return past ? [past, ...rest].join(" ") : label;
}

// ── TraceGroup (the Group component) ────────────────────────────────────────

export function TraceGroup({
  groupKey,
  indices,
  children,
}: {
  groupKey: string | undefined;
  indices: number[];
  children?: ReactNode;
}) {
  if (!groupKey?.startsWith("trace-")) return <>{children}</>;
  return <Trace indices={indices}>{children}</Trace>;
}

function Trace({ indices, children }: { indices: number[]; children?: ReactNode }) {
  const content = useMessage((m) => m.content) as unknown as ContentPart[];
  const messageRunning = useMessage((m) => m.status?.type === "running");
  const isLastGroup = useMessage((m) => indices[indices.length - 1] === m.content.length - 1);

  const { steps, label, working, hasItems } = useMemo(() => {
    const parts = indices.map((i) => content[i]).filter(Boolean);
    const toolParts = parts.filter(
      (p) => p.type === "tool-call" && p.toolName && !HIDDEN_TOOLS.has(p.toolName),
    );
    const pending = toolParts.some((p) => p.result === undefined);
    const working = messageRunning && (pending || isLastGroup);
    const last = [...parts].reverse().find(
      (p) => p.type === "reasoning" || (p.type === "tool-call" && p.toolName && !HIDDEN_TOOLS.has(p.toolName)),
    );
    const activeLabel =
      last?.type === "tool-call" && last.toolName && last.result === undefined
        ? toolLabel(last.toolName, last.args)
        : "Thinking";
    const labels = toolParts.map((p) => {
      const r = p.result != null ? normalizeToolResult(p.toolName!, p.result) : null;
      return r?.ok && r.progressLabel ? r.progressLabel : toolLabel(p.toolName!, p.args);
    });
    const hasItems = toolParts.some((p) => {
      if (p.toolName === "web_search" || p.result == null) return false;
      const r = normalizeToolResult(p.toolName!, p.result);
      const items = r.ok ? (r.data as { items?: unknown[] } | null)?.items : undefined;
      return Array.isArray(items) && items.length > 0;
    });
    return {
      steps: labels,
      label: working ? activeLabel : null,
      working,
      hasItems,
    };
  }, [content, indices, messageRunning, isLastGroup]);

  // Measure thinking time when we watch it happen; replays don't know it.
  const startedAt = useRef<number | null>(working ? Date.now() : null);
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (working && startedAt.current == null) startedAt.current = Date.now();
    if (!working && startedAt.current != null && seconds == null) {
      setSeconds(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
    }
  }, [working, seconds]);

  const doneLabel =
    steps.length === 0
      ? seconds != null
        ? `Thought for ${seconds}s`
        : "Thought it through"
      : `${pastTense(steps[0])}${steps.length > 1 ? ` · +${steps.length - 1} more` : ""}`;

  // Beautiful UI's trace settles closed once done — except when a step's
  // items (creators found, saved places) are part of the answer.
  const [manual, setManual] = useState<boolean | null>(null);
  const expanded = manual ?? (working || hasItems);

  return (
    <div className="my-1 flex w-full flex-col">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setManual(!expanded)}
        className="-mx-1.5 flex w-fit max-w-full items-center gap-2 rounded-md px-1.5 py-1 transition-colors duration-100 hover:bg-muted"
      >
        <span className={cn("flex shrink-0", working ? "text-muted-foreground" : "text-muted-foreground/70")}>
          <SparkleIcon />
        </span>
        <span role="status" className="min-w-0 truncate">
          {working ? (
            <span className="shimmer-text text-[13px] font-medium">{label}</span>
          ) : (
            <span className="text-[13px] font-medium text-muted-foreground animate-in fade-in duration-300">
              {doneLabel}
            </span>
          )}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-muted-foreground/70 transition-transform duration-300"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-400"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="relative mt-1 ml-[5px] pl-4">
            <span aria-hidden className="absolute top-0 bottom-1 left-[3px] w-px bg-border" />
            <div className="flex flex-col gap-0.5 py-1">
              <TraceContext.Provider value={true}>{children}</TraceContext.Provider>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TraceStep (one row in a trace) ──────────────────────────────────────────

export function TraceStep({
  icon,
  label,
  secondary,
  running = false,
  failed = false,
  defaultOpen = false,
  children,
}: {
  icon?: ReactNode;
  label: ReactNode;
  secondary?: ReactNode;
  running?: boolean;
  failed?: boolean;
  defaultOpen?: boolean;
  /** Expandable detail (items, results). */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasBody = Boolean(children);
  const lead = running ? (
    <span className="size-3 shrink-0 animate-spin rounded-full border-[1.5px] border-border border-t-muted-foreground" />
  ) : failed ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0 text-muted-foreground/70" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
    </svg>
  ) : (
    icon ?? (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground/70" aria-hidden>
        <path d="M20 6L9 17l-5-5" />
      </svg>
    )
  );

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-1 duration-300">
      <button
        type="button"
        disabled={!hasBody}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-7 w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 text-left transition-colors duration-150 enabled:hover:bg-muted"
      >
        <span className="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground/70">{lead}</span>
        <span className={cn("min-w-0 truncate text-[12.5px] font-medium", running ? "text-foreground" : "text-foreground/90")}>
          {label}
        </span>
        {secondary != null && (
          <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground/70">{secondary}</span>
        )}
        {hasBody && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ml-auto shrink-0 text-muted-foreground/60 transition-transform duration-200"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>
      {hasBody && open && <div className="flex flex-col gap-0.5 pb-1 pl-5">{children}</div>}
    </div>
  );
}
