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
import { Card } from "@/components/ui/card";
import { 
  MessageCircle, 
  Plus, 
  Send, 
  Trash2, 
  Sparkles,
  MapPin,
  Bot,
  User,
  Loader2,
  Star,
  Bookmark,
  Check,
  RotateCcw
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
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
    if (activeConversationData?.conversation?.messages) {
      setLocalMessages(activeConversationData.conversation.messages);
    }
  }, [activeConversationData]);

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

  const sendMessage = async () => {
    if (!inputValue.trim() || !activeConversationId || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
      createdAt: new Date().toISOString(),
    };

    setLocalMessages(prev => [...prev, userMessage]);
    setInputValue("");
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
              setIsStreaming(false);
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
            }
          } catch {
          }
        }
      }
    } catch (error) {
      console.error("Send message error:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
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
        <h1 className="font-semibold text-sm flex-1">AI Chat</h1>
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
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={startNewChat}
          disabled={createConversationMutation.isPending}
          data-testid="button-new-chat"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {!activeConversationId ? (
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Start a new chat to discover places</p>
                </div>
              ) : (
                conversations.map((conv) => (
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
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
            <div className="p-3 space-y-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
                      <Bot className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Searching...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 pt-0">
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-b from-transparent to-background/20 rounded-2xl pointer-events-none" />
              <Textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about places..."
                className="min-h-[48px] max-h-[120px] resize-none pr-12 text-sm bg-background/80 backdrop-blur-md border shadow-xl rounded-2xl focus-visible:ring-1 focus-visible:ring-primary/20 transition-all duration-200"
                disabled={isStreaming}
                data-testid="input-chat-message"
              />
              <Button
                size="sm"
                className="absolute right-2 bottom-2 h-8 w-8 rounded-xl shadow-sm transition-transform active:scale-95"
                onClick={sendMessage}
                disabled={!inputValue.trim() || isStreaming}
                data-testid="button-send-message"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
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
          showSearch={false}
        />

        <div className="absolute top-0 left-0 bottom-0 z-10 w-[22rem] p-3 hidden md:block pointer-events-none">
          <div className="h-full bg-background/95 backdrop-blur-md rounded-2xl border shadow-2xl overflow-hidden pointer-events-auto">
            {sidebar}
          </div>
        </div>

        <div className="md:hidden">
          <BottomSheet defaultSnapPoint="mid">
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

  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div className={cn("flex flex-col", isUser ? "items-end" : "items-start", "max-w-[90%]")}>
        <div className={cn(
          "text-sm whitespace-pre-wrap break-words",
          isUser 
            ? "bg-primary text-primary-foreground px-3 py-2 rounded-lg rounded-br-none" 
            : "text-foreground py-1"
        )}>
          {message.content}
          {isStreaming && (
            <span className="inline-block w-1 h-3.5 bg-current ml-0.5 animate-pulse" />
          )}
        </div>
        {message.places && message.places.length > 0 && (
          <div className="mt-2 space-y-2 w-full">
            {message.places.map((place) => (
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
          </div>
        )}
      </div>
    </div>
  );
}

import { forwardRef } from "react";

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

const ChatPlaceCardInline = forwardRef<HTMLDivElement, ChatPlaceCardInlineProps>(
  function ChatPlaceCardInline({ place, isSelected, onClick }, ref) {
    const { data: savedPlacesData } = useQuery<{ savedPlaces: SavedPlaceData[] }>({
      queryKey: ["saved-places"],
    });

    const savedPlace = savedPlacesData?.savedPlaces?.find(
      sp => sp.place.googlePlaceId === place.googlePlaceId
    );

    const formatType = (type: string | null) => {
      if (!type) return "";
      return type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    };

    const photoUrl = place.photoRef 
      ? `/api/places/photo?ref=${place.photoRef}&maxwidth=200`
      : null;

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

    return (
      <Card
        ref={ref}
        onClick={onClick}
        className={cn(
          "overflow-hidden cursor-pointer transition-all",
          isSelected && "ring-2 ring-primary"
        )}
      >
        <div className="flex">
          {photoUrl && (
            <div className="w-16 h-16 shrink-0">
              <img 
                src={photoUrl} 
                alt={place.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 p-2 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-xs truncate">{place.name}</h4>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                  {formatType(place.primaryType) && (
                    <span>{formatType(place.primaryType)}</span>
                  )}
                  {place.rating && (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                      {place.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  {place.formattedAddress.split(",")[0]}
                </p>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
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
                  variant="outline"
                  size="icon"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }
);
