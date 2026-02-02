"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/query-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  MessageCircle, 
  Plus, 
  Send, 
  Trash2, 
  ArrowLeft,
  Sparkles,
  MapPin,
  Bot,
  User,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import { ChatPlaceCards } from "@/components/chat-place-card";

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

export function ChatPage({ user }: { user: UserData }) {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingPlaces, setStreamingPlaces] = useState<PlaceResult[]>([]);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setActiveConversationId(data.conversation.id);
      setLocalMessages([]);
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (activeConversationId) {
        setActiveConversationId(null);
        setLocalMessages([]);
      }
    },
  });

  const sendMessage = async () => {
    if (!inputValue.trim() || !activeConversationId || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
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
  };

  return (
    <div className="flex h-screen bg-background">
      <div className="w-72 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back to Map</span>
            </Link>
          </div>
          <Button 
            onClick={startNewChat} 
            className="w-full gap-2"
            disabled={createConversationMutation.isPending}
            data-testid="button-new-chat"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 px-4">
                <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No conversations yet</p>
                <p className="text-xs text-muted-foreground mt-1">Start a new chat to get recommendations</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors group flex items-center justify-between cursor-pointer",
                    activeConversationId === conv.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground"
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

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {!activeConversationId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Discover Places</h2>
              <p className="text-muted-foreground mb-6">
                Ask me about places to visit, get personalized recommendations based on your saved places, or explore new neighborhoods.
              </p>
              <div className="grid gap-3 text-left">
                <ExamplePrompt 
                  icon={<MapPin className="h-4 w-4" />}
                  text="Best coffee shops in Chelsea"
                  onClick={() => {
                    startNewChat();
                  }}
                />
                <ExamplePrompt 
                  icon={<Sparkles className="h-4 w-4" />}
                  text="Recommend bars for happy hour"
                  onClick={() => {
                    startNewChat();
                  }}
                />
                <ExamplePrompt 
                  icon={<MessageCircle className="h-4 w-4" />}
                  text="What's near my saved places?"
                  onClick={() => {
                    startNewChat();
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <span className="font-medium">
                  {activeConversationData?.conversation?.title || "Chat"}
                </span>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0 px-4" ref={scrollRef}>
              <div className="max-w-3xl mx-auto py-6 space-y-6">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : localMessages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Start the conversation by sending a message</p>
                  </div>
                ) : (
                  localMessages.map((message) => (
                    <MessageBubble 
                      key={message.id} 
                      message={message} 
                      user={user}
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
                    }}
                    user={user}
                    isStreaming
                    streamingPlaces={streamingPlaces}
                  />
                )}
                {isStreaming && !streamingContent && streamingPlaces.length === 0 && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Searching for places...</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t p-4">
              <div className="max-w-3xl mx-auto">
                <div className="relative">
                  <Textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about places to visit..."
                    className="min-h-[56px] max-h-[200px] resize-none pr-12"
                    disabled={isStreaming}
                    data-testid="input-chat-message"
                  />
                  <Button
                    size="icon"
                    className="absolute right-2 bottom-2"
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
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  AI can make mistakes. Verify important information.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ 
  message, 
  user,
  isStreaming = false,
  streamingPlaces = [],
}: { 
  message: ChatMessage; 
  user: UserData;
  isStreaming?: boolean;
  streamingPlaces?: PlaceResult[];
}) {
  const isUser = message.role === "user";
  const places = isStreaming ? streamingPlaces : message.places;

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar className="h-8 w-8 shrink-0">
        {isUser ? (
          <>
            <AvatarImage src={user.profileImageUrl || undefined} />
            <AvatarFallback className="bg-secondary">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </>
        ) : (
          <AvatarFallback className="bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        )}
      </Avatar>
      <div className="max-w-[80%] flex flex-col gap-2">
        <div className={cn(
          "rounded-2xl px-4 py-2.5",
          isUser 
            ? "bg-primary text-primary-foreground rounded-br-md" 
            : "bg-muted rounded-bl-md"
        )}>
          <div className="text-sm whitespace-pre-wrap">
            {message.content}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse" />
            )}
          </div>
        </div>
        {places && places.length > 0 && (
          <ChatPlaceCards places={places} />
        )}
      </div>
    </div>
  );
}

function ExamplePrompt({ 
  icon, 
  text, 
  onClick 
}: { 
  icon: React.ReactNode; 
  text: string; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted transition-colors text-sm"
      data-testid={`button-example-${text.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="text-primary">{icon}</div>
      <span>{text}</span>
    </button>
  );
}
