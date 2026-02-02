"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Bookmark, Check, Plus, Loader2 } from "lucide-react";
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
  { value: 1, label: "Bad", color: "bg-red-500", hoverColor: "hover:bg-red-400", activeColor: "bg-red-600" },
  { value: 2, label: "Okay", color: "bg-yellow-500", hoverColor: "hover:bg-yellow-400", activeColor: "bg-yellow-600" },
  { value: 3, label: "Great", color: "bg-green-500", hoverColor: "hover:bg-green-400", activeColor: "bg-green-600" },
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Been there?</p>
            <div className="flex items-center justify-center gap-3">
              {RATING_OPTIONS.map((option) => {
                const isSelected = hasBeen && currentRating === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleRatingSelect(option.value)}
                    disabled={!isSaved && savePlaceMutation.isPending}
                    className={cn(
                      "w-10 h-10 rounded-full transition-all flex items-center justify-center",
                      isSelected 
                        ? cn(option.activeColor, "ring-2 ring-offset-2 ring-offset-background") 
                        : cn(option.color, option.hoverColor, "opacity-60 hover:opacity-100"),
                      "disabled:opacity-50"
                    )}
                    title={option.label}
                    data-testid={`rating-button-${option.value}`}
                  >
                    {isSelected && <Check className="h-5 w-5 text-white" />}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1 px-1">
              <span>Bad</span>
              <span>Okay</span>
              <span>Great</span>
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2">Add to list</p>
            
            {listsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : lists.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No lists yet</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {lists.map((list) => {
                  const isInList = listsContainingPlace.includes(list.id);
                  return (
                    <button
                      key={list.id}
                      className={cn(
                        "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm",
                        "hover-elevate transition-colors text-left",
                        isInList && "bg-accent"
                      )}
                      onClick={() => handleListToggle(list.id)}
                      disabled={!isSaved || addToListMutation.isPending || removeFromListMutation.isPending}
                      data-testid={`list-checkbox-${list.id}`}
                    >
                      <span className="truncate">{list.name}</span>
                      {isInList && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-2 pt-2 border-t">
              {showCreateInput ? (
                <div className="space-y-2">
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
                <button
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm",
                    "hover-elevate transition-colors",
                    !isSaved && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => setShowCreateInput(true)}
                  disabled={!isSaved}
                  data-testid="button-add-new-list"
                >
                  <Plus className="h-4 w-4" />
                  Create new list
                </button>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
