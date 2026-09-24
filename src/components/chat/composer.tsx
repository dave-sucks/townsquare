"use client";

/**
 * Townsquare chat composer — Beautiful UI's Prompt Bar (beautifului.dev
 * prompt-bar), running on assistant-ui's composer state.
 *
 *   - "@" (typed, or the @ button) opens creator search against
 *     /api/chat/creators. ↑↓ moves, Enter/Tab picks, Esc dismisses. A pick
 *     lands as plain "@username" text; the agent resolves it with get_creator.
 *   - Quick-ask chips stand in for Hindsight's slash commands: wrapped in
 *     the welcome on an empty thread, one scrolling row above the bar after.
 *   - Short drafts sit inline between the controls; once the text wraps it
 *     takes the full row and the controls drop below (the Prompt Bar's
 *     measured layout).
 *
 * Dropped from the Prompt Bar: attachments, model picker, dictation, and
 * the glimm sweep.
 */

import { type FC, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AuiIf, ComposerPrimitive, ThreadPrimitive, useAui, useAuiState } from "@assistant-ui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ArrowUp02Icon,
  AtIcon,
  FavouriteIcon,
  Location01Icon,
  Moon02Icon,
  StopIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import type { MentionCreator } from "@/app/api/chat/creators/route";
import { FallbackImg } from "@/components/chat/trace-items";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/query-client";
import { cn } from "@/lib/utils";

const QUICK_ASKS: { label: string; icon: IconSvgElement; prompt: string }[] = [
  { label: "Near me", icon: Location01Icon, prompt: "What's good near me right now?" },
  { label: "From people I follow", icon: UserGroupIcon, prompt: "Show me places from people I follow around here" },
  { label: "Date night", icon: FavouriteIcon, prompt: "Find me a great date night spot around here" },
  { label: "Late night", icon: Moon02Icon, prompt: "Where can I get food late tonight around here?" },
];

const EASE = "cubic-bezier(0.23,1,0.32,1)";

/** The "@word" being typed right before the caret, if any. */
function parseMention(beforeCaret: string): { query: string; start: number } | null {
  const match = /(^|\s)@([\w.]*)$/.exec(beforeCaret);
  if (!match) return null;
  return { query: match[2].toLowerCase(), start: match.index + match[1].length };
}

