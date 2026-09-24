"use client";

/**
 * Past chats, in the panel in place of the thread. Grouped by last activity
 * (Today / Yesterday / Previous 7 days / …), searchable once the list is long.
 * Delete asks inline first — a conversation delete can't be undone.
 */

import { useMemo, useState } from "react";
import { differenceInCalendarDays, formatDistanceToNowStrict } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, Loading03Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

const SEARCH_AFTER = 8;

function groupLabel(iso: string, now: Date): string {
  const days = differenceInCalendarDays(now, new Date(iso));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 days";
  if (days < 30) return "Previous 30 days";
  return "Older";
}

function shortAgo(iso: string): string {
  try {
    return formatDistanceToNowStrict(new Date(iso))
      .replace(/ seconds?/, "s")
      .replace(/ minutes?/, "m")
      .replace(/ hours?/, "h")
      .replace(/ days?/, "d")
      .replace(/ months?/, "mo")
      .replace(/ years?/, "y");
  } catch {
    return "";
  }
}

export function ChatHistory({
  conversations,
  loading,
  error,
  activeId,
  deletingId,
  onOpen,
  onDelete,
  onRetry,
}: {
  conversations: ConversationSummary[];
  loading: boolean;
  error: boolean;
  activeId: string;
  deletingId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry: () => void;
}) {
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const now = new Date();
    const q = query.trim().toLowerCase();
    const out: { label: string; items: ConversationSummary[] }[] = [];
    for (const c of conversations) {
      if (q && !c.title.toLowerCase().includes(q)) continue;
      const label = groupLabel(c.updatedAt, now);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(c);
      else out.push({ label, items: [c] });
    }
    return out;
  }, [conversations, query]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <HugeiconsIcon icon={Loading03Icon} className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load your chats.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
        <p className="font-brand text-sm font-semibold">No chats yet</p>
        <p className="text-xs text-muted-foreground">Your conversations will show up here.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {conversations.length > SEARCH_AFTER && (
        <div className="shrink-0 px-2 pt-2">
          <label className="flex h-8 items-center gap-2 rounded-lg bg-muted px-2.5 text-muted-foreground focus-within:ring-1 focus-within:ring-ring/50">
            <HugeiconsIcon icon={Search01Icon} className="size-3.5 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              aria-label="Search chats"
              className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm"
              data-testid="input-search-chats"
            />
          </label>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-2" data-testid="chat-history">
        {groups.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">No chats match “{query.trim()}”</p>
        )}
        {groups.map((g) => (
          <section key={g.label} className="mb-2">
            <h2 className="px-2 pt-1 pb-1 text-[11px] font-medium text-muted-foreground">{g.label}</h2>
            <div className="space-y-0.5">
              {g.items.map((conv) => {
                const confirming = confirmId === conv.id;
                const deleting = deletingId === conv.id;
                return (
                  <div
                    key={conv.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-muted",
                      conv.id === activeId && "bg-muted",
                      deleting && "opacity-50",
                    )}
                    onMouseLeave={() => confirming && setConfirmId(null)}
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(conv.id)}
                      className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm"
                      data-testid={`button-conversation-${conv.id}`}
                    >
                      {conv.title}
                    </button>
                    {confirming ? (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button variant="ghost" size="xs" onClick={() => setConfirmId(null)}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() => {
                            setConfirmId(null);
                            onDelete(conv.id);
                          }}
                          data-testid={`button-confirm-delete-${conv.id}`}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground group-hover:hidden [@media(hover:none)]:hidden">
                          {shortAgo(conv.updatedAt)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="hidden shrink-0 group-hover:inline-flex focus-visible:inline-flex [@media(hover:none)]:inline-flex"
                          onClick={() => setConfirmId(conv.id)}
                          disabled={deleting}
                          aria-label="Delete chat"
                          data-testid={`button-delete-conversation-${conv.id}`}
                        >
                          <HugeiconsIcon icon={Delete02Icon} />
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
