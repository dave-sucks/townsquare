"use client";

/**
 * ToolUIRenderer — ui: "tool-ui". The ONE generic renderer (ported in spirit
 * from Hindsight components/agent/renderers/ToolUIRenderer.tsx).
 *
 * Contract: the tool returns `data.items: ToolUIItem[]`. This renders a
 * chain-of-thought step — label, count — whose body lists the items as
 * place / person / generic rows. Steps whose items are part of the answer
 * (creators found, saved places) start open.
 *
 * Also the loading and fallback view for "place-list" results until the
 * place list renderer takes them: data.places become place items.
 */

import type { ToolResult, ToolUIItem } from "@/lib/agent/tool-result";
import type { PlaceRow } from "@/lib/agent/place-row";
import { TraceStep, pastTense } from "@/components/chat/chain-of-thought";
import { TraceItem } from "@/components/chat/trace-items";
import { toolLabel } from "@/lib/agent/tool-labels";

interface Props {
  toolName: string;
  args?: Record<string, unknown>;
  result: Extract<ToolResult, { ok: true }>;
  loading: boolean;
  /** Override the count shown after the label. */
  secondary?: string;
}

function deriveItems(data: unknown, summary: string): ToolUIItem[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.items)) return d.items as ToolUIItem[];
  if (Array.isArray(d.places)) {
    return (d.places as PlaceRow[]).map((p) => ({
      kind: "place" as const,
      placeId: p.placeId,
      googlePlaceId: p.googlePlaceId,
      name: p.name,
      emoji: p.emoji,
      photoRef: p.photoRef,
      text: [p.neighborhood, p.why].filter(Boolean).join(" · "),
    }));
  }
  return summary ? [{ kind: "generic", text: summary }] : [];
}

function countLabel(items: ToolUIItem[]): string | undefined {
  if (items.length === 0) return undefined;
  const kinds = new Set(items.map((i) => i.kind));
  if (kinds.size === 1 && kinds.has("person")) return `${items.length} ${items.length === 1 ? "creator" : "creators"}`;
  if (kinds.size === 1 && kinds.has("place")) return `${items.length} ${items.length === 1 ? "place" : "places"}`;
  return undefined;
}

export function ToolUIRenderer({ toolName, args, result, loading, secondary }: Props) {
  const items = loading ? [] : deriveItems(result.data, result.summary);
  const gerund = result.progressLabel ?? toolLabel(toolName, args);
  const label = loading ? gerund : pastTense(gerund);
  const answerItems = items.some((i) => i.kind !== "generic");

  return (
    <TraceStep
      running={loading}
      label={label}
      secondary={secondary ?? countLabel(items)}
      defaultOpen={answerItems}
    >
      {items.length > 0 ? items.map((it, i) => <TraceItem key={i} item={it} />) : null}
    </TraceStep>
  );
}
