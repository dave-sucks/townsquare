"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/query-client";
import { PlaceMap, type PlaceMapHandle } from "@/components/place-map";
import { AppShell } from "@/components/layout";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HugeiconsIcon } from "@hugeicons/react";
import { 
  PlusSignIcon, 
  SentIcon, 
  Delete02Icon, 
  SparklesIcon,
  Location01Icon,
  AiChat02Icon,
  Loading03Icon,
  ArrowTurnBackwardIcon,
  CheckmarkBadge01Icon,
  Bookmark01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SaveToListDropdown } from "@/components/shared/save-to-list-dropdown";

interface PlaceResult {
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  types: string[];
  primaryType: string | null;
  priceLevel: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
  photoRef: string | null;
  emoji: string | null;
}

interface UserData {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  places?: PlaceResult[];
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
}

interface MapPlace {
  id: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  primaryType: string | null;
  types: string[] | null;
  priceLevel: string | null;
  photoRefs: string[] | null;
}

interface SavedPlaceLike {
  id: string;
  placeId: string;
  hasBeen: boolean;
  rating: number | null;
  place: MapPlace;
}

export function ChatDashboard({ user }: { user: UserData }) {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingPlaces, setStreamingPlaces] = useState<PlaceResult[]>([]);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const isStreamingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mapRef = useRef<PlaceMapHandle>(null);
  const placeCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { data: conversationsData, isLoading: conversationsLoading } = useQuery<{ conversations: Conversation[] }>({
    queryKey: ["conversations"],
    queryFn: () => apiRequest("/api/conversations"),
  });

  const conversations = conversationsData?.conversations || [];

  const { data: activeConversationData, isLoading: messagesLoading } = useQuery<{ conversation: Conversation }>({
    queryKey: ["conversation", activeConversationId],
    queryFn: () => apiRequest(`/api/conversations/${activeConversationId}`),
    enabled: !!activeConversationId,
  });

  useEffect(() => {
    if (activeConversationData?.conversation?.messages && !isStreamingRef.current) {
      setLocalMessages(activeConversationData.conversation.messages);
    }
  }, [activeConversationData]);

  useEffect(() => {
    if (pendingMessage && activeConversationId && !isStreaming) {
      const msg = pendingMessage;
      setPendingMessage(null);
      sendMessage(msg);
    }
  }, [activeConversationId, pendingMessage]);

  const allPlacesFromChat = useMemo(() => {
    const allPlaces: PlaceResult[] = [];
    for (const message of localMessages) {
      if (message.places && message.places.length > 0) {
        allPlaces.push(...message.places);
      }
    }
    if (streamingPlaces.length > 0) {
      allPlaces.push(...streamingPlaces);
    }
    const uniquePlaces = Array.from(
      new Map(allPlaces.map(p => [p.googlePlaceId, p])).values()
    );
    return uniquePlaces;
  }, [localMessages, streamingPlaces]);

  const mapPlaces: SavedPlaceLike[] = useMemo(() => {
    return allPlacesFromChat.map((p) => ({
      id: p.googlePlaceId,
      placeId: p.googlePlaceId,
      hasBeen: false,
      rating: null,
      place: {
        id: p.googlePlaceId,
        googlePlaceId: p.googlePlaceId,
        name: p.name,
        formattedAddress: p.formattedAddress,
        lat: p.lat,
        lng: p.lng,
        primaryType: p.primaryType,
        types: p.types,
        priceLevel: p.priceLevel,
        photoRefs: p.photoRef ? [p.photoRef] : null,
      },
    }));
  }, [allPlacesFromChat]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [localMessages, streamingContent, streamingPlaces, scrollToBottom]);

  const createConversationMutation = useMutation({
    mutationFn: async (): Promise<{ conversation: Conversation }> => {
      return apiRequest("/api/conversations", { method: "POST" });
    },
    onSuccess: (data) => {
      setActiveConversationId(data.conversation.id);
      setLocalMessages([]);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: () => toast.error("Failed to create conversation"),
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/conversations/${id}`, { method: "DELETE" });
    },
    onSuccess: (_, deletedId) => {
      if (activeConversationId === deletedId) {
        setActiveConversationId(null);
        setLocalMessages([]);
      }
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: () => toast.error("Failed to delete conversation"),
  });

  const sendMessage = async (overrideContent?: string) => {
    const content = overrideContent || inputValue.trim();
    if (!content || !activeConversationId || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    setLocalMessages(prev => [...prev, userMessage]);
    setInputValue("");
    isStreamingRef.current = true;
    setIsStreaming(true);
    setStreamingContent("");
    setStreamingPlaces([]);

    try {
      const response = await fetch(`/api/conversations/${activeConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage.content }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";
      let receivedPlaces: PlaceResult[] = [];
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              toast.error("Failed to get response. Please try again.");
              setStreamingContent("");
              setStreamingPlaces([]);
              isStreamingRef.current = false;
              setIsStreaming(false);
              queryClient.invalidateQueries({ queryKey: ["conversation", activeConversationId] });
              return;
            }
            if (data.places !== undefined) {
              receivedPlaces = data.places;
              setStreamingPlaces(receivedPlaces);
            }
            if (data.content) {
              fullContent += data.content;
              setStreamingContent(fullContent);
            }
            if (data.done) {
              const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: fullContent,
                createdAt: new Date().toISOString(),
                places: receivedPlaces.length > 0 ? receivedPlaces : undefined,
              };
              setLocalMessages(prev => [...prev, assistantMessage]);
              setStreamingContent("");
              setStreamingPlaces([]);
              queryClient.invalidateQueries({ queryKey: ["conversations"] });
              queryClient.invalidateQueries({ queryKey: ["conversation", activeConversationId] });
            }
          } catch {
          }
        }
      }
    } catch (error) {
      console.error("Send message error:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      isStreamingRef.current = false;
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    if (inputValue.trim() && !activeConversationId) {
      setPendingMessage(inputValue.trim());
    }
    createConversationMutation.mutate();
  };

  const selectConversation = (id: string) => {
    setActiveConversationId(id);
    setStreamingContent("");
    setStreamingPlaces([]);
    setSelectedPlaceId(null);
  };

  const handleMarkerClick = useCallback((placeId: string) => {
    setSelectedPlaceId(placeId);
    const cardElement = placeCardRefs.current.get(placeId);
    if (cardElement) {
      cardElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const handlePlaceCardClick = useCallback((place: PlaceResult) => {
    setSelectedPlaceId(place.googlePlaceId);
    if (mapRef.current) {
      mapRef.current.panTo(place.lat, place.lng);
    }
  }, []);

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <h1 className="font-semibold text-sm flex-1 font-brand">AI Chat</h1>
        {activeConversationId && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setActiveConversationId(null);
              setLocalMessages([]);
              setSelectedPlaceId(null);
            }}
            data-testid="button-all-chats"
          >
            <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={startNewChat}
          disabled={createConversationMutation.isPending}
          data-testid="button-new-chat"
        >
          <HugeiconsIcon icon={PlusSignIcon} className="h-4 w-4" />
        </Button>
      </div>

      {!activeConversationId ? (
        <div className="flex-1 overflow-y-auto">
          {conversationsLoading ? (
            <div className="flex items-center justify-center h-full">
              <HugeiconsIcon icon={Loading03Icon} className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 gap-3">
              <HugeiconsIcon icon={SparklesIcon} className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Discover places with AI</p>
                <p className="text-xs text-muted-foreground mt-1">Ask for recommendations, hidden gems, or plan your next outing</p>
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors group flex items-center justify-between cursor-pointer hover-elevate",
                    activeConversationId === conv.id
                      ? "bg-primary/10 text-primary"
                      : "text-foreground"
                  )}
                  data-testid={`button-conversation-${conv.id}`}
                >
                  <span className="truncate flex-1">{conv.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversationMutation.mutate(conv.id);
                    }}
                    data-testid={`button-delete-conversation-${conv.id}`}
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 relative min-h-0">
          <div className="absolute inset-0 overflow-y-auto" ref={scrollRef}>
            <div className="p-3 pb-20 space-y-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <HugeiconsIcon icon={Loading03Icon} className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : localMessages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Ask about places to visit...</p>
                </div>
              ) : (
                localMessages.map((message) => (
                  <MessageBubble 
                    key={message.id} 
                    message={message} 
                    user={user}
                    selectedPlaceId={selectedPlaceId}
                    onPlaceClick={handlePlaceCardClick}
                    placeCardRefs={placeCardRefs}
                  />
                ))
              )}
              {isStreaming && (streamingContent || streamingPlaces.length > 0) && (
                <MessageBubble
                  message={{
                    id: "streaming",
                    role: "assistant",
                    content: streamingContent,
                    createdAt: new Date().toISOString(),
                    places: streamingPlaces,
                  }}
                  user={user}
                  isStreaming
                  selectedPlaceId={selectedPlaceId}
                  onPlaceClick={handlePlaceCardClick}
                  placeCardRefs={placeCardRefs}
                />
              )}
              {isStreaming && !streamingContent && streamingPlaces.length === 0 && (
                <div className="flex gap-2">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <HugeiconsIcon icon={AiChat02Icon} className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Searching...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="relative group">
              <Textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about places..."
                className="min-h-[48px] max-h-[120px] resize-none pr-12 text-base bg-black/[0.05] dark:bg-white/[0.05] backdrop-blur-xl border border-border/40 rounded-2xl focus-visible:ring-1 focus-visible:ring-primary/20 transition-all duration-200"
                style={{ fontSize: "16px" }}
                disabled={isStreaming}
                data-testid="input-chat-message"
              />
              <Button
                size="sm"
                className="absolute right-2 bottom-2 h-8 w-8 rounded-xl transition-transform active:scale-95"
                onClick={() => sendMessage()}
                disabled={!inputValue.trim() || isStreaming}
                data-testid="button-send-message"
              >
                {isStreaming ? (
                  <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
                ) : (
                  <HugeiconsIcon icon={SentIcon} className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <AppShell user={user}>
      <div className="relative flex-1 overflow-hidden">
        <PlaceMap
          ref={mapRef}
          places={mapPlaces}
          selectedPlaceId={selectedPlaceId}
          onMarkerClick={handleMarkerClick}
          showSettings={true}
        />

        <div className="absolute top-0 left-0 bottom-0 z-10 w-[22rem] p-3 hidden md:block pointer-events-none">
          <div className="h-full bg-background/95 backdrop-blur-md rounded-2xl border shadow-2xl overflow-hidden pointer-events-auto">
            {sidebar}
          </div>
        </div>

        <div className="md:hidden">
          <BottomSheet defaultSnapPoint="expanded">
            {sidebar}
          </BottomSheet>
        </div>
      </div>
    </AppShell>
  );
}

function MessageBubble({ 
  message, 
  user,
  isStreaming = false,
  selectedPlaceId,
  onPlaceClick,
  placeCardRefs,
}: { 
  message: ChatMessage; 
  user: UserData;
  isStreaming?: boolean;
  selectedPlaceId?: string | null;
  onPlaceClick?: (place: PlaceResult) => void;
  placeCardRefs?: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  const isUser = message.role === "user";

  const hasPlaces = message.places && message.places.length > 0;

  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div className={cn("flex flex-col", isUser ? "items-end max-w-[90%]" : "items-start w-full")}>
        {isUser && message.content && (
          <div className="text-sm whitespace-pre-wrap break-words bg-primary text-primary-foreground px-3 py-2 rounded-lg rounded-br-none" style={{ overflowWrap: "anywhere" }}>
            {message.content}
          </div>
        )}
        {!isUser && !hasPlaces && message.content && (
          <div className="text-sm whitespace-pre-wrap break-words text-foreground py-1" style={{ overflowWrap: "anywhere" }}>
            {message.content}
            {isStreaming && (
              <span className="inline-block w-1 h-3.5 bg-current ml-0.5 animate-pulse" />
            )}
          </div>
        )}
        {!message.content && isStreaming && !hasPlaces && (
          <div className="text-sm text-foreground py-1">
            <span className="inline-block w-1 h-3.5 bg-current ml-0.5 animate-pulse" />
          </div>
        )}
        {hasPlaces && (
          <div className="mt-1 space-y-1.5 w-full">
            {message.content && (
              <div className="text-sm whitespace-pre-wrap break-words text-foreground pb-1" style={{ overflowWrap: "anywhere" }}>
                {message.content}
                {isStreaming && (
                  <span className="inline-block w-1 h-3.5 bg-current ml-0.5 animate-pulse" />
                )}
              </div>
            )}
            {!message.content && isStreaming && (
              <div className="text-sm text-foreground pb-1">
                <span className="inline-block w-1 h-3.5 bg-current ml-0.5 animate-pulse" />
              </div>
            )}
            {message.places!.map((place) => (
              <ChatPlaceCardInline
                key={place.googlePlaceId}
                place={place}
                isSelected={selectedPlaceId === place.googlePlaceId}
                onClick={() => onPlaceClick?.(place)}
                ref={(el) => {
                  if (el && placeCardRefs) {
                    placeCardRefs.current.set(place.googlePlaceId, el);
                  }
                }}
              />
            ))}
            {!isStreaming && (
              <SaveAllToListButton 
                places={message.places!} 
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { forwardRef } from "react";

function SaveAllToListButton({ places }: { places: PlaceResult[] }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedListName, setSavedListName] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newListName, setNewListName] = useState("");

  const { data: listsData } = useQuery<{ lists: { id: string; name: string; _count?: { listPlaces: number } }[] }>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("/api/lists"),
    enabled: open,
  });

  const lists = listsData?.lists || [];

  const handleSaveToList = async (listName: string, existingListId?: string) => {
    if (saving) return;
    setSaving(true);
    setOpen(false);
    try {
      const response = await apiRequest("/api/chat/save-all-to-list", {
        method: "POST",
        body: JSON.stringify({ listName, listId: existingListId, places }),
      }) as { savedCount: number; list: { id: string; name: string } };
      setSaved(true);
      setSavedListName(response.list.name);
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      toast.success(`Saved ${response.savedCount} places to "${response.list.name}"`);
    } catch {
      toast.error("Failed to save places. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAndSave = () => {
    if (!newListName.trim()) return;
    handleSaveToList(newListName.trim());
    setNewListName("");
    setShowCreateDialog(false);
  };

  if (saved) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="mt-1 gap-1.5 text-xs"
        disabled
        data-testid="button-save-all-to-list"
      >
        <HugeiconsIcon icon={CheckmarkBadge01Icon} className="h-3 w-3" />
        {savedListName ? `Saved to "${savedListName}"` : "Saved"}
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setNewListName(""); } }}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="mt-1 gap-1.5 text-xs"
            disabled={saving}
            data-testid="button-save-all-to-list"
          >
            {saving ? (
              <>
                <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={Bookmark01Icon} className="h-3 w-3" />
                Save all to list
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56 z-[200]">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Save {places.length} places to...
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {!listsData && open && (
            <div className="px-2 py-3 flex items-center justify-center">
              <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {listsData && lists.length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground text-center">
              No lists yet
            </div>
          )}
          {lists.map((list) => (
            <DropdownMenuItem
              key={list.id}
              onClick={() => handleSaveToList(list.name, list.id)}
              data-testid={`menu-item-list-${list.id}`}
            >
              <HugeiconsIcon icon={Bookmark01Icon} className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <span className="truncate">{list.name}</span>
            </DropdownMenuItem>
          ))}
          {(lists.length > 0 || (listsData && lists.length === 0)) && <DropdownMenuSeparator />}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setOpen(false);
              setTimeout(() => setShowCreateDialog(true), 150);
            }}
            data-testid="button-create-new-list"
          >
            <HugeiconsIcon icon={PlusSignIcon} className="h-3.5 w-3.5 mr-2" />
            New list
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showCreateDialog} onOpenChange={(o) => { setShowCreateDialog(o); if (!o) setNewListName(""); }}>
        <DialogContent className="z-[300]">
          <DialogHeader>
            <DialogTitle>Create new list</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Save {places.length} places to a new list
          </p>
          <Input
            placeholder="List name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateAndSave();
              }
            }}
            autoFocus
            style={{ fontSize: "16px" }}
            data-testid="input-new-list-name-dialog"
          />
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="ghost"
              className="flex-1 py-3 text-base"
              onClick={() => {
                setShowCreateDialog(false);
                setNewListName("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 py-3 text-base"
              onClick={handleCreateAndSave}
              disabled={!newListName.trim() || saving}
              data-testid="button-create-list-confirm"
            >
              {saving ? "Saving..." : "Create & Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ChatPlaceCardInlineProps {
  place: PlaceResult;
  isSelected: boolean;
  onClick: () => void;
}

interface SavedPlaceData {
  id: string;
  placeId: string;
  hasBeen: boolean;
  rating: number | null;
  lists?: { id: string; name: string }[];
  place: {
    id: string;
    googlePlaceId: string;
  };
}

function formatCategoryName(type: string): string {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function getChatCategory(primaryType: string | null, types: string[]): string {
  const priority = ["restaurant", "cafe", "bar", "bakery", "night_club", "meal_takeaway", "meal_delivery"];
  if (primaryType && priority.includes(primaryType)) return formatCategoryName(primaryType);
  if (types.length > 0) {
    for (const cat of priority) {
      if (types.includes(cat)) return formatCategoryName(cat);
    }
    const nonGeneric = types.filter(t => !["establishment", "point_of_interest", "food", "store"].includes(t));
    if (nonGeneric.length > 0) return formatCategoryName(nonGeneric[0]);
  }
  if (primaryType && !["establishment", "point_of_interest", "food"].includes(primaryType)) {
    return formatCategoryName(primaryType);
  }
  return "";
}

const ChatPlaceCardInline = forwardRef<HTMLDivElement, ChatPlaceCardInlineProps>(
  function ChatPlaceCardInline({ place, isSelected, onClick }, ref) {
    const { data: savedPlacesData } = useQuery<{ savedPlaces: SavedPlaceData[] }>({
      queryKey: ["saved-places"],
      queryFn: () => apiRequest("/api/saved-places"),
    });

    const savedPlace = savedPlacesData?.savedPlaces?.find(
      sp => sp.place.googlePlaceId === place.googlePlaceId
    );

    const category = getChatCategory(place.primaryType, place.types);
    const locationDisplay = place.formattedAddress.split(",")[0];

    const placeForDropdown = {
      id: savedPlace?.place.id,
      googlePlaceId: place.googlePlaceId,
      name: place.name,
      formattedAddress: place.formattedAddress,
      lat: place.lat,
      lng: place.lng,
      primaryType: place.primaryType,
      types: place.types as string[] | null,
      priceLevel: place.priceLevel,
      photoRefs: place.photoRef ? [place.photoRef] : null,
    };

    const ratingStars = place.rating ? place.rating.toFixed(1) : null;

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(
          "group flex items-center gap-3 p-1.5 rounded-lg transition-colors cursor-pointer",
          isSelected ? "bg-accent" : "hover-elevate"
        )}
        data-testid={`chat-place-card-${place.googlePlaceId}`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            {place.emoji ? (
              <span className="text-xl">{place.emoji}</span>
            ) : (
              <HugeiconsIcon icon={Location01Icon} className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          <div className="flex-1 min-w-0 overflow-hidden">
            <h3 className="font-semibold text-sm truncate font-brand">
              {place.name}
            </h3>
            
            {category && (
              <div className="flex items-center gap-1 text-sm text-foreground truncate">
                <span>{category}</span>
                {ratingStars && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{ratingStars}</span>
                  </>
                )}
              </div>
            )}
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
              <HugeiconsIcon icon={Location01Icon} className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{locationDisplay}</span>
            </div>
          </div>
        </div>
        
        <div 
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0"
        >
          <SaveToListDropdown
            place={placeForDropdown}
            savedPlace={savedPlace ? {
              id: savedPlace.id,
              placeId: savedPlace.placeId,
              hasBeen: savedPlace.hasBeen,
              rating: savedPlace.rating,
            } : undefined}
            listsContainingPlace={savedPlace?.lists?.map(l => l.id) || []}
            showLabel={false}
            variant="ghost"
            size="icon"
          />
        </div>
      </div>
    );
  }
);
