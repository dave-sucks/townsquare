"use client";

import { useState, useCallback, useMemo } from "react";
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
  const [statusFilter, setStatusFilter] = useState<"all" | "not_visited" | "been">("all");
  const [listFilter, setListFilter] = useState<string>("all");

  const { data: collectionData, isLoading } = useQuery<{
    places: SavedPlace[];
    currentUserPlaceData?: Record<string, { savedPlaceId: string | null; hasBeen: boolean; rating: number | null; emoji: string | null; lists: Array<{ id: string; name: string }> }>;
  }>({
    queryKey: ["collections", activeTab],
    queryFn: () => apiRequest(`/api/collections?collection=${activeTab}`),
  });

  const { data: listsData } = useQuery<{ lists: Array<{ id: string; name: string; _count: { listPlaces: number } }> }>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("/api/lists"),
  });

  const { data: selectedListData } = useQuery<{ listPlaces: Array<{ placeId: string }> }>({
    queryKey: ["lists", listFilter],
    queryFn: () => apiRequest(`/api/lists/${listFilter}`),
    enabled: listFilter !== "all",
  });

  const lists = listsData?.lists || [];
  const selectedListPlaceIds = selectedListData?.listPlaces?.map((lp: { placeId: string }) => lp.placeId) || [];

  const rawPlaces = collectionData?.places || [];
  const currentUserPlaceData = collectionData?.currentUserPlaceData || null;

  const isListDataReady = listFilter === "all" || !!selectedListData;

  const filteredPlaces = useMemo(() => {
    return rawPlaces.filter((sp) => {
      if (listFilter !== "all" && isListDataReady && !selectedListPlaceIds.includes(sp.placeId)) return false;
      if (statusFilter === "not_visited") return !sp.hasBeen;
      if (statusFilter === "been") return sp.hasBeen;
      return true;
    });
  }, [rawPlaces, statusFilter, listFilter, selectedListPlaceIds, isListDataReady]);

  const places = filteredPlaces;
  const mapPlaces = activeTab === "following"
    ? filteredPlaces
    : filteredPlaces.map(({ savedBy, ...rest }) => rest);

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

  const handleStatusFilterChange = useCallback((value: "all" | "not_visited" | "been") => {
    setStatusFilter(value);
  }, []);

  const handleListFilterChange = useCallback((listId: string) => {
    setListFilter(listId);
  }, []);

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
      statusFilter={statusFilter}
      listFilter={listFilter}
      lists={lists}
      onStatusFilterChange={handleStatusFilterChange}
      onListFilterChange={handleListFilterChange}
    />
  );

  return (
    <MapLayout
      user={user}
      places={mapPlaces}
      selectedPlaceId={selectedPlaceId}
      onPlaceSelect={handlePlaceSelect}
      showSearch={true}
      showAvatars={activeTab === "following"}
    >
      {sidebar}
    </MapLayout>
  );
}
