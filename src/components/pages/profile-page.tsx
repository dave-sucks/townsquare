"use client";

import { useState, useCallback, useRef } from "react";
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
  status: "WANT" | "BEEN";
  createdAt: string;
  place: Place;
}

interface ReviewData {
  id: string;
  rating: number;
  note: string | null;
  visitedAt: string | null;
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
  reviews: ReviewData[];
}

interface ProfilePageProps {
  username: string;
  currentUser: UserData | null;
  isAuthenticated: boolean;
}

export function ProfilePage({ username, currentUser, isAuthenticated }: ProfilePageProps) {
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const reviewRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { data, isLoading, error } = useQuery<ProfileData>({
    queryKey: ["user-profile", username],
    queryFn: () => apiRequest(`/api/users/${username}`),
    enabled: isAuthenticated,
  });

  const allPlaces = data?.allSavedPlaces || [];
  const selectedPlace = selectedPlaceId ? allPlaces.find(sp => sp.id === selectedPlaceId) : null;

  const handlePlaceSelect = useCallback((savedPlaceId: string) => {
    setSelectedPlaceId(savedPlaceId);
    setSelectedReviewId(null);
    setSheetOpen(true);
  }, []);

  const handleReviewSelect = useCallback((reviewId: string) => {
    setSelectedReviewId(reviewId);
    const review = data?.reviews.find(r => r.id === reviewId);
    if (review) {
      const place = allPlaces.find(p => p.place.id === review.place.id);
      if (place) {
        setSelectedPlaceId(place.id);
        setSheetOpen(true);
      }
    }
  }, [data?.reviews, allPlaces]);

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
      reviews={data.reviews}
      selectedReviewId={selectedReviewId}
      onReviewSelect={handleReviewSelect}
      reviewRowRefs={reviewRowRefs}
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
      onToggleStatus={() => {}}
      onDelete={() => {}}
      onAddToList={() => {}}
      isUpdating={false}
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
