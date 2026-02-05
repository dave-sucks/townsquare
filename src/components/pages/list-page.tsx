"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapLayout } from "@/components/map/map-layout";
import { ListSidebar } from "@/components/sidebars/list-sidebar";
import { PlaceDetailPanel } from "@/components/place-detail-panel";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
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
  neighborhood?: string | null;
  locality?: string | null;
  lat: number;
  lng: number;
  primaryType: string | null;
  types: string[] | null;
  priceLevel: string | null;
  photoRefs: string[] | null;
}

interface ListPlace {
  id: string;
  listId: string;
  placeId: string;
  addedAt: string;
  place: Place;
}

interface ListOwner {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface ListData {
  id: string;
  name: string;
  description: string | null;
  visibility: "PRIVATE" | "PUBLIC";
  userId: string;
  createdAt: string;
  user: ListOwner;
  listPlaces: ListPlace[];
}

interface CurrentUserPlaceData {
  savedPlaceId: string | null;
  hasBeen: boolean;
  rating: number | null;
  lists: Array<{ id: string; name: string }>;
}

interface ListApiResponse {
  list: ListData;
  currentUserPlaceData: Record<string, CurrentUserPlaceData> | null;
}

type SidebarView = "list" | "detail";

interface ListPageProps {
  listId: string;
  currentUser: UserData | null;
  isAuthenticated: boolean;
}

export function ListPage({ listId, currentUser, isAuthenticated }: ListPageProps) {
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<SidebarView>("list");
  const [viewingPlaceId, setViewingPlaceId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<ListApiResponse>({
    queryKey: ["lists", listId],
    queryFn: () => apiRequest(`/api/lists/${listId}`),
    enabled: isAuthenticated,
  });

  const list = data?.list;
  const currentUserPlaceData = data?.currentUserPlaceData;
  const isOwner = currentUser?.id === list?.userId;

  const removePlaceMutation = useMutation({
    mutationFn: (placeId: string) =>
      apiRequest(`/api/lists/${listId}/places/${placeId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      queryClient.invalidateQueries({ queryKey: ["lists", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      toast.success("Place removed from list");
      setCurrentView("list");
      setViewingPlaceId(null);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to remove place"),
  });

  const savedPlaces = list?.listPlaces.map(lp => ({
    id: lp.id,
    userId: list.userId,
    placeId: lp.placeId,
    hasBeen: false,
    rating: null,
    visitedAt: null,
    createdAt: lp.addedAt,
    place: lp.place,
  })) || [];

  const viewingPlace = viewingPlaceId 
    ? savedPlaces.find(sp => sp.id === viewingPlaceId)
    : null;

  const handlePlaceSelect = useCallback((savedPlaceId: string) => {
    setSelectedPlaceId(savedPlaceId);
    setViewingPlaceId(savedPlaceId);
    setCurrentView("detail");
  }, []);

  const handleBackToList = useCallback(() => {
    setCurrentView("list");
    setViewingPlaceId(null);
  }, []);

  const handleRemovePlace = useCallback((placeId: string) => {
    removePlaceMutation.mutate(placeId);
  }, [removePlaceMutation]);

  if (!isAuthenticated) {
    return (
      <AppShell user={null}>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Please sign in to view lists</p>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell user={currentUser}>
        <div className="flex items-center justify-center h-full">
          <p className="text-destructive">Error loading list</p>
        </div>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell user={currentUser}>
        <div className="flex items-center justify-center h-full">
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
      </AppShell>
    );
  }

  const sidebar = currentView === "detail" && viewingPlace ? (
    <PlaceDetailPanel
      savedPlace={viewingPlace}
      onBack={handleBackToList}
      onDelete={() => {
        if (isOwner && viewingPlace) {
          handleRemovePlace(viewingPlace.placeId);
        }
      }}
      isDeleting={removePlaceMutation.isPending}
      listsContainingPlace={[listId]}
    />
  ) : (
    <ListSidebar
      list={list || null}
      isLoading={isLoading}
      isOwner={isOwner}
      currentUserId={currentUser?.id}
      onRemovePlace={handleRemovePlace}
      isRemovingPlace={removePlaceMutation.isPending}
      selectedPlaceId={selectedPlaceId}
      onPlaceSelect={handlePlaceSelect}
      currentUserPlaceData={currentUserPlaceData || null}
    />
  );

  return (
    <MapLayout
      user={currentUser}
      places={savedPlaces}
      selectedPlaceId={selectedPlaceId}
      onPlaceSelect={handlePlaceSelect}
    >
      {sidebar}
    </MapLayout>
  );
}
