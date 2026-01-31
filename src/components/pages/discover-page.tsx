"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapLayout } from "@/components/map/map-layout";
import { DiscoverSidebar } from "@/components/sidebars/discover-sidebar";
import { PlaceDetailsSheet } from "@/components/place-details-sheet";
import { AddToListDialog } from "@/components/add-to-list-dialog";
import { ReviewDialog } from "@/components/review-dialog";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";

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

interface ReviewData {
  id: string;
  placeId: string;
  rating: number;
  note: string | null;
}

interface ListWithPlaces {
  id: string;
  listPlaces: Array<{ placeId: string }>;
}

export function DiscoverPage({ user }: { user: UserData }) {
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [addToListDialogOpen, setAddToListDialogOpen] = useState(false);
  const [addToListPlaceId, setAddToListPlaceId] = useState<string | null>(null);
  const [addToListPlaceName, setAddToListPlaceName] = useState("");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewPlaceId, setReviewPlaceId] = useState<string | null>(null);
  const [reviewPlaceName, setReviewPlaceName] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "want" | "been">("all");
  const [listFilter, setListFilter] = useState<string>("all");

  const { data: savedPlacesData, isLoading } = useQuery<{ savedPlaces: SavedPlace[] }>({
    queryKey: ["saved-places"],
    queryFn: () => apiRequest("/api/saved-places"),
  });

  const savedPlaces = savedPlacesData?.savedPlaces || [];

  const { data: reviewsData } = useQuery<ReviewData[]>({
    queryKey: ["my-reviews", user.id],
    queryFn: () => apiRequest(`/api/reviews?userId=${user.id}`),
  });

  const { data: selectedListData } = useQuery<{ list: ListWithPlaces }>({
    queryKey: ["lists", listFilter],
    queryFn: () => apiRequest(`/api/lists/${listFilter}`),
    enabled: listFilter !== "all",
  });

  const myReviews = reviewsData || [];
  const reviewsByPlaceId = new Map(myReviews.map(r => [r.placeId, r]));

  const selectedListPlaceIds = useMemo(() => {
    return selectedListData?.list?.listPlaces?.map(lp => lp.placeId) || [];
  }, [selectedListData]);

  const filteredPlaces = useMemo(() => {
    return savedPlaces.filter((sp) => {
      if (listFilter !== "all" && !selectedListPlaceIds.includes(sp.placeId)) {
        return false;
      }
      if (statusFilter === "want") return sp.status === "WANT";
      if (statusFilter === "been") return sp.status === "BEEN";
      return true;
    });
  }, [savedPlaces, statusFilter, listFilter, selectedListPlaceIds]);

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

  const selectedPlace = selectedPlaceId ? filteredPlaces.find(sp => sp.id === selectedPlaceId) : null;

  const handlePlaceSelect = useCallback((savedPlaceId: string) => {
    setSelectedPlaceId(savedPlaceId);
    setSheetOpen(true);
  }, []);

  const handleStatusFilterChange = useCallback((value: "all" | "want" | "been") => {
    setStatusFilter(value);
    if (selectedPlaceId) {
      const willBeFiltered = savedPlaces.find(sp => sp.id === selectedPlaceId);
      if (willBeFiltered) {
        if (value === "want" && willBeFiltered.status !== "WANT") {
          setSelectedPlaceId(null);
          setSheetOpen(false);
        } else if (value === "been" && willBeFiltered.status !== "BEEN") {
          setSelectedPlaceId(null);
          setSheetOpen(false);
        }
      }
    }
  }, [selectedPlaceId, savedPlaces]);

  const handleListFilterChange = useCallback((listId: string) => {
    setListFilter(listId);
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

  const sidebar = (
    <DiscoverSidebar
      places={filteredPlaces}
      isLoading={isLoading}
      statusFilter={statusFilter}
      listFilter={listFilter}
      onStatusFilterChange={handleStatusFilterChange}
      onListFilterChange={handleListFilterChange}
    />
  );

  const sheet = (
    <>
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
    </>
  );

  return (
    <MapLayout
      user={user}
      places={filteredPlaces}
      selectedPlaceId={selectedPlaceId}
      onPlaceSelect={handlePlaceSelect}
      sheetComponent={sheet}
    >
      {sidebar}
    </MapLayout>
  );
}
