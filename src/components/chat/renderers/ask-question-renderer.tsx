"use client";

/**
 * AskQuestionRenderer — ported from Hindsight
 * components/agent/renderers/AskQuestionRenderer.tsx. Renders an
 * ask_question tool call using the
 * Tool-UI Question Flow library (https://www.tool-ui.com/docs/question-flow).
 *
 * Two emit shapes from the tool, dispatched here:
 *
 *  - **Progressive** (single question) → one quick-reply card, no step label.
 *  - **Upfront** (multi-step flow) → one card with "Step N of M" + progress
 *    bar; user answers each step inline; on Complete, all answers come
 *    back as one user message ("Q1: a, b. Q2: c.").
 *
 * After the user submits, we render the Receipt variant showing the
 * finalized choice(s) so the conversation reads cleanly on replay.
 *
 * If parsing fails we fall back to a bare text line — never crash the
 * thread on a malformed tool emission.
 */

import { useMemo, useState } from "react";
import { useAuiState, useThreadRuntime } from "@assistant-ui/react";
import type { ToolResult } from "@/lib/agent/tool-result";
import { QuestionFlow } from "@/components/tool-ui/question-flow";
import { safeParseSerializableQuestionFlow } from "@/components/tool-ui/question-flow/schema";
import type {
  SerializableProgressiveMode,
  SerializableUpfrontMode,
  QuestionFlowSummaryItem,
} from "@/components/tool-ui/question-flow/schema";

interface Props {
  toolName: string;
  result: Extract<ToolResult, { ok: true }>;
  loading: boolean;
}

export function AskQuestionRenderer({ result, loading }: Props) {
  const threadRuntime = useThreadRuntime();
  const [answered, setAnswered] = useState(false);
  const [receiptSummary, setReceiptSummary] = useState<{
    title: string;
    items: QuestionFlowSummaryItem[];
  } | null>(null);

  // Validate the payload against the Question Flow library schema.
  const parsed = useMemo(
    () => safeParseSerializableQuestionFlow(result.data),
    [result.data],
  );

  // Answered before (e.g. a reloaded conversation): the user's reply is the
  // next message in the thread. Show it as the receipt instead of reopening
  // the question.
  const priorAnswer = useAuiState((s) => {
    const msgs = s.thread.messages;
    const i = msgs.findIndex((m) => m.id === s.message.id);
    const next = i >= 0 ? msgs[i + 1] : undefined;
    if (!next || next.role !== "user") return null;
    const parts = (next as unknown as { parts?: readonly { type: string; text?: string }[] }).parts ?? next.content;
    const text = (parts as readonly { type: string; text?: string }[])
      .map((p) => (p.type === "text" ? p.text ?? "" : ""))
      .join(" ")
      .trim();
    return text || null;
  });

  if (loading) {
    return <p className="shimmer-text my-1 text-[13px] font-medium">Asking a quick question</p>;
  }

  if (!parsed) {
    return <p className="text-sm text-muted-foreground">{result.summary}</p>;
  }

  if (priorAnswer && !answered) {
    // Multi-step answers were sent as one "<step title> <answer>" line per
    // step; split them back out so the receipt reads question by question.
    if ("steps" in parsed && Array.isArray(parsed.steps)) {
      const items = (parsed as SerializableUpfrontMode).steps
        .map((step) => {
          const line = priorAnswer.split("\n").find((l) => l.startsWith(step.title));
          return line ? { label: step.title, value: line.slice(step.title.length).trim() } : null;
        })
        .filter((x): x is QuestionFlowSummaryItem => x !== null);
      if (items.length > 0) {
        return <QuestionFlow id={parsed.id} choice={{ title: "Your answers", summary: items }} />;
      }
    }
    const title =
      "title" in parsed && typeof parsed.title === "string" ? parsed.title : "Your answers";
    return (
      <QuestionFlow
        id={parsed.id}
        choice={{ title, summary: [{ label: "Answer", value: priorAnswer }] }}
      />
    );
  }

  // Receipt mode — show the finalized answers post-submit.
  if (answered && receiptSummary) {
    return (
      <QuestionFlow
        id={parsed.id}
        choice={{
          title: receiptSummary.title,
          summary: receiptSummary.items,
        }}
      />
    );
  }

  // ── Upfront (multi-step) mode ─────────────────────────────────────────
  if ("steps" in parsed && Array.isArray(parsed.steps)) {
    const upfront = parsed as SerializableUpfrontMode;

    const handleComplete = (answers: Record<string, string[]>) => {
      if (answered) return;
      const items: QuestionFlowSummaryItem[] = [];
      const messageLines: string[] = [];
      for (const step of upfront.steps) {
        const ids = answers[step.id] ?? [];
        const labels = ids
          .map((id) => step.options.find((o) => o.id === id)?.label)
          .filter((l): l is string => typeof l === "string");
        if (labels.length === 0) continue;
        const value = labels.join(", ");
        items.push({ label: step.title, value });
        messageLines.push(`${step.title} ${value}`);
      }
      if (items.length === 0) return;
      setReceiptSummary({ title: "Your answers", items });
      setAnswered(true);
      threadRuntime.append({
        role: "user",
        content: [{ type: "text", text: messageLines.join("\n") }],
      });
    };

    return (
      <QuestionFlow
        id={upfront.id}
        steps={upfront.steps}
        onComplete={handleComplete}
      />
    );
  }

  // ── Progressive (single-question) mode ────────────────────────────────
  if (!("options" in parsed)) {
    return <p className="text-sm text-muted-foreground">{result.summary}</p>;
  }

  const progressive = parsed as SerializableProgressiveMode;

  const handleSelect = (optionIds: string[]) => {
    if (answered) return;
    const labels = optionIds
      .map((id) => progressive.options.find((o) => o.id === id)?.label)
      .filter((l): l is string => typeof l === "string");
    if (labels.length === 0) return;
    setReceiptSummary({
      title: progressive.title,
      items: [{ label: "Answer", value: labels.join(", ") }],
    });
    setAnswered(true);
    threadRuntime.append({
      role: "user",
      content: [{ type: "text", text: labels.join(", ") }],
    });
  };

  return (
    <QuestionFlow
      id={progressive.id}
      step={progressive.step}
      title={progressive.title}
      description={progressive.description}
      options={progressive.options}
      selectionMode={progressive.selectionMode ?? "single"}
      onSelect={handleSelect}
    />
  );
}