/** Trails `value` by `ms`, so each keystroke doesn't fire a search. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export const Composer: FC<{ placeholder?: string }> = ({ placeholder = "Ask anything, or @ a creator" }) => {
  const aui = useAui();
  const isMobile = useIsMobile();
  const text = useAuiState((s) => s.composer.text);
  const isRunning = useAuiState((s) => s.thread.isRunning);

  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  const [caret, setCaret] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);
  const [wide, setWide] = useState(false);

  const mention = dismissed ? null : parseMention(text.slice(0, caret));
  const menuOpen = mention !== null;
  const query = useDebounced(mention?.query ?? "", 120);

  const { data, isFetching } = useQuery<{ creators: MentionCreator[] }>({
    queryKey: ["chat-creators", query],
    queryFn: () => apiRequest(`/api/chat/creators?q=${encodeURIComponent(query)}`),
    enabled: menuOpen,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const creators = data?.creators ?? [];

  useEffect(() => setActive(0), [query, menuOpen]);

  // A tap outside the composer closes the menu (phones have no Esc).
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (!anchorRef.current?.contains(e.target as Node)) setDismissed(true);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  // Inline while the draft fits between the controls; full width once it doesn't.
  useLayoutEffect(() => {
    const controls = controlsRef.current;
    const measure = measureRef.current;
    if (!controls || !measure) return;
    const inlineWidth = controls.clientWidth - 28 * 2 - 4 * 2;
    setWide(text.includes("\n") || measure.offsetWidth + 8 > inlineWidth);
  }, [text]);

  const syncCaret = () => setCaret(inputRef.current?.selectionStart ?? 0);

  const pick = (creator: MentionCreator) => {
    if (!mention) return;
    const before = text.slice(0, mention.start);
    const insert = `@${creator.username} `;
    const next = before + insert + text.slice(caret).replace(/^\s+/, "");
    aui.composer().setText(next);
    const pos = before.length + insert.length;
    setCaret(pos);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  };

  const openMentions = () => {
    const input = inputRef.current;
    const at = input?.selectionStart ?? text.length;
    const lead = at > 0 && !/\s/.test(text[at - 1]) ? " " : "";
    const next = text.slice(0, at) + lead + "@" + text.slice(at);
    aui.composer().setText(next);
    setDismissed(false);
    const pos = at + lead.length + 1;
    setCaret(pos);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(pos, pos);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!menuOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setDismissed(true);
      return;
    }
    if (creators.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : creators.length - 1)) % creators.length);
    } else if ((e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) || e.key === "Tab") {
      // preventDefault also stops assistant-ui's Enter-to-send.
      e.preventDefault();
      pick(creators[Math.min(active, creators.length - 1)]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <AuiIf condition={(s) => !s.thread.isEmpty && !s.thread.isRunning && s.composer.text.length === 0}>
        <QuickAsks />
      </AuiIf>

      {/* The composer anchors the mention menu, which grows up from its top edge. */}
      <div ref={anchorRef} className="relative">
        {menuOpen && (
          <MentionMenu
            creators={creators}
            loading={isFetching && creators.length === 0}
            query={mention.query}
            active={active}
            onHover={setActive}
            onPick={pick}
          />
        )}

        <ComposerPrimitive.Root
          className="aui-composer-root relative flex w-full flex-col gap-1.5 rounded-[14px] border border-input bg-background p-1.5 shadow-xs transition-[border-color] duration-150 focus-within:border-ring/60"
          data-testid="chat-composer"
        >
          <span
            ref={measureRef}
            aria-hidden="true"
            className="pointer-events-none invisible absolute whitespace-pre text-base leading-5 md:text-sm"
          >
            {text}
          </span>

          <div ref={controlsRef} className="grid grid-cols-[28px_minmax(0,1fr)_28px] items-end gap-x-1 gap-y-1.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={openMentions}
              aria-label="Mention a creator"
              title="Mention a creator"
              className={cn(
                "flex size-7 items-center justify-center rounded-[8px] text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.94]",
                menuOpen && "bg-muted text-foreground",
                wide ? "col-start-1 row-start-2" : "col-start-1 row-start-1",
              )}
              data-testid="button-mention"
            >
              <HugeiconsIcon icon={AtIcon} className="size-4" strokeWidth={2} />
            </button>

            <ComposerPrimitive.Input
              ref={inputRef}
              placeholder={placeholder}
              rows={1}
              maxRows={6}
              autoFocus={!isMobile}
              cancelOnEscape={!menuOpen}
              onKeyDown={onKeyDown}
              onChange={(e) => {
                setCaret(e.target.selectionStart ?? e.target.value.length);
                setDismissed(false);
              }}
              onSelect={syncCaret}
              onClick={syncCaret}
              role="combobox"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? "chat-mention-menu" : undefined}
              aria-autocomplete="list"
              // 16px keeps iOS Safari from zooming the page on focus.
              className={cn(
                "aui-composer-input min-h-7 w-full min-w-0 resize-none bg-transparent px-1 py-1 text-base leading-5 outline-none [overflow-wrap:anywhere] placeholder:text-muted-foreground md:text-sm",
                wide ? "col-span-full col-start-1 row-start-1" : "col-start-2 row-start-1",
              )}
              aria-label="Message"
              data-testid="input-chat-message"
            />

            <div className={cn(wide ? "col-start-3 row-start-2" : "col-start-3 row-start-1")}>
              {isRunning ? (
                <ComposerPrimitive.Cancel asChild>
                  <button
                    type="button"
                    aria-label="Stop"
                    className="flex size-7 items-center justify-center rounded-[8px] bg-foreground text-background transition-transform duration-150 active:scale-[0.94]"
                    data-testid="button-stop"
                  >
                    <HugeiconsIcon icon={StopIcon} className="size-3.5 fill-current" />
                  </button>
                </ComposerPrimitive.Cancel>
              ) : (
                <ComposerPrimitive.Send asChild>
                  <button
                    type="button"
                    aria-label="Send"
                    className="flex size-7 items-center justify-center rounded-[8px] bg-foreground text-background transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.94] disabled:bg-muted disabled:text-muted-foreground"
                    data-testid="button-send-message"
                  >
                    <HugeiconsIcon icon={ArrowUp02Icon} className="size-4" strokeWidth={2.4} />
                  </button>
                </ComposerPrimitive.Send>
              )}
            </div>
          </div>
        </ComposerPrimitive.Root>
      </div>
    </div>
  );
};

