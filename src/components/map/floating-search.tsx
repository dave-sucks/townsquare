"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Bookmark01Icon, Cancel01Icon, Loading03Icon, PlusSignIcon, Tick01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface ListData {
  id: string;
  name: string;
  isSystem?: boolean;
  _count?: { listPlaces: number };
}

interface SavedPlaceResult {
  savedPlace: {
    id: string;
    placeId: string;
    hasBeen: boolean;
    rating: number | null;
  };
}

const RATING_OPTIONS = [
  { value: 1, emoji: "👎", label: "ehh" },
  { value: 3, emoji: "👍", label: "liked" },
  { value: 5, emoji: "🔥", label: "loved" },
];

export function FloatingSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [drawerPlace, setDrawerPlace] = useState<{
    prediction: PlacePrediction;
    savedData: { id: string; placeId: string; hasBeen: boolean; rating: number | null };
  } | null>(null);

  const searchPlaces = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data.predictions || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => searchPlaces(searchQuery), 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchPlaces]);

  const handleClear = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  const showResults = isFocused && (isSearching || searchResults.length > 0 || (searchQuery && searchResults.length === 0));

  return (
    <div className="absolute top-3 left-3 right-3 md:left-auto md:right-3 z-20 md:w-96">
      <div className="relative">
        <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search for a place..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 300)}
          className="pl-10 pr-8 bg-background shadow-lg border"
          data-testid="input-search-place"
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            data-testid="button-clear-search"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
          </button>
        )}
      </div>

      {showResults && (
        <div className="mt-2 bg-background border rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {isSearching && (
            <div className="space-y-2 p-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}
          {!isSearching && searchResults.length > 0 && (
            <div className="py-1">
              {searchResults.map((result) => (
                <SearchResultRow
                  key={result.place_id}
                  result={result}
                  onSaved={(savedData) => {
                    setDrawerPlace({ prediction: result, savedData });
                  }}
                />
              ))}
            </div>
          )}
          {!isSearching && searchQuery && searchResults.length === 0 && (
            <p className="p-3 text-center text-sm text-muted-foreground">No places found</p>
          )}
        </div>
      )}

      <SaveDrawer
        drawerPlace={drawerPlace}
        onClose={() => setDrawerPlace(null)}
      />
    </div>
  );
}

