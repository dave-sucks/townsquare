"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmojiPickerPopover } from "@/components/shared/emoji-picker-popover";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  Bookmark01Icon,
  Cancel01Icon,
  Loading03Icon,
  PlusSignIcon,
  Tick01Icon,
  ArrowLeft01Icon,
} from "@hugeicons/core-free-icons";
import { queryClient, apiRequest } from "@/lib/query-client";
import { useIsMobile } from "@/hooks/use-mobile";
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
    emoji: string | null;
  };
}

const RATING_OPTIONS = [
  { value: 1, emoji: "\u{1F44E}", label: "ehh" },
  { value: 3, emoji: "\u{1F44D}", label: "liked" },
  { value: 5, emoji: "\u{1F525}", label: "loved" },
];

type SavedData = {
  id: string;
  placeId: string;
  hasBeen: boolean;
  rating: number | null;
  emoji: string | null;
};

type DrawerPlaceData = {
  prediction: PlacePrediction;
  savedData: SavedData;
};

export function FloatingSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [savedPlace, setSavedPlace] = useState<DrawerPlaceData | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const locationRequested = useRef(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!locationRequested.current && navigator.geolocation) {
      locationRequested.current = true;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    }
  }, []);

  const searchPlaces = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      let url = `/api/places/search?q=${encodeURIComponent(query)}`;
      if (userLocation) {
        url += `&lat=${userLocation.lat}&lng=${userLocation.lng}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      setSearchResults(data.predictions || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  }, [userLocation]);

  useEffect(() => {
    const debounce = setTimeout(() => searchPlaces(searchQuery), 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchPlaces]);

  const handleClear = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSavedPlace(null);
  };

  const handleSaved = (data: DrawerPlaceData) => {
    setSavedPlace(data);
  };

  const handleCloseSavePanel = () => {
    setSavedPlace(null);
    setIsFocused(false);
  };

  const showResults = !savedPlace && isFocused && (isSearching || searchResults.length > 0 || searchQuery.trim().length > 0);
  const showDesktopSavePanel = !isMobile && !!savedPlace;

  return (
    <div className="md:w-96 md:ml-auto">
      <div className="relative bg-card rounded-md shadow-lg">
        <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search for a place..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (savedPlace) setSavedPlace(null);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 300)}
          className="pl-10 pr-8 border"
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
                  onSaved={handleSaved}
                />
              ))}
            </div>
          )}
          {!isSearching && searchQuery && searchResults.length === 0 && (
            <p className="p-3 text-center text-sm text-muted-foreground">No places found</p>
          )}
        </div>
      )}

      {showDesktopSavePanel && (
        <div className="mt-2 bg-background border rounded-lg shadow-lg overflow-hidden">
          <SavePanelContent
            drawerPlace={savedPlace}
            onClose={handleCloseSavePanel}
          />
        </div>
      )}

      {isMobile && (
        <Drawer open={!!savedPlace} onOpenChange={(open) => { if (!open) handleCloseSavePanel(); }}>
          <DrawerContent data-testid="save-drawer">
            <DrawerTitle className="sr-only">Save Place</DrawerTitle>
            <SavePanelContent
              drawerPlace={savedPlace}
              onClose={handleCloseSavePanel}
              isMobileDrawer
            />
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}

function SearchResultRow({
  result,
  onSaved,
}: {
  result: PlacePrediction;
  onSaved: (data: DrawerPlaceData) => void;
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
      onSaved({ prediction: result, savedData: data.savedPlace });
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
    <button
      className="flex items-center gap-2 px-3 py-2 hover-elevate w-full text-left"
      onClick={handleSaveClick}
      disabled={savePlaceMutation.isPending}
      data-testid={`search-result-${result.place_id}`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{result.structured_formatting.main_text}</p>
        <p className="text-xs text-muted-foreground truncate">{result.structured_formatting.secondary_text}</p>
      </div>

      <div className="flex items-center flex-shrink-0">
        {savePlaceMutation.isPending ? (
          <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <HugeiconsIcon icon={Bookmark01Icon} className={isSaved ? "h-4 w-4 fill-current" : "h-4 w-4 text-muted-foreground"} />
        )}
      </div>
    </button>
  );
}

function SavePanelContent({
  drawerPlace,
  onClose,
  isMobileDrawer = false,
}: {
  drawerPlace: DrawerPlaceData | null;
  onClose: () => void;
  isMobileDrawer?: boolean;
}) {
  const [savedData, setSavedData] = useState<SavedData | null>(drawerPlace?.savedData || null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [optimisticLists, setOptimisticLists] = useState<string[]>([]);

  useEffect(() => {
    if (drawerPlace) {
      setSavedData(drawerPlace.savedData);
      setOptimisticLists([]);
      setShowCreateDialog(false);
      setNewListName("");
    }
  }, [drawerPlace]);

  const currentRating = savedData?.rating ?? null;
  const hasBeen = savedData?.hasBeen ?? false;
  const currentEmoji = savedData?.emoji ?? null;

  const { data: listsData, isLoading: listsLoading } = useQuery<{ lists: ListData[] }>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("/api/lists"),
    enabled: !!drawerPlace,
  });

  const lists = listsData?.lists || [];

  const updateSavedPlaceMutation = useMutation({
    mutationFn: async (updates: { hasBeen?: boolean; rating?: number; emoji?: string | null }) => {
      if (!savedData) return;
      return apiRequest(`/api/saved-places/${savedData.id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
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
      setShowCreateDialog(false);
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

  const handleEmojiSelect = (emoji: string | null) => {
    if (!savedData) return;
    updateSavedPlaceMutation.mutate({ emoji });
    setSavedData(prev => prev ? { ...prev, emoji } : null);
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

  if (!drawerPlace) return null;

  const placeName = drawerPlace.prediction.structured_formatting.main_text;
  const placeAddress = drawerPlace.prediction.structured_formatting.secondary_text;

  return (
    <div data-testid="save-panel">
      <div className="flex items-start gap-3 p-4 pb-3">
        {!isMobileDrawer && (
          <button
            onClick={onClose}
            className="mt-1 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-back-to-search"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-5 w-5" />
          </button>
        )}

        <EmojiPickerPopover
          emoji={currentEmoji}
          onEmojiSelect={handleEmojiSelect}
          variant="area"
          testId="save-panel-emoji-picker"
        />

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-lg leading-tight truncate" data-testid="text-save-panel-name">
              {placeName}
            </p>
            <Badge variant="secondary" className="shrink-0 text-xs" data-testid="badge-saved">
              Saved
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {placeAddress}
          </p>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Been here?</p>
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
                data-testid={`save-panel-rating-${option.value}`}
                className="flex-1 gap-1.5 py-3"
              >
                <span className="text-xl">{option.emoji}</span>
                <span className="text-sm">{option.label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Lists</p>
          {listsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : lists.length === 0 ? (
            <p className="text-sm text-muted-foreground py-1">No lists yet</p>
          ) : (
            <div className="space-y-0.5">
              {lists.map((list) => {
                const isInList = optimisticLists.includes(list.id);
                return (
                  <button
                    key={list.id}
                    className="flex items-center gap-3 w-full text-left py-3 px-2 rounded-md hover-elevate transition-colors"
                    onClick={() => handleListToggle(list.id)}
                    disabled={addToListMutation.isPending || removeFromListMutation.isPending}
                    data-testid={`save-panel-list-${list.id}`}
                  >
                    <span className="flex-1 text-base font-medium truncate">{list.name}</span>
                    {isInList && <HugeiconsIcon icon={Tick01Icon} className="h-5 w-5 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          <button
            className="flex items-center gap-3 w-full text-left py-3 px-2 rounded-md hover-elevate text-muted-foreground transition-colors"
            onClick={() => setShowCreateDialog(true)}
            data-testid="save-panel-button-new-list"
          >
            <HugeiconsIcon icon={PlusSignIcon} className="h-5 w-5" />
            <span className="text-base font-medium">Create new list</span>
          </button>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={(o) => { setShowCreateDialog(o); if (!o) setNewListName(""); }}>
        <DialogContent className="z-[300]">
          <DialogHeader>
            <DialogTitle>Create new list</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="List name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateList();
              }
            }}
            autoFocus
            style={{ fontSize: "16px" }}
            data-testid="save-panel-input-new-list"
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
              onClick={handleCreateList}
              disabled={createListMutation.isPending || !newListName.trim()}
              data-testid="save-panel-button-create-list"
            >
              {createListMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
