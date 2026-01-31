"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Heart, CheckCircle, ChevronUp, List } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { PlaceMap } from "@/components/place-map";
import { PlaceDetailsSheet } from "@/components/place-details-sheet";
import { AddToListDialog } from "@/components/add-to-list-dialog";
import { ReviewDialog } from "@/components/review-dialog";
import { PlacesPanel } from "@/components/places-panel";
import { AppShell } from "@/components/layout";

interface UserData {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface Place {
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

interface SavedPlace {
  id: string;
  userId: string;
  placeId: string;
  status: "WANT" | "BEEN";
  visitedAt: string | null;
  createdAt: string;
  place: Place;
}

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
  _count: { listPlaces: number };
}

interface ListWithPlaces {
  id: string;
  listPlaces: Array<{ placeId: string }>;
}

interface ReviewData {
  id: string;
  placeId: string;
  rating: number;
  note: string | null;
}

export function Dashboard({ user }: { user: UserData }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTab, setSelectedTab] = useState("all");
  const [selectedListId, setSelectedListId] = useState<string>("all");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [addToListDialogOpen, setAddToListDialogOpen] = useState(false);
  const [addToListPlaceId, setAddToListPlaceId] = useState<string | null>(null);
  const [addToListPlaceName, setAddToListPlaceName] = useState("");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewPlaceId, setReviewPlaceId] = useState<string | null>(null);
  const [reviewPlaceName, setReviewPlaceName] = useState("");
  const placeRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { data: savedPlacesData, isLoading: isLoadingPlaces } = useQuery<{ savedPlaces: SavedPlace[] }>({
    queryKey: ["saved-places"],
    queryFn: () => apiRequest("/api/saved-places"),
  });

  const savedPlaces = savedPlacesData?.savedPlaces || [];

  const { data: listsData } = useQuery<{ lists: ListData[] }>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("/api/lists"),
  });

  const lists = listsData?.lists || [];

  const { data: selectedListData } = useQuery<{ list: ListWithPlaces }>({
    queryKey: ["lists", selectedListId],
    queryFn: () => apiRequest(`/api/lists/${selectedListId}`),
    enabled: selectedListId !== "all",
  });

  const selectedListPlaceIds = selectedListData?.list?.listPlaces?.map(lp => lp.placeId) || [];

  const { data: reviewsData } = useQuery<ReviewData[]>({
    queryKey: ["my-reviews", user.id],
    queryFn: () => apiRequest(`/api/reviews?userId=${user.id}`),
  });

  const myReviews = reviewsData || [];
  const reviewsByPlaceId = new Map(myReviews.map(r => [r.placeId, r]));

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

  const savePlaceMutation = useMutation({
    mutationFn: async ({ placeId, status }: { placeId: string; status: "WANT" | "BEEN" }) => {
      const detailsResponse = await fetch(`/api/places/details?place_id=${placeId}`);
      const detailsData = await detailsResponse.json();
      if (!detailsData.place) throw new Error("Failed to get place details");
      return apiRequest("/api/saved-places", {
        method: "POST",
        body: JSON.stringify({ ...detailsData.place, status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      setSearchQuery("");
      setSearchResults([]);
      toast.success("Place saved!");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save place"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "WANT" | "BEEN" }) => {
      return apiRequest(`/api/saved-places/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      toast.success("Status updated!");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update status"),
  });

  const deletePlaceMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/saved-places/${id}`, { method: "DELETE" }),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      if (selectedPlaceId === deletedId) {
        setSelectedPlaceId(null);
        setSheetOpen(false);
      }
      toast.success("Place removed!");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to remove place"),
  });

  const listFilteredPlaces = savedPlaces.filter((sp) => {
    if (selectedListId !== "all") return selectedListPlaceIds.includes(sp.placeId);
    return true;
  });

  const filteredPlaces = listFilteredPlaces.filter((sp) => {
    if (selectedTab === "all") return true;
    if (selectedTab === "want") return sp.status === "WANT";
    if (selectedTab === "been") return sp.status === "BEEN";
    return true;
  });

  useEffect(() => {
    if (selectedPlaceId && !filteredPlaces.find(sp => sp.id === selectedPlaceId)) {
      setSelectedPlaceId(null);
      setSheetOpen(false);
    }
  }, [filteredPlaces, selectedPlaceId]);

  const selectedPlace = selectedPlaceId ? filteredPlaces.find(sp => sp.id === selectedPlaceId) : null;

  const handleListItemClick = useCallback((savedPlaceId: string) => {
    setSelectedPlaceId(savedPlaceId);
  }, []);

  const handleMarkerClick = useCallback((savedPlaceId: string) => {
    setSelectedPlaceId(savedPlaceId);
    const rowElement = placeRowRefs.current.get(savedPlaceId);
    if (rowElement) rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleAddToList = useCallback((placeId: string, placeName: string) => {
    setAddToListPlaceId(placeId);
    setAddToListPlaceName(placeName);
    setAddToListDialogOpen(true);
  }, []);

  const handleAddReview = useCallback((placeId: string, placeName: string) => {
    setReviewPlaceId(placeId);
    setReviewPlaceName(placeName);
    setReviewDialogOpen(true);
  }, []);

  const handleToggleStatus = useCallback((id: string) => {
    const place = savedPlaces.find(p => p.id === id);
    if (place) {
      updateStatusMutation.mutate({ id, status: place.status === "WANT" ? "BEEN" : "WANT" });
    }
  }, [savedPlaces, updateStatusMutation]);

  const handleDelete = useCallback((id: string) => {
    deletePlaceMutation.mutate(id);
  }, [deletePlaceMutation]);

  return (
    <AppShell user={user}>
      <div className="relative flex-1 overflow-hidden">
        <PlaceMap
          places={filteredPlaces}
          selectedPlaceId={selectedPlaceId}
          onMarkerClick={handleMarkerClick}
          showSettings={true}
        />

        <div className="absolute top-3 left-1/2 -translate-x-1/2 md:left-[calc(20rem+1.5rem)] md:translate-x-0 z-10 w-80 max-w-[calc(100vw-2rem)]">
          <div className="bg-white/90 dark:bg-background/90 backdrop-blur-md rounded-lg shadow-lg border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search for a place..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                data-testid="input-search-place"
              />
            </div>
            {(isSearching || searchResults.length > 0 || (searchQuery && searchResults.length === 0)) && (
              <div className="border-t max-h-60 overflow-y-auto">
                {isSearching && (
                  <div className="space-y-2 p-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                )}
                {!isSearching && searchResults.length > 0 && (
                  <div className="py-1">
                    {searchResults.map((result) => (
                      <div 
                        key={result.place_id} 
                        className="px-3 py-2 hover-elevate cursor-pointer" 
                        data-testid={`search-result-${result.place_id}`}
                      >
                        <p className="font-medium text-sm">{result.structured_formatting.main_text}</p>
                        <p className="text-xs text-muted-foreground truncate">{result.structured_formatting.secondary_text}</p>
                        <div className="mt-1.5 flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => savePlaceMutation.mutate({ placeId: result.place_id, status: "WANT" })}
                            disabled={savePlaceMutation.isPending}
                            data-testid={`button-save-want-${result.place_id}`}
                          >
                            <Heart className="mr-1 h-3 w-3" />Want
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => savePlaceMutation.mutate({ placeId: result.place_id, status: "BEEN" })}
                            disabled={savePlaceMutation.isPending}
                            data-testid={`button-save-been-${result.place_id}`}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />Been
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!isSearching && searchQuery && searchResults.length === 0 && (
                  <p className="p-3 text-center text-sm text-muted-foreground">No places found</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="absolute top-0 left-0 bottom-0 z-10 w-80 p-3 hidden md:block">
          <div className="h-full bg-background rounded-lg border shadow-lg overflow-hidden">
            <PlacesPanel
              places={filteredPlaces}
              lists={lists}
              isLoading={isLoadingPlaces}
              selectedPlaceId={selectedPlaceId}
              selectedTab={selectedTab}
              selectedListId={selectedListId}
              listFilteredPlaces={listFilteredPlaces}
              onTabChange={setSelectedTab}
              onListChange={setSelectedListId}
              onPlaceSelect={handleListItemClick}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
              isUpdating={updateStatusMutation.isPending}
              isDeleting={deletePlaceMutation.isPending}
              placeRowRefs={placeRowRefs}
            />
          </div>
        </div>

        <div 
          className={`absolute left-0 right-0 bottom-0 z-10 md:hidden bg-background rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] transition-all duration-300 ease-out ${
            mobileSheetOpen ? 'h-[70vh]' : 'h-auto'
          }`}
          data-testid="mobile-places-panel"
        >
          <button
            onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
            className="w-full flex flex-col items-center py-2 cursor-pointer"
            data-testid="button-mobile-places-toggle"
          >
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mb-2" />
            <div className="flex items-center gap-2 text-sm font-medium">
              <List className="h-4 w-4" />
              My Places ({filteredPlaces.length})
              <ChevronUp className={`h-4 w-4 transition-transform ${mobileSheetOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {mobileSheetOpen && (
            <div className="flex-1 overflow-hidden h-[calc(70vh-48px)]">
              <PlacesPanel
                places={filteredPlaces}
                lists={lists}
                isLoading={isLoadingPlaces}
                selectedPlaceId={selectedPlaceId}
                selectedTab={selectedTab}
                selectedListId={selectedListId}
                listFilteredPlaces={listFilteredPlaces}
                onTabChange={setSelectedTab}
                onListChange={setSelectedListId}
                onPlaceSelect={(id) => {
                  handleListItemClick(id);
                  setMobileSheetOpen(false);
                }}
                onToggleStatus={handleToggleStatus}
                onDelete={handleDelete}
                isUpdating={updateStatusMutation.isPending}
                isDeleting={deletePlaceMutation.isPending}
                placeRowRefs={placeRowRefs}
              />
            </div>
          )}
        </div>
      </div>

      <PlaceDetailsSheet
        savedPlace={selectedPlace || null}
        myReview={selectedPlace ? reviewsByPlaceId.get(selectedPlace.placeId) : null}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onToggleStatus={() => {
          if (selectedPlace) {
            updateStatusMutation.mutate({
              id: selectedPlace.id,
              status: selectedPlace.status === "WANT" ? "BEEN" : "WANT",
            });
          }
        }}
        onDelete={() => {
          if (selectedPlace) deletePlaceMutation.mutate(selectedPlace.id);
        }}
        onAddToList={() => {
          if (selectedPlace) handleAddToList(selectedPlace.placeId, selectedPlace.place.name);
        }}
        onAddReview={() => {
          if (selectedPlace) handleAddReview(selectedPlace.placeId, selectedPlace.place.name);
        }}
        isUpdating={updateStatusMutation.isPending}
        isDeleting={deletePlaceMutation.isPending}
      />

      {addToListPlaceId && (
        <AddToListDialog
          open={addToListDialogOpen}
          onOpenChange={setAddToListDialogOpen}
          placeId={addToListPlaceId}
          placeName={addToListPlaceName}
        />
      )}

      {reviewPlaceId && (
        <ReviewDialog
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
          placeId={reviewPlaceId}
          placeName={reviewPlaceName}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["my-reviews", user.id] })}
        />
      )}
    </AppShell>
  );
}
