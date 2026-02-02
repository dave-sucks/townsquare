"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapLayout } from "@/components/map/map-layout";
import { UserSidebar } from "@/components/sidebars/user-sidebar";
import { PlaceDetailsSheet } from "@/components/place-details-sheet";
import { apiRequest } from "@/lib/query-client";
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
  lat: number;
  lng: number;
  primaryType: string | null;
  types: string[] | null;
  priceLevel: string | null;
  photoRefs: string[] | null;
}

interface SavedPlace {
  id: string;
  placeId: string;
  hasBeen: boolean;
  rating: number | null;
  createdAt: string;
  place: Place;
}

interface ListData {
  id: string;
  name: string;
  visibility: "PRIVATE" | "PUBLIC";
  listPlaces: Array<{ placeId: string }>;
  _count: { listPlaces: number };
}

interface ActivityData {
  id: string;
  actorId: string;
  type: "PLACE_SAVED" | "PLACE_MARKED_BEEN" | "PLACE_ADDED_TO_LIST" | "LIST_CREATED" | "REVIEW_CREATED";
  placeId: string | null;
  listId: string | null;
  metadata: { placeName?: string; listName?: string; rating?: number; note?: string; review_preview?: string } | null;
  createdAt: string;
  actor: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
  place: {
    id: string;
    googlePlaceId: string;
    name: string;
    formattedAddress: string;
    photoRefs?: string[] | null;
  } | null;
  list: {
    id: string;
    name: string;
    visibility: string;
    userId: string;
  } | null;
}

interface ProfileData {
  user: UserData;
  isOwnProfile: boolean;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  wantPlaces: SavedPlace[];
  beenPlaces: SavedPlace[];
  allSavedPlaces: SavedPlace[];
  lists: ListData[];
  activities: ActivityData[];
}

interface ProfilePageProps {
  username: string;
  currentUser: UserData | null;
  isAuthenticated: boolean;
}

export function ProfilePage({ username, currentUser, isAuthenticated }: ProfilePageProps) {
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading, error } = useQuery<ProfileData>({
    queryKey: ["user-profile", username],
    queryFn: () => apiRequest(`/api/users/${username}`),
    enabled: isAuthenticated,
  });

  const allPlaces = data?.allSavedPlaces || [];
  const selectedPlace = selectedPlaceId ? allPlaces.find(sp => sp.id === selectedPlaceId) : null;

  const handlePlaceSelect = useCallback((savedPlaceId: string) => {
    setSelectedPlaceId(savedPlaceId);
    setSheetOpen(true);
  }, []);

  if (!isAuthenticated) {
    return (
      <AppShell user={null}>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Please sign in to view profiles</p>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell user={currentUser}>
        <div className="flex items-center justify-center h-full">
          <p className="text-destructive">Error loading profile</p>
        </div>
      </AppShell>
    );
  }

  if (isLoading || !data) {
    return (
      <AppShell user={currentUser}>
        <div className="flex items-center justify-center h-full">
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
      </AppShell>
    );
  }

  const placesForMap = allPlaces.map(sp => ({
    ...sp,
    userId: data.user.id,
    visitedAt: null,
  }));

  const sidebar = (
    <UserSidebar
      user={data.user}
      isOwnProfile={data.isOwnProfile}
      isFollowing={data.isFollowing}
      followerCount={data.followerCount}
      followingCount={data.followingCount}
      places={allPlaces}
      lists={data.lists}
      activities={data.activities}
    />
  );

  const sheet = selectedPlace ? (
    <PlaceDetailsSheet
      savedPlace={{
        ...selectedPlace,
        userId: data.user.id,
        visitedAt: null,
      }}
      open={sheetOpen}
      onOpenChange={setSheetOpen}
      onDelete={() => {}}
      isDeleting={false}
    />
  ) : null;

  return (
    <MapLayout
      user={currentUser}
      places={placesForMap}
      selectedPlaceId={selectedPlaceId}
      onPlaceSelect={handlePlaceSelect}
      sheetComponent={sheet}
    >
      {sidebar}
    </MapLayout>
  );
}