function SearchResultRow({ 
  result, 
  onSaved,
}: { 
  result: PlacePrediction;
  onSaved: (savedData: { id: string; placeId: string; hasBeen: boolean; rating: number | null }) => void;
}) {
  const [isSaved, setIsSaved] = useState(false);

  const savePlaceMutation = useMutation({
    mutationFn: async () => {
      const detailsResponse = await fetch(`/api/places/details?place_id=${result.place_id}`);
      const detailsData = await detailsResponse.json();
      if (!detailsData.place) throw new Error("Failed to get place details");
      const response = await apiRequest("/api/saved-places", {
        method: "POST",
        body: JSON.stringify({ ...detailsData.place, hasBeen: false }),
      }) as SavedPlaceResult;
      return response;
    },
    onSuccess: (data) => {
      setIsSaved(true);
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      toast.success("Saved!");
      onSaved(data.savedPlace);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save place"),
  });

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSaved && !savePlaceMutation.isPending) {
      savePlaceMutation.mutate();
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 hover:bg-accent"
      data-testid={`search-result-${result.place_id}`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{result.structured_formatting.main_text}</p>
        <p className="text-xs text-muted-foreground truncate">{result.structured_formatting.secondary_text}</p>
      </div>
      
      <div className="flex items-center flex-shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={isSaved ? "default" : "ghost"}
              onClick={handleSaveClick}
              disabled={savePlaceMutation.isPending}
              data-testid={`button-save-${result.place_id}`}
            >
              {savePlaceMutation.isPending ? (
                <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
              ) : (
                <HugeiconsIcon icon={Bookmark01Icon} className={isSaved ? "h-4 w-4 fill-current" : "h-4 w-4"} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isSaved ? "Saved" : "Save"}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function SaveDrawer({
  drawerPlace,
  onClose,
}: {
  drawerPlace: {
    prediction: PlacePrediction;
    savedData: { id: string; placeId: string; hasBeen: boolean; rating: number | null };
  } | null;
  onClose: () => void;
}) {
  const [savedData, setSavedData] = useState(drawerPlace?.savedData || null);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [optimisticLists, setOptimisticLists] = useState<string[]>([]);

  useEffect(() => {
    if (drawerPlace) {
      setSavedData(drawerPlace.savedData);
      setOptimisticLists([]);
      setShowCreateInput(false);
      setNewListName("");
    }
  }, [drawerPlace]);

  const currentRating = savedData?.rating ?? null;
  const hasBeen = savedData?.hasBeen ?? false;

  const { data: listsData, isLoading: listsLoading } = useQuery<{ lists: ListData[] }>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("/api/lists"),
    enabled: !!drawerPlace,
  });

  const lists = listsData?.lists || [];

  const updateSavedPlaceMutation = useMutation({
    mutationFn: async ({ hasBeen, rating }: { hasBeen?: boolean; rating?: number }) => {
      if (!savedData) return;
      return apiRequest(`/api/saved-places/${savedData.id}`, {
        method: "PATCH",
        body: JSON.stringify({ hasBeen, rating }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update");
    },
  });

  const addToListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const placeId = savedData?.placeId;
      if (!placeId) throw new Error("Place must be saved first");
      return apiRequest(`/api/lists/${listId}/places`, {
        method: "POST",
        body: JSON.stringify({ placeId }),
      });
    },
    onMutate: async (listId: string) => {
      setOptimisticLists(prev => [...prev, listId]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      toast.success("Added to list!");
    },
    onError: (error: Error, listId: string) => {
      setOptimisticLists(prev => prev.filter(id => id !== listId));
      toast.error(error.message || "Failed to add to list");
    },
  });

  const removeFromListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const placeId = savedData?.placeId;
      return apiRequest(`/api/lists/${listId}/places`, {
        method: "DELETE",
        body: JSON.stringify({ placeId }),
      });
    },
    onMutate: async (listId: string) => {
      setOptimisticLists(prev => prev.filter(id => id !== listId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      toast.success("Removed from list");
    },
    onError: (error: Error, listId: string) => {
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

  const handleRatingSelect = (rating: number) => {
    if (!savedData) return;
    const newRating = currentRating === rating ? undefined : rating;
    const newHasBeen = newRating !== undefined;
    updateSavedPlaceMutation.mutate({ hasBeen: newHasBeen, rating: newRating });
    if (newRating !== undefined) {
      setSavedData(prev => prev ? { ...prev, rating: newRating, hasBeen: true } : null);
    } else {
      setSavedData(prev => prev ? { ...prev, rating: null, hasBeen: false } : null);
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

  return (
    <Drawer open={!!drawerPlace} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DrawerContent data-testid="save-drawer">
        <DrawerHeader className="text-left">
          <DrawerTitle data-testid="drawer-place-name">
            {drawerPlace?.prediction.structured_formatting.main_text}
          </DrawerTitle>
          <DrawerDescription>
            {drawerPlace?.prediction.structured_formatting.secondary_text}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-sm font-medium">
              Been here?
              <Tooltip>
                <TooltipTrigger asChild>
                  <HugeiconsIcon icon={InformationCircleIcon} className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  Rate places you've been to help drive recommendations
                </TooltipContent>
              </Tooltip>
            </div>
            <ToggleGroup
              type="single"
              value={hasBeen && currentRating ? String(currentRating) : ""}
              onValueChange={(value) => {
                if (value) {
                  handleRatingSelect(Number(value));
                } else if (hasBeen) {
                  handleRatingSelect(currentRating!);
                }
              }}
              variant="outline"
              className="w-full"
            >
              {RATING_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={String(option.value)}
                  disabled={updateSavedPlaceMutation.isPending}
                  data-testid={`drawer-rating-${option.value}`}
                  className="flex-1 gap-1"
                >
                  <span className="text-base">{option.emoji}</span>
                  <span className="text-xs">{option.label}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Lists</p>
            {listsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : lists.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lists yet</p>
            ) : (
              <div className="space-y-1">
                {lists.map((list) => {
                  const isInList = optimisticLists.includes(list.id);
                  return (
                    <Button
                      key={list.id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2"
                      onClick={() => handleListToggle(list.id)}
                      disabled={addToListMutation.isPending || removeFromListMutation.isPending}
                      data-testid={`drawer-list-${list.id}`}
                    >
                      <span className="flex-1 truncate text-left">{list.name}</span>
                      {isInList && <HugeiconsIcon icon={Tick01Icon} className="h-4 w-4" />}
                    </Button>
                  );
                })}
              </div>
            )}
            
            {showCreateInput ? (
              <div className="space-y-2 pt-2 border-t">
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
                  data-testid="drawer-input-new-list"
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
                    data-testid="drawer-button-create-list"
                  >
                    Create
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setShowCreateInput(true)}
                data-testid="drawer-button-new-list"
              >
                <HugeiconsIcon icon={PlusSignIcon} className="h-4 w-4" />
                Create new list
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
