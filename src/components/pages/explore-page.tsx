"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { MapLayout } from "@/components/map/map-layout";
import {
  ExploreSidebar,
  type ExploreView,
  type CollectionTab,
} from "@/components/sidebars/explore-sidebar";
import type { SearchLocation } from "@/components/panels/search-panel";
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

// Optional collection overlays — null means default "Nearby"
const COLLECTION_TABS: CollectionTab[] = [
  { id: "trending", label: "Trending" },
  { id: "for-you", label: "For You" },
  { id: "following", label: "Following" },
];

export function ExplorePage({ user }: { user: UserData }) {
  useEffect(() => {
    localStorage.removeItem("twnsq-map-view");
  }, []);

  const { location: gpsLocation } = useUserLocation();
  const { radius, setRadius } = useMapSettings();

  // null = Nearby (default); one of the collection IDs = overlay
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ExploreView>("list");
  const [viewingPlaceId, setViewingPlaceId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<{
    tags: string[];
    price: string | null;
    sort: string;
  }>({ tags: [], price: null, sort: "default" });

  // Search state — lives here so SearchBar can reflect current state when panel is closed
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLocation, setSearchLocation] = useState<SearchLocation | null>(null);

  // The location used for API queries: custom takes precedence over GPS
  const activeLocation = searchLocation ?? gpsLocation;

  // Listen for radius changes from map-controls settings
  const [currentRadius, setCurrentRadius] = useState(radius);
  useEffect(() => {
    setCurrentRadius(radius);
  }, [radius]);
  useEffect(() => {
    const handler = (e: Event) => setCurrentRadius((e as CustomEvent).detail);
    window.addEventListener("map-radius-change", handler);
    return () => window.removeEventListener("map-radius-change", handler);
  }, []);

  const handleRadiusChange = useCallback(
    (r: number) => {
      setCurrentRadius(r);
      setRadius(r);
    },
    [setRadius]
  );

  const queryParams = useMemo(() => {
    const collection = activeTab ?? "nearby";
    const params = new URLSearchParams({ collection });
    if (activeLocation) {
      params.set("lat", String(activeLocation.lat));
      params.set("lng", String(activeLocation.lng));
      // Radius only applies to GPS (not a custom geocoded point)
      if (!searchLocation) {
        params.set("radius", String(currentRadius));
      }
    }
    for (const tag of activeFilters.tags) params.append("tag", tag);
    if (activeFilters.price) params.set("price", activeFilters.price);
    return params.toString();
  }, [activeTab, activeLocation, searchLocation, currentRadius, activeFilters]);

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
    queryKey: ["collections", queryParams],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams(queryParams);
      if (pageParam) params.set("cursor", pageParam as string);
      return apiRequest(`/api/collections?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // Nearby needs location; other collections can load without it
    enabled: activeTab !== null || !!activeLocation,
  });

  const rawPlaces = useMemo(
    () => infiniteData?.pages.flatMap((p) => p.places) || [],
    [infiniteData]
  );

  const currentUserPlaceData = useMemo(() => {
    if (!infiniteData) return null;
    const merged: Record<string, unknown> = {};
    for (const page of infiniteData.pages) {
      if (page.currentUserPlaceData) Object.assign(merged, page.currentUserPlaceData);
    }
    return Object.keys(merged).length > 0 ? (merged as Record<string, { savedPlaceId: string | null; hasBeen: boolean; rating: number | null; lists: Array<{ id: string; name: string }> }>) : null;
  }, [infiniteData]);

  const forYouReason = useMemo(
    () => infiniteData?.pages[0]?.reason || null,
    [infiniteData]
  );

  const places = rawPlaces;
  const mapPlaces =
    activeTab === "following"
      ? rawPlaces
      : rawPlaces.map(({ savedBy: _savedBy, ...rest }) => rest);

  // Toggle tab: clicking the active tab deselects it (back to nearby)
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab((prev) => (prev === tabId ? null : tabId));
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

  const locationLabel = searchLocation?.label ?? "Your Location";
  const isCustomLocation = !!searchLocation;

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
      activeFilters={activeFilters}
      onFiltersChange={setActiveFilters}
      forYouReason={forYouReason}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      searchLocation={searchLocation}
      onSearchLocationChange={setSearchLocation}
      radius={currentRadius}
      onRadiusChange={handleRadiusChange}
      userGpsLocation={gpsLocation}
    />
  );

  return (
    <MapLayout
      user={user}
      places={mapPlaces}
      selectedPlaceId={selectedPlaceId}
      onPlaceSelect={handlePlaceSelect}
      showSearch={true}
      searchQuery={searchQuery}
      onSearchQueryChange={(q) => {
        setSearchQuery(q);
        if (q && currentView !== "search") handleNavigate("search");
      }}
      locationLabel={locationLabel}
      isCustomLocation={isCustomLocation}
      onOpenSearch={() => handleNavigate("search")}
      onClearSearch={() => setSearchQuery("")}
      onClearLocation={() => setSearchLocation(null)}
      showAvatars={activeTab === "following"}
      disableFitToPlaces={true}
    >
      {sidebar}
    </MapLayout>
  );
}
