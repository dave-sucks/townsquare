"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { MapLayout } from "@/components/map/map-layout";
import {
  ExploreSidebar,
  type ExploreView,
  type CollectionTab,
} from "@/components/sidebars/explore-sidebar";
import { apiRequest } from "@/lib/query-client";
import { useUserLocation } from "@/hooks/use-user-location";
import { useMapSettings } from "@/hooks/use-map-settings";

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
  topTags?: Array<{ id: string; slug: string; displayName: string; categorySlug: string }>;
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
  saveCount?: number;
  trendingCount?: number;
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
  { id: "nearby", label: "Nearby" },
  { id: "trending", label: "Trending" },
  { id: "for-you", label: "For You" },
  { id: "following", label: "Following" },
];

export function ExplorePage({ user }: { user: UserData }) {
  useEffect(() => {
    localStorage.removeItem("twnsq-map-view");
  }, []);

  const { location } = useUserLocation();
  const { radius } = useMapSettings();

  const [activeTab, setActiveTab] = useState("nearby");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ExploreView>("list");
  const [viewingPlaceId, setViewingPlaceId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<{
    tags: string[];
    price: string | null;
    sort: string;
  }>({ tags: [], price: null, sort: "default" });

  // Listen for radius changes from map settings
  const [currentRadius, setCurrentRadius] = useState(radius);
  useEffect(() => {
    setCurrentRadius(radius);
  }, [radius]);
  useEffect(() => {
    const handler = (e: Event) => {
      setCurrentRadius((e as CustomEvent).detail);
    };
    window.addEventListener("map-radius-change", handler);
    return () => window.removeEventListener("map-radius-change", handler);
  }, []);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ collection: activeTab });
    if (location) {
      params.set("lat", String(location.lat));
      params.set("lng", String(location.lng));
      params.set("radius", String(currentRadius));
    }
    for (const tag of activeFilters.tags) params.append("tag", tag);
    if (activeFilters.price) params.set("price", activeFilters.price);
    return params.toString();
  }, [activeTab, location, currentRadius, activeFilters]);

  const {
    data: infiniteData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<{
    places: SavedPlace[];
    currentUserPlaceData?: Record<
      string,
      {
        savedPlaceId: string | null;
        hasBeen: boolean;
        rating: number | null;
        emoji: string | null;
        lists: Array<{ id: string; name: string }>;
      }
    >;
    hasMore: boolean;
    nextCursor: string | null;
    reason?: string;
  }>({
    queryKey: ["collections", activeTab, queryParams],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams(queryParams);
      if (pageParam) params.set("cursor", pageParam as string);
      return apiRequest(`/api/collections?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: activeTab === "following" || !!location || activeTab !== "nearby",
  });

  const rawPlaces = useMemo(
    () => infiniteData?.pages.flatMap((p) => p.places) || [],
    [infiniteData]
  );
  const currentUserPlaceData = useMemo(() => {
    if (!infiniteData) return null;
    const merged: Record<string, any> = {};
    for (const page of infiniteData.pages) {
      if (page.currentUserPlaceData) Object.assign(merged, page.currentUserPlaceData);
    }
    return Object.keys(merged).length > 0 ? merged : null;
  }, [infiniteData]);

  const forYouReason = useMemo(() => {
    return infiniteData?.pages[0]?.reason || null;
  }, [infiniteData]);

  const places = rawPlaces;
  const mapPlaces =
    activeTab === "following" ? rawPlaces : rawPlaces.map(({ savedBy, ...rest }) => rest);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    setSelectedPlaceId(null);
    setCurrentView("list");
    setViewingPlaceId(null);
    setActiveFilters({ tags: [], price: null, sort: "default" });
  }, []);

  const handlePlaceSelect = useCallback((savedPlaceId: string) => {
    setSelectedPlaceId(savedPlaceId);
    setCurrentView("detail");
    setViewingPlaceId(savedPlaceId);
  }, []);

  const handleNavigate = useCallback((view: ExploreView, placeId?: string | null) => {
    setCurrentView(view);
    if (view === "detail" && placeId) {
      setViewingPlaceId(placeId);
      setSelectedPlaceId(placeId);
    } else if (view === "list") {
      setViewingPlaceId(null);
    }
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
      hasMore={!!hasNextPage}
      onLoadMore={() => fetchNextPage()}
      isLoadingMore={isFetchingNextPage}
      userLocation={location}
      radius={currentRadius}
      activeFilters={activeFilters}
      onFiltersChange={setActiveFilters}
      forYouReason={forYouReason}
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
      disableFitToPlaces={true}
    >
      {sidebar}
    </MapLayout>
  );
}
