"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Bookmark, Check, Heart, Plus, Loader2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Place {
  id?: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  primaryType?: string | null;
  types?: string[] | null;
  priceLevel?: string | null;
  photoRefs?: string[] | null;
}

interface SavedPlace {
  id: string;
  placeId: string;
  status: "WANT" | "BEEN";
}

interface ListData {
  id: string;
  name: string;
  _count?: {
    listPlaces: number;
  };
}

interface ListPlaceData {
  listId: string;
}

interface SaveToListDropdownProps {
  place: Place;
  savedPlace?: SavedPlace | null;
  listsContainingPlace?: string[];
  onSaveSuccess?: () => void;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
  showLabel?: boolean;
  className?: string;
}

export function SaveToListDropdown({
  place,
  savedPlace,
  listsContainingPlace = [],
  onSaveSuccess,
  variant = "outline",
  size = "sm",
  showLabel = true,
  className,
}: SaveToListDropdownProps) {
  const [open, setOpen] = useState(false);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newListName, setNewListName] = useState("");

  const isSaved = !!savedPlace;
  const isWant = savedPlace?.status === "WANT";

  const { data: listsData, isLoading: listsLoading } = useQuery<{ lists: ListData[] }>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("/api/lists"),
    enabled: open,
  });

  const lists = listsData?.lists || [];

  const savePlaceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/saved-places", {
        method: "POST",
        body: JSON.stringify({
          googlePlaceId: place.googlePlaceId,
          name: place.name,
          formattedAddress: place.formattedAddress,
          lat: place.lat,
          lng: place.lng,
          primaryType: place.primaryType,
          types: place.types,
          priceLevel: place.priceLevel,
          photoRefs: place.photoRefs,
          status: "WANT",
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      queryClient.invalidateQueries({ queryKey: ["place-detail"] });
      toast.success("Saved!");
      onSaveSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save place");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: "WANT" | "BEEN") => {
      if (!savedPlace) return;
      return apiRequest(`/api/saved-places/${savedPlace.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      queryClient.invalidateQueries({ queryKey: ["place-detail"] });
      onSaveSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  const addToListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const placeId = place.id || savedPlace?.placeId;
      if (!placeId) {
        throw new Error("Place must be saved first");
      }
      return apiRequest(`/api/lists/${listId}/places`, {
        method: "POST",
        body: JSON.stringify({ placeId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["place-detail"] });
      toast.success("Added to list!");
      onSaveSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add to list");
    },
  });

  const removeFromListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const placeId = place.id || savedPlace?.placeId;
      return apiRequest(`/api/lists/${listId}/places`, {
        method: "DELETE",
        body: JSON.stringify({ placeId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["place-detail"] });
      toast.success("Removed from list");
      onSaveSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove from list");
    },
  });

  const createListMutation = useMutation({
    mutationFn: async (name: string) => {
      const result = await apiRequest("/api/lists", {
        method: "POST",
        body: JSON.stringify({ name }),
      }) as { list: { id: string } };
      return result.list.id;
    },
    onSuccess: async (listId: string) => {
      await queryClient.invalidateQueries({ queryKey: ["lists"] });
      addToListMutation.mutate(listId);
      setShowCreateInput(false);
      setNewListName("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create list");
    },
  });

  const handleButtonClick = () => {
    if (!isSaved) {
      savePlaceMutation.mutate();
    }
  };

  const handleWantToggle = () => {
    if (!savedPlace) return;
    const newStatus = isWant ? "BEEN" : "WANT";
    updateStatusMutation.mutate(newStatus);
  };

  const handleListToggle = (listId: string) => {
    const isInList = listsContainingPlace.includes(listId);
    if (isInList) {
      removeFromListMutation.mutate(listId);
    } else {
      addToListMutation.mutate(listId);
    }
  };

  const handleCreateList = () => {
    if (!newListName.trim()) {
      toast.error("List name is required");
      return;
    }
    createListMutation.mutate(newListName.trim());
  };

  const isPending = savePlaceMutation.isPending || updateStatusMutation.isPending;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn(className)}
          onClick={(e) => {
            if (!isSaved) {
              e.preventDefault();
              handleButtonClick();
              setOpen(true);
            }
          }}
          disabled={isPending}
          data-testid="button-save-to-list"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSaved ? (
            <Bookmark className="h-4 w-4 fill-current" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
          {showLabel && (
            <span className="ml-1">{isSaved ? "Saved" : "Save"}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          className="flex items-center justify-between cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            if (isSaved) {
              handleWantToggle();
            }
          }}
          disabled={!isSaved}
          data-testid="dropdown-item-saved"
        >
          <div className="flex items-center gap-2">
            <Check className={cn("h-4 w-4", isSaved ? "opacity-100" : "opacity-0")} />
            <span>Saved</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="flex items-center justify-between cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            if (isSaved) {
              handleWantToggle();
            }
          }}
          disabled={!isSaved}
          data-testid="dropdown-item-want-to-go"
        >
          <div className="flex items-center gap-2">
            <Heart className={cn("h-4 w-4", isWant ? "fill-rose-500 text-rose-500" : "opacity-30")} />
            <span>Want to Go</span>
          </div>
          {isWant && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Lists
        </DropdownMenuLabel>

        {listsLoading ? (
          <DropdownMenuItem disabled>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading...
          </DropdownMenuItem>
        ) : lists.length === 0 ? (
          <DropdownMenuItem disabled className="text-muted-foreground text-sm">
            No lists yet
          </DropdownMenuItem>
        ) : (
          lists.map((list) => {
            const isInList = listsContainingPlace.includes(list.id);
            return (
              <DropdownMenuItem
                key={list.id}
                className="flex items-center justify-between cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  handleListToggle(list.id);
                }}
                disabled={!isSaved || addToListMutation.isPending || removeFromListMutation.isPending}
                data-testid={`dropdown-item-list-${list.id}`}
              >
                <span className="truncate">{list.name}</span>
                {isInList && <Check className="h-4 w-4 text-primary shrink-0" />}
              </DropdownMenuItem>
            );
          })
        )}

        <DropdownMenuSeparator />

        {showCreateInput ? (
          <div className="p-2 space-y-2">
            <Input
              placeholder="List name"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateList();
                }
                if (e.key === "Escape") {
                  setShowCreateInput(false);
                  setNewListName("");
                }
              }}
              autoFocus
              data-testid="input-new-list-name"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setShowCreateInput(false);
                  setNewListName("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleCreateList}
                disabled={createListMutation.isPending || !newListName.trim()}
                data-testid="button-create-list"
              >
                Create
              </Button>
            </div>
          </div>
        ) : (
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              setShowCreateInput(true);
            }}
            disabled={!isSaved}
            data-testid="dropdown-item-add-new-list"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add new list
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
