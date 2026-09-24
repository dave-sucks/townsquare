"use client";

/**
 * Chat thread — ported from Hindsight components/assistant-ui/thread.tsx.
 *
 * Kept: the assistant-ui primitives, turnAnchor="top", the sticky
 * ViewportFooter mask, scroll-to-bottom, welcome, message components.
 * Changed for townsquare: the thread lives in a 22rem floating panel (and
 * the mobile bottom sheet), so it runs full-width at a tighter gutter; the
 * composer is the trimmed Composer; no attachments.
 *
 * Assistant parts render through Unstable_PartsGrouped: runs of reasoning
 * and quiet tool steps collapse into one chain-of-thought trace
 * (chain-of-thought.tsx); prose and loud results (place lists, questions)
 * render between traces.
 */

import { CitationPill, CitedMarkdownText } from "@/components/chat/cited-markdown-text";
import { HiddenToolRow, WebSearchRow } from "@/components/chat/web-search-row";
import { ToolPart } from "@/components/chat/tool-call-row";
import { TraceGroup, makeGroupingFunction } from "@/components/chat/chain-of-thought";
import { ToolDedupeProvider, useToolDedupeCursor } from "@/components/chat/tool-dedupe-context";
import { TooltipIconButton } from "@/components/chat/tooltip-icon-button";
import {
  SourcesProvider,
  extractSourcesFromParts,
} from "@/components/chat/message-sources-context";
import { Reasoning } from "@/components/chat/reasoning";
import { Composer } from "@/components/chat/composer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ActionBarPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useMessage,
  useMessagePartReasoning,
} from "@assistant-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Copy01Icon,
  RefreshIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { type FC, useMemo } from "react";

export interface WelcomeConfig {
  /** Main heading */
  title: string;
  /** Subtitle / description */
  subtitle: string;
  /** Optional icon to render above the title */
  icon?: React.ReactNode;
  /** Prompts shown under the welcome; clicking one sends it. */
  suggestions?: { title: string; prompt: string }[];
}

export interface ThreadProps {
  /** Hide the welcome message */
  hideWelcome?: boolean;
  /** Customize the welcome message (title, subtitle, icon, suggestions) */
  welcomeConfig?: WelcomeConfig;
}

