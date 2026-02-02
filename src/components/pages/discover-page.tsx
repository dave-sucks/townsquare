"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapLayout } from "@/components/map/map-layout";
import { DiscoverSidebar } from "@/components/sidebars/discover-sidebar";
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
  const [viewingPlaceId, setViewingPlaceId] = useState<string | null>(null);
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

  const deletePlaceMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/saved-places/${id}`, { method: "DELETE" }),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      if (selectedPlaceId === deletedId) {
        setSelectedPlaceId(null);
        setViewingPlaceId(null);
      }
      toast.success("Place removed!");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to remove place"),
  });

  const handlePlaceSelect = useCallback((savedPlaceId: string) => {
    setSelectedPlaceId(savedPlaceId);
    setViewingPlaceId(savedPlaceId);
  }, []);

  const handleViewPlace = useCallback((savedPlaceId: string | null) => {
    setViewingPlaceId(savedPlaceId);
    if (savedPlaceId) {
      setSelectedPlaceId(savedPlaceId);
    }
  }, []);

  const handleDeletePlace = useCallback((savedPlaceId: string) => {
    deletePlaceMutation.mutate(savedPlaceId);
  }, [deletePlaceMutation]);

  const handleStatusFilterChange = useCallback((value: "all" | "want" | "been") => {
    setStatusFilter(value);
    if (selectedPlaceId) {
      const willBeFiltered = savedPlaces.find(sp => sp.id === selectedPlaceId);
      if (willBeFiltered) {
        if (value === "want" && willBeFiltered.status !== "WANT") {
          setSelectedPlaceId(null);
          setViewingPlaceId(null);
        } else if (value === "been" && willBeFiltered.status !== "BEEN") {
          setSelectedPlaceId(null);
          setViewingPlaceId(null);
        }
      }
    }
  }, [selectedPlaceId, savedPlaces]);

  const handleListFilterChange = useCallback((listId: string) => {
    setListFilter(listId);
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
      viewingPlaceId={viewingPlaceId}
      onViewPlace={handleViewPlace}
      reviewsByPlaceId={reviewsByPlaceId}
      onDeletePlace={handleDeletePlace}
      onAddReview={handleAddReview}
      isDeleting={deletePlaceMutation.isPending}
    />
  );

  const dialogs = reviewPlaceId ? (
    <ReviewDialog
      open={reviewDialogOpen}
      onOpenChange={setReviewDialogOpen}
      placeId={reviewPlaceId}
      placeName={reviewPlaceName}
      onSuccess={() => queryClient.invalidateQueries({ queryKey: ["my-reviews", user.id] })}
    />
  ) : null;

  return (
    <MapLayout
      user={user}
      places={filteredPlaces}
      selectedPlaceId={selectedPlaceId}
      onPlaceSelect={handlePlaceSelect}
      showSearch={true}
      sheetComponent={dialogs}
    >
      {sidebar}
    </MapLayout>
  );
}