/**
 * One-tap asks. `wrap` lays them out in the welcome; otherwise they're one
 * row above the bar that scrolls sideways, faded at the edge.
 */
export const QuickAsks: FC<{ wrap?: boolean }> = ({ wrap = false }) => (
  <div
    className={cn(
      "flex gap-1.5",
      wrap
        ? "flex-wrap"
        : "-mx-3 overflow-x-auto px-3 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
    )}
    data-testid="quick-asks"
  >
    {QUICK_ASKS.map((q, i) => (
      <ThreadPrimitive.Suggestion key={q.label} prompt={q.prompt} send asChild>
        <button
          type="button"
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border bg-background font-medium text-muted-foreground transition-[background-color,color,transform] duration-150 fade-in slide-in-from-bottom-1 animate-in fill-mode-both hover:bg-muted hover:text-foreground active:scale-[0.97]",
            wrap ? "h-8 px-3 text-[13px]" : "h-7 px-2.5 text-xs",
          )}
          style={{ animationDelay: `${(wrap ? 100 : 0) + i * 40}ms` }}
          data-testid={`quick-ask-${i}`}
        >
          <HugeiconsIcon icon={q.icon} className={wrap ? "size-4" : "size-3.5"} />
          {q.label}
        </button>
      </ThreadPrimitive.Suggestion>
    ))}
  </div>
);

function Initial({ name }: { name: string }) {
  return (
    <span className="flex size-full items-center justify-center bg-muted font-brand text-[10px] text-muted-foreground">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** The @ menu, with the Prompt Bar's single highlight that glides between rows. */
function MentionMenu({
  creators,
  loading,
  query,
  active,
  onHover,
  onPick,
}: {
  creators: MentionCreator[];
  loading: boolean;
  query: string;
  active: number;
  onHover: (i: number) => void;
  onPick: (c: MentionCreator) => void;
}) {
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const row = rowRefs.current[active];
    setBox(row ? { top: row.offsetTop, height: row.offsetHeight } : null);
  }, [active, creators]);

  return (
    <div
      id="chat-mention-menu"
      role="listbox"
      aria-label="Creators"
      className="absolute inset-x-0 bottom-full z-20 mb-2 origin-bottom rounded-xl bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 fade-in zoom-in-95 animate-in duration-150"
      data-testid="mention-menu"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-1 rounded-lg bg-muted"
        style={{
          top: box?.top ?? 0,
          height: box?.height ?? 0,
          opacity: box && creators.length > 0 ? 1 : 0,
          transition: `top 220ms ${EASE}, height 220ms ${EASE}, opacity 150ms ease`,
        }}
      />
      {creators.map((c, i) => (
        <button
          key={c.username}
          type="button"
          role="option"
          aria-selected={i === active}
          ref={(el) => {
            rowRefs.current[i] = el;
          }}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => onHover(i)}
          onClick={() => onPick(c)}
          className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left"
          data-testid={`mention-${c.username}`}
        >
          <span className="size-5.5 shrink-0 overflow-hidden rounded-full">
            {c.avatar ? (
              <FallbackImg
                src={c.avatar}
                referrerPolicy="no-referrer"
                className="size-full object-cover"
                fallback={<Initial name={c.username} />}
              />
            ) : (
              <Initial name={c.username} />
            )}
          </span>
          <span className="shrink-0 text-[13px] font-medium">@{c.username}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {[c.isFollowed ? "Following" : null, `${c.posts} ${c.posts === 1 ? "post" : "posts"}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </button>
      ))}
      {creators.length === 0 && (
        <div className="flex h-9 items-center px-2 text-xs text-muted-foreground">
          {loading ? <span className="shimmer-text">Searching creators</span> : <>No creators match “{query}”</>}
        </div>
      )}
      <div className="mt-1 border-t px-2 pt-1.5 pb-1 text-[11px] text-muted-foreground">
        Mention a creator to ask about their spots
      </div>
    </div>
  );
}