export const Thread: FC<ThreadProps> = ({ hideWelcome = false, welcomeConfig }) => {
  return (
    <ToolDedupeProvider>
    <ThreadPrimitive.Root
      // No bg here on purpose — inherit the panel's surface.
      className="aui-root aui-thread-root @container flex h-full flex-col"
      style={{
        // The panel is 22rem wide (and phone-width on mobile): let messages
        // use all of it rather than centering a 48rem column.
        ["--thread-max-width" as string]: "100%",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-hidden overflow-y-scroll scroll-smooth px-3 pt-3"
      >
        {!hideWelcome && (
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <ThreadWelcome config={welcomeConfig} />
          </AuiIf>
        )}

        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            EditComposer,
            AssistantMessage,
          }}
        />

        {/* Must be a SOLID color — it masks messages scrolling under the
            sticky composer, so bg-inherit/transparent would let them bleed
            through. bg-background matches the panel surface. */}
        <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mx-auto mt-auto flex w-full flex-col gap-3 overflow-visible bg-background pt-2 pb-3">
          <ThreadScrollToBottom />
          <Composer />
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
    </ToolDedupeProvider>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom absolute -top-10 z-10 self-center rounded-full bg-background p-4 disabled:invisible"
      >
        <HugeiconsIcon icon={ArrowDown01Icon} />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC<{ config?: WelcomeConfig }> = ({ config }) => {
  return (
    <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-(--thread-max-width) grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex size-full flex-col justify-center px-1">
          {config?.icon && (
            <div className="fade-in slide-in-from-bottom-1 animate-in fill-mode-both mb-3 duration-200">
              {config.icon}
            </div>
          )}
          <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both font-brand font-semibold text-xl duration-200">
            {config?.title ?? "Hello there!"}
          </h1>
          <p className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-muted-foreground text-sm delay-75 duration-200">
            {config?.subtitle ?? "How can I help you today?"}
          </p>
        </div>
      </div>
      {config?.suggestions && config.suggestions.length > 0 && (
        <div className="aui-thread-welcome-suggestions flex flex-col gap-1.5 pb-3">
          {config.suggestions.map((s, i) => (
            <ThreadPrimitive.Suggestion key={s.prompt} prompt={s.prompt} send asChild>
              <Button
                variant="outline"
                className="fade-in slide-in-from-bottom-2 animate-in fill-mode-both h-auto justify-start whitespace-normal rounded-xl px-3 py-2 text-left font-normal duration-200"
                style={{ animationDelay: `${100 + i * 40}ms` }}
              >
                {s.title}
              </Button>
            </ThreadPrimitive.Suggestion>
          ))}
        </div>
      )}
    </div>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const ReasoningPart: FC = () => {
  const { text, status } = useMessagePartReasoning();
  const isStreaming = status.type === "running";
  // Thinking whose summary was omitted has no text to show once it's done.
  if (!text && !isStreaming) return null;
  return <Reasoning isStreaming={isStreaming}>{text}</Reasoning>;
};

const AssistantMessage: FC = () => {
  // Numbered sources for this message's [N] citation markers.
  const content = useMessage((m) => m.content);
  const sources = useMemo(
    () =>
      extractSourcesFromParts(
        (content ?? []) as unknown as ReadonlyArray<{ type: string; [key: string]: unknown }>,
      ),
    [content],
  );
  const dedupeCursor = useToolDedupeCursor();
  // A fresh function each render: the cursor is reset per thread render and
  // must be re-read in message order, so this can't be memoized away.
  const groupingFunction = makeGroupingFunction(dedupeCursor);

  return (
    <MessagePrimitive.Root
      className="aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-(--thread-max-width) animate-in py-2 duration-150 group"
      data-role="assistant"
    >
      <div className="min-w-0">
        <div className="aui-assistant-message-content wrap-break-word text-foreground text-message">
          <SourcesProvider sources={sources}>
            <PendingIndicator />
            <MessagePrimitive.Unstable_PartsGrouped
              groupingFunction={groupingFunction}
              components={{
                Text: CitedMarkdownText,
                Reasoning: ReasoningPart,
                tools: {
                  by_name: { web_search: WebSearchRow, code_execution: HiddenToolRow },
                  Fallback: ToolPart,
                },
                Group: TraceGroup,
              }}
            />
            <UncitedSources sources={sources} content={content} />
          </SourcesProvider>
          <MessageError />
        </div>

        <div className="aui-assistant-message-footer mt-1 flex min-h-6 items-center opacity-0 transition-opacity group-hover:opacity-100">
          <BranchPicker />
          <AssistantActionBar />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

/** Before the first part arrives, a shimmer so the send doesn't look dead. */
const PendingIndicator: FC = () => {
  const waiting = useMessage((m) => m.status?.type === "running" && m.content.length === 0);
  if (!waiting) return null;
  return (
    <div className="my-1 flex items-center gap-2 py-1">
      <span className="shimmer-text text-[13px] font-medium">Thinking</span>
    </div>
  );
};

/**
 * Web answers don't always come back with citation spans (web_search_20260209
 * often answers from filtered results without them), so there are no [N]
 * markers to hang pills on. When a message has web sources but no markers,
 * show one pill with all of them after the answer.
 */
const UncitedSources: FC<{
  sources: ReturnType<typeof extractSourcesFromParts>;
  content: ReadonlyArray<unknown> | undefined;
}> = ({ sources, content }) => {
  const hasMarkers = useMemo(
    () =>
      (content ?? []).some((p) => {
        const part = p as { type?: string; text?: string };
        return part.type === "text" && typeof part.text === "string" && /\[\d+\]/.test(part.text);
      }),
    [content],
  );
  const isRunning = useMessage((m) => m.status?.type === "running");
  if (isRunning || hasMarkers || sources.length === 0) return null;
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>Sources</span>
      <CitationPill sources={sources} />
    </div>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      className="aui-assistant-action-bar-root -ml-1 flex gap-1 text-muted-foreground"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <AuiIf condition={(s) => s.message.isCopied}>
            <HugeiconsIcon icon={Tick02Icon} />
          </AuiIf>
          <AuiIf condition={(s) => !s.message.isCopied}>
            <HugeiconsIcon icon={Copy01Icon} />
          </AuiIf>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Retry">
          <HugeiconsIcon icon={RefreshIcon} />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      className="aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto grid w-full max-w-(--thread-max-width) animate-in auto-rows-auto grid-cols-[minmax(48px,1fr)_auto] content-start gap-y-2 py-2 duration-150 [&:where(>*)]:col-start-2"
      data-role="user"
    >
      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content wrap-break-word rounded-2xl bg-muted px-3.5 py-2 text-foreground text-message">
          <MessagePrimitive.Parts />
        </div>
      </div>

      <BranchPicker className="aui-user-branch-picker col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
    </MessagePrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root className="aui-edit-composer-wrapper mx-auto flex w-full max-w-(--thread-max-width) flex-col py-2">
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-[85%] flex-col rounded-2xl bg-muted">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input min-h-14 w-full resize-none bg-transparent p-3.5 text-foreground text-base outline-none md:text-sm"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm">
              Update
            </Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root mr-2 -ml-2 inline-flex items-center text-muted-foreground text-xs",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <HugeiconsIcon icon={ArrowLeft01Icon} />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium tabular-nums">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <HugeiconsIcon icon={ArrowRight01Icon} />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
