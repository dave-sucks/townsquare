"use client";

/**
 * /chat — the agent chat inside the map shell.
 *
 * Layout kept from the old chat-dashboard: a full-bleed PlaceMap, with the
 * chat in a floating 22rem panel on desktop and a BottomSheet on mobile.
 * Only one of the two is mounted (useIsMobile) so there is one thread and
 * one composer.
 *
 * Conversations: the client mints the id (the first message creates the
 * row in /api/chat) and mirrors it into ?c=<id> so a reload resumes. A
 * resumed conversation loads its UIMessage[] first, then mounts
 * ChatRuntime keyed by id — the runtime takes messages at mount time.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { UIMessage } from "ai";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuiState } from "@assistant-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiChat02Icon,
  ArrowTurnBackwardIcon,
  Delete02Icon,
  Loading03Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { AppShell } from "@/components/layout";
import { PlaceMap, type MapBounds } from "@/components/place-map";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { ChatRuntime } from "@/components/chat/chat-runtime";
import { Thread, type WelcomeConfig } from "@/components/chat/thread";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserLocation } from "@/hooks/use-user-location";
import { apiRequest, queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

interface UserData {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

const WELCOME: WelcomeConfig = {
  title: "What are you hungry for?",
  subtitle: "Ask about places, what creators are posting, or plan a night out.",
  suggestions: [
    { title: "Burger spots from people I follow around here", prompt: "Find burger spots from people I follow in this area" },
    { title: "Is Katz's actually worth the line?", prompt: "Is Katz's actually worth the line?" },
    { title: "Plan a Saturday in Williamsburg", prompt: "Plan a Saturday in Williamsburg: coffee, lunch, and a bar" },
  ],
};

const newConversationId = () => crypto.randomUUID();

export function ChatShell({ user }: { user: UserData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { location } = useUserLocation();

  // ?c=<id> resumes; otherwise a fresh client-minted id.
  const [conversationId, setConversationId] = useState<string>(
    () => searchParams.get("c") ?? newConversationId(),
  );
  const [isResumed, setIsResumed] = useState(() => searchParams.has("c"));
  const [showHistory, setShowHistory] = useState(false);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

  const { data: conversationsData, isLoading: conversationsLoading } = useQuery<{
    conversations: ConversationSummary[];
  }>({
    queryKey: ["conversations"],
    queryFn: () => apiRequest("/api/conversations"),
  });
  const conversations = conversationsData?.conversations ?? [];

  const { data: resumed, isLoading: resumedLoading, isError: resumedError } = useQuery<{
    conversation: ConversationSummary;
    messages: UIMessage[];
  }>({
    queryKey: ["conversation", conversationId],
    queryFn: () => apiRequest(`/api/conversations/${conversationId}`),
    enabled: isResumed,
    // The runtime owns the live thread; a refetch must not remount it.
    staleTime: Infinity,
    gcTime: 0,
  });

  useEffect(() => {
    if (resumedError) {
      toast.error("Couldn't open that chat");
      startNewChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumedError]);

  const setUrlConversation = useCallback(
    (id: string | null) => {
      router.replace(id ? `/chat?c=${id}` : "/chat", { scroll: false });
    },
    [router],
  );

  const startNewChat = useCallback(() => {
    setConversationId(newConversationId());
    setIsResumed(false);
    setShowHistory(false);
    setUrlConversation(null);
  }, [setUrlConversation]);

  const openConversation = useCallback(
    (id: string) => {
      setConversationId(id);
      setIsResumed(true);
      setShowHistory(false);
      setUrlConversation(id);
    },
    [setUrlConversation],
  );

  const deleteConversation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/conversations/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      if (id === conversationId) startNewChat();
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: () => toast.error("Failed to delete chat"),
  });

  // First message of a new chat: pin the id in the URL so a reload resumes.
  const onThreadStarted = useCallback(() => {
    if (searchParams.get("c") !== conversationId) setUrlConversation(conversationId);
  }, [conversationId, searchParams, setUrlConversation]);

  const onTurnEnd = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }, []);

  const timezone = useRef(
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
  ).current;

  const waitingForHistory = isResumed && (resumedLoading || !resumed);

  const chatView = waitingForHistory ? (
    <div className="flex flex-1 items-center justify-center">
      <HugeiconsIcon icon={Loading03Icon} className="size-5 animate-spin text-muted-foreground" />
    </div>
  ) : (
    <ChatRuntime
      key={conversationId}
      api="/api/chat"
      body={{
        conversationId,
        location: location ?? undefined,
        mapBounds: mapBounds ?? undefined,
        timezone,
      }}
      messages={isResumed ? resumed?.messages : undefined}
    >
      <ThreadWatcher onStarted={onThreadStarted} onTurnEnd={onTurnEnd} />
      <div className="min-h-0 flex-1">
        <Thread welcomeConfig={WELCOME} />
      </div>
    </ChatRuntime>
  );

  const historyView = (
    <div className="flex-1 overflow-y-auto">
      {conversationsLoading ? (
        <div className="flex h-full items-center justify-center">
          <HugeiconsIcon icon={Loading03Icon} className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex h-full items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">No past chats yet</p>
        </div>
      ) : (
        <div className="space-y-0.5 p-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-muted",
                conv.id === conversationId && "bg-muted",
              )}
            >
              <button
                type="button"
                onClick={() => openConversation(conv.id)}
                className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm"
                data-testid={`button-conversation-${conv.id}`}
              >
                {conv.title}
              </button>
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => deleteConversation.mutate(conv.id)}
                aria-label="Delete chat"
                data-testid={`button-delete-conversation-${conv.id}`}
              >
                <HugeiconsIcon icon={Delete02Icon} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const panel = (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b px-3 py-2">
        <h1 className="flex-1 font-brand text-sm font-semibold">
          {showHistory ? "Chats" : "Chat"}
        </h1>
        {showHistory ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowHistory(false)}
            aria-label="Back to chat"
            data-testid="button-back-to-chat"
          >
            <HugeiconsIcon icon={ArrowTurnBackwardIcon} />
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="icon-sm" onClick={startNewChat} aria-label="New chat" data-testid="button-new-chat">
              <HugeiconsIcon icon={PlusSignIcon} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowHistory(true)}
              aria-label="Past chats"
              data-testid="button-all-chats"
            >
              <HugeiconsIcon icon={AiChat02Icon} />
            </Button>
          </>
        )}
      </div>
      {/* Keep the thread mounted under the history list so an in-flight
          answer keeps streaming while the user browses past chats. */}
      <div className={cn("flex min-h-0 flex-1 flex-col", showHistory && "hidden")}>{chatView}</div>
      {showHistory && historyView}
    </div>
  );

  return (
    <AppShell user={user}>
      <div className="relative flex-1 overflow-hidden">
        <PlaceMap
          places={[]}
          selectedPlaceId={null}
          onMarkerClick={() => {}}
          showSettings
          onBoundsChange={setMapBounds}
        />

        {isMobile ? (
          <BottomSheet defaultSnapPoint="expanded">{panel}</BottomSheet>
        ) : (
          <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-[22rem] p-3">
            <div className="pointer-events-auto h-full overflow-hidden rounded-2xl border bg-background shadow-2xl">
              {panel}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/** Fires onStarted when the thread gets its first message, onTurnEnd when a run finishes. */
function ThreadWatcher({ onStarted, onTurnEnd }: { onStarted: () => void; onTurnEnd: () => void }) {
  const isEmpty = useAuiState((s) => s.thread.isEmpty);
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const wasRunning = useRef(false);

  useEffect(() => {
    if (!isEmpty) onStarted();
  }, [isEmpty, onStarted]);

  useEffect(() => {
    if (wasRunning.current && !isRunning) onTurnEnd();
    wasRunning.current = isRunning;
  }, [isRunning, onTurnEnd]);

  return null;
}
