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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Bookmark, Check, Plus, Loader2, ThumbsDown, Meh, ThumbsUp, List } from "lucide-react";
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
  hasBeen: boolean;
  rating: number | null;
}

interface ListData {
  id: string;
  name: string;
  isSystem?: boolean;
  systemSlug?: string | null;
  _count?: {
    listPlaces: number;
  };
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

const RATING_OPTIONS = [
  { value: 1, label: "Bad", icon: ThumbsDown, color: "text-red-500" },
  { value: 2, label: "Okay", icon: Meh, color: "text-yellow-500" },
  { value: 3, label: "Great", icon: ThumbsUp, color: "text-green-500" },
];

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
  const hasBeen = savedPlace?.hasBeen ?? false;
  const currentRating = savedPlace?.rating ?? null;

  const { data: listsData, isLoading: listsLoading } = useQuery<{ lists: ListData[] }>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("/api/lists"),
    enabled: open,
  });

  const lists = listsData?.lists || [];

  const savePlaceMutation = useMutation({
    mutationFn: async ({ hasBeen, rating }: { hasBeen?: boolean; rating?: number } = {}) => {
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
          hasBeen: hasBeen ?? false,
          rating: rating,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      queryClient.invalidateQueries({ queryKey: ["place-detail"] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      toast.success("Saved!");
      onSaveSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save place");
    },
  });

  const updateSavedPlaceMutation = useMutation({
    mutationFn: async ({ hasBeen, rating }: { hasBeen?: boolean; rating?: number }) => {
      if (!savedPlace) return;
      return apiRequest(`/api/saved-places/${savedPlace.id}`, {
        method: "PATCH",
        body: JSON.stringify({ hasBeen, rating }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      queryClient.invalidateQueries({ queryKey: ["place-detail"] });
      onSaveSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update");
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
      savePlaceMutation.mutate({});
    }
  };

  const handleRatingSelect = (rating: number) => {
    if (!isSaved) {
      savePlaceMutation.mutate({ hasBeen: true, rating });
    } else {
      const newHasBeen = currentRating === rating && hasBeen ? false : true;
      const newRating = currentRating === rating && hasBeen ? undefined : rating;
      updateSavedPlaceMutation.mutate({ hasBeen: newHasBeen, rating: newRating });
    }
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

  const isPending = savePlaceMutation.isPending || updateSavedPlaceMutation.isPending;

  const getRatingLabel = () => {
    if (!hasBeen || !currentRating) return null;
    const option = RATING_OPTIONS.find(o => o.value === currentRating);
    return option?.label;
  };

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
        <DropdownMenuLabel>Been there?</DropdownMenuLabel>
        {RATING_OPTIONS.map((option) => {
          const isSelected = hasBeen && currentRating === option.value;
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={(e) => {
                e.preventDefault();
                handleRatingSelect(option.value);
              }}
              disabled={savePlaceMutation.isPending}
              data-testid={`rating-button-${option.value}`}
            >
              <Icon className={cn("h-4 w-4 mr-2", option.color)} />
              <span className="flex-1">{option.label}</span>
              {isSelected && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        
        <DropdownMenuLabel>Lists</DropdownMenuLabel>
        
        {listsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2 px-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : lists.length === 0 ? (
          <div className="text-sm text-muted-foreground py-2 px-2">No lists yet</div>
        ) : (
          lists.map((list) => {
            const isInList = listsContainingPlace.includes(list.id);
            return (
              <DropdownMenuItem
                key={list.id}
                onClick={(e) => {
                  e.preventDefault();
                  if (isSaved) {
                    handleListToggle(list.id);
                  }
                }}
                disabled={!isSaved || addToListMutation.isPending || removeFromListMutation.isPending}
                data-testid={`list-checkbox-${list.id}`}
              >
                <List className="h-4 w-4 mr-2" />
                <span className="flex-1 truncate">{list.name}</span>
                {isInList && <Check className="h-4 w-4 ml-auto" />}
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
                e.stopPropagation();
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
            onClick={(e) => {
              e.preventDefault();
              if (isSaved) {
                setShowCreateInput(true);
              }
            }}
            disabled={!isSaved}
            data-testid="button-add-new-list"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create new list
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
