"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Bookmark, Check, Plus, Loader2, Info, Trash2 } from "lucide-react";
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
  size?: "default" | "sm" | "icon";
  showLabel?: boolean;
  className?: string;
}

const RATING_OPTIONS = [
  { value: 1, emoji: "👎", label: "ehh" },
  { value: 3, emoji: "👍", label: "liked" },
  { value: 5, emoji: "🤩", label: "loved" },
];

export function SaveToListDropdown({
  place,
  savedPlace,
  listsContainingPlace = [],
  onSaveSuccess,
  size = "sm",
  showLabel = true,
  className,
}: SaveToListDropdownProps) {
  const [open, setOpen] = useState(false);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [optimisticLists, setOptimisticLists] = useState<string[]>(listsContainingPlace);

  // Sync optimistic state when server data changes
  useEffect(() => {
    setOptimisticLists(listsContainingPlace);
  }, [listsContainingPlace]);

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
    onMutate: async (listId: string) => {
      // Optimistic update - immediately add to list
      setOptimisticLists(prev => [...prev, listId]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["place-detail"] });
      toast.success("Added to list!");
      onSaveSuccess?.();
    },
    onError: (error: Error, listId: string) => {
      // Rollback on error
      setOptimisticLists(prev => prev.filter(id => id !== listId));
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
    onMutate: async (listId: string) => {
      // Optimistic update - immediately remove from list
      setOptimisticLists(prev => prev.filter(id => id !== listId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["place-detail"] });
      toast.success("Removed from list");
      onSaveSuccess?.();
    },
    onError: (error: Error, listId: string) => {
      // Rollback on error
      setOptimisticLists(prev => [...prev, listId]);
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
    const isInList = optimisticLists.includes(listId);
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

  const unsavePlaceMutation = useMutation({
    mutationFn: async () => {
      if (!savedPlace) return;
      return apiRequest(`/api/saved-places/${savedPlace.id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      queryClient.invalidateQueries({ queryKey: ["place-detail"] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      toast.success("Removed from saved places");
      setOpen(false);
      onSaveSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove");
    },
  });

  const handleUnsave = () => {
    unsavePlaceMutation.mutate();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isSaved ? "default" : "outline"}
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
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="flex items-center gap-1">
              Been here?
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  Rate places you've been to help drive recommendations
                </TooltipContent>
              </Tooltip>
            </span>
          </DropdownMenuLabel>
          <div className="px-2 pb-1">
            <ToggleGroup
              type="single"
              value={hasBeen && currentRating ? String(currentRating) : ""}
              onValueChange={(value) => {
                if (value) {
                  handleRatingSelect(Number(value));
                } else if (hasBeen) {
                  // Clicked same item to deselect - clear the rating
                  updateSavedPlaceMutation.mutate({ hasBeen: false, rating: undefined });
                }
              }}
              variant="outline"
              className="w-full"
            >
              {RATING_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={String(option.value)}
                  disabled={savePlaceMutation.isPending || updateSavedPlaceMutation.isPending}
                  data-testid={`rating-button-${option.value}`}
                  className="flex-1 gap-1"
                >
                  <span className="text-sm">{option.emoji}</span>
                  <span className="text-xs">{option.label}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        
        <DropdownMenuGroup>
          <DropdownMenuLabel>Lists</DropdownMenuLabel>
          
          {listsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1.5 py-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : lists.length === 0 ? (
            <div className="text-sm text-muted-foreground px-1.5 py-1">No lists yet</div>
          ) : (
            lists.map((list) => {
              const isInList = optimisticLists.includes(list.id);
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
                  <span className="flex-1 truncate">{list.name}</span>
                  {isInList && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
              );
            })
          )}

          {showCreateInput ? (
            <div className="px-2 py-1.5 space-y-2">
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
              <Plus className="h-4 w-4" />
              Create new list
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            handleUnsave();
          }}
          disabled={unsavePlaceMutation.isPending || !isSaved}
          data-testid="button-unsave"
          className="hover:text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span>Remove from saved</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
