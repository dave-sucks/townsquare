"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapLayout } from "@/components/map/map-layout";
import {
  ExploreSidebar,
  type ExploreView,
  type CollectionTab,
} from "@/components/sidebars/explore-sidebar";
import { apiRequest } from "@/lib/query-client";

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
  neighborhood: string | null;
  locality: string | null;
}

interface SavedPlace {
  id: string;
  userId: string | null;
  placeId: string;
  hasBeen: boolean;
  rating: number | null;
  emoji?: string | null;
  visitedAt: string | null;
  createdAt: string;
  place: Place;
  savedBy?: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  } | null;
}

const COLLECTION_TABS: CollectionTab[] = [
  { id: "following", label: "Following" },
  { id: "burgers", label: "Burgers" },
];

export function ExplorePage({ user }: { user: UserData }) {
  const [activeTab, setActiveTab] = useState("following");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ExploreView>("list");
  const [viewingPlaceId, setViewingPlaceId] = useState<string | null>(null);

  const { data: collectionData, isLoading } = useQuery<{
    places: SavedPlace[];
    currentUserPlaceData?: Record<string, { savedPlaceId: string | null; hasBeen: boolean; rating: number | null; emoji: string | null; lists: Array<{ id: string; name: string }> }>;
  }>({
    queryKey: ["collections", activeTab],
    queryFn: () => apiRequest(`/api/collections?collection=${activeTab}`),
  });

  const places = collectionData?.places || [];
  const currentUserPlaceData = collectionData?.currentUserPlaceData || null;

  const handleTabChange = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      setSelectedPlaceId(null);
      setCurrentView("list");
      setViewingPlaceId(null);
    },
    []
  );

  const handlePlaceSelect = useCallback((savedPlaceId: string) => {
    setSelectedPlaceId(savedPlaceId);
    setCurrentView("detail");
    setViewingPlaceId(savedPlaceId);
  }, []);

  const handleNavigate = useCallback(
    (view: ExploreView, placeId?: string | null) => {
      setCurrentView(view);
      if (view === "detail" && placeId) {
        setViewingPlaceId(placeId);
        setSelectedPlaceId(placeId);
      } else if (view === "list") {
        setViewingPlaceId(null);
      }
    },
    []
  );

  const sidebar = (
    <ExploreSidebar
      tabs={COLLECTION_TABS}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      places={places}
      isLoading={isLoading}
      currentView={currentView}
      viewingPlaceId={viewingPlaceId}
      onNavigate={handleNavigate}
      currentUserPlaceData={currentUserPlaceData}
    />
  );

  return (
    <MapLayout
      user={user}
      places={places}
      selectedPlaceId={selectedPlaceId}
      onPlaceSelect={handlePlaceSelect}
      showSearch={true}
      neutralMarkers={true}
    >
      {sidebar}
    </MapLayout>
  );
}
