"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { PlaceDetailPanel } from "@/components/place-detail-panel";
import type { SidebarInjectedProps } from "@/components/map/map-layout";
import { PlacesList } from "@/components/shared/places-list";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SlidersHorizontalIcon,
  Location01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const MapSettingsPanel = dynamic(
  () =>
    import("@/components/panels/map-settings-panel").then((m) => ({
      default: m.MapSettingsPanel,
    })),
  {
    loading: () => (
      <div className="p-4">
        <Skeleton className="h-8 w-full mb-2" />
        <Skeleton className="h-8 w-full" />
      </div>
    ),
  }
);

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

export interface CollectionTab {
  id: string;
  label: string;
}

export type ExploreView = "list" | "detail" | "settings";

interface CurrentUserPlaceData {
  savedPlaceId: string | null;
  hasBeen: boolean;
  rating: number | null;
  lists: Array<{ id: string; name: string }>;
}

interface ActiveFilters {
  tags: string[];
  price: string | null;
  sort: string;
}

interface ExploreSidebarProps extends Partial<SidebarInjectedProps> {
  tabs: CollectionTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  places: SavedPlace[];
  isLoading: boolean;
  currentView: ExploreView;
  viewingPlaceId: string | null;
  onNavigate: (view: ExploreView, placeId?: string | null) => void;
  currentUserPlaceData?: Record<string, CurrentUserPlaceData> | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  userLocation?: { lat: number; lng: number } | null;
  radius?: number;
  activeFilters?: ActiveFilters;
  onFiltersChange?: (filters: ActiveFilters) => void;
  forYouReason?: string | null;
}

const RADIUS_OPTIONS = [0.5, 1, 2, 5, 10];

const PRICE_OPTIONS = [
  { label: "$", value: "PRICE_LEVEL_INEXPENSIVE" },
  { label: "$$", value: "PRICE_LEVEL_MODERATE" },
  { label: "$$$", value: "PRICE_LEVEL_EXPENSIVE" },
  { label: "$$$$", value: "PRICE_LEVEL_VERY_EXPENSIVE" },
];

const QUICK_TAGS = [
  { label: "Date Night", slug: "date-night" },
  { label: "Brunch", slug: "brunch" },
  { label: "Takeout", slug: "takeout" },
  { label: "Outdoor", slug: "outdoor-seating" },
  { label: "Sushi", slug: "sushi" },
  { label: "Italian", slug: "italian" },
  { label: "Burgers", slug: "burgers" },
  { label: "Cocktails", slug: "cocktail-bar" },
];

export function ExploreSidebar({
  tabs,
  activeTab,
  onTabChange,
  places,
  isLoading,
  selectedPlaceId,
  onPlaceSelect,
  placeRowRefs,
  currentView,
  viewingPlaceId,
  onNavigate,
  currentUserPlaceData,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  userLocation,
  radius = 1,
  activeFilters = { tags: [], price: null, sort: "default" },
  onFiltersChange,
  forYouReason,
}: ExploreSidebarProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  const viewingPlace = viewingPlaceId
    ? places.find((p) => p.id === viewingPlaceId)
    : null;

  const handlePlaceClick = (savedPlaceId: string) => {
    onNavigate("detail", savedPlaceId);
    onPlaceSelect?.(savedPlaceId);
  };

  const activeFilterCount =
    activeFilters.tags.length + (activeFilters.price ? 1 : 0);

  const toggleTag = (slug: string) => {
    if (!onFiltersChange) return;
    const tags = activeFilters.tags.includes(slug)
      ? activeFilters.tags.filter((t) => t !== slug)
      : [...activeFilters.tags, slug];
    onFiltersChange({ ...activeFilters, tags });
  };

  const setPrice = (price: string | null) => {
    if (!onFiltersChange) return;
    onFiltersChange({ ...activeFilters, price: activeFilters.price === price ? null : price });
  };

  const clearFilters = () => {
    onFiltersChange?.({ tags: [], price: null, sort: "default" });
  };

  if (currentView === "settings") {
    return <MapSettingsPanel onBack={() => onNavigate("list")} />;
  }

  if (currentView === "detail" && viewingPlace) {
    return (
      <PlaceDetailPanel
        savedPlace={viewingPlace}
        onBack={() => onNavigate("list")}
        onDelete={() => {}}
      />
    );
  }

  const needsLocation = (activeTab === "nearby" || activeTab === "trending" || activeTab === "for-you") && !userLocation;

  return (
    <div className="h-full flex flex-col bg-background" data-testid="explore-sidebar">
      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 p-3 border-b">
        <SidebarTrigger className="hidden md:flex" data-testid="button-sidebar-toggle" />
        <div
          className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-none"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          data-testid="collection-tabs"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover-elevate"
              )}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter button */}
        {(activeTab === "nearby" || activeTab === "trending" || activeTab === "for-you") && (
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                data-testid="button-filter-trigger"
              >
                <HugeiconsIcon icon={SlidersHorizontalIcon} className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-foreground text-background text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Filters</h3>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Price */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Price</p>
                  <div className="flex gap-1.5">
                    {PRICE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setPrice(opt.value)}
                        className={cn(
                          "px-2.5 py-1 rounded text-xs font-medium border transition-colors",
                          activeFilters.price === opt.value
                            ? "bg-foreground text-background border-foreground"
                            : "border-input hover:bg-accent"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Category</p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_TAGS.map((tag) => (
                      <button
                        key={tag.slug}
                        onClick={() => toggleTag(tag.slug)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                          activeFilters.tags.includes(tag.slug)
                            ? "bg-foreground text-background border-foreground"
                            : "border-input hover:bg-accent"
                        )}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onNavigate("settings")}
          data-testid="button-map-settings-trigger"
        >
          <HugeiconsIcon icon={SlidersHorizontalIcon} className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Location + radius pill ────────────────────────────────────────── */}
      {(activeTab === "nearby" || activeTab === "trending" || activeTab === "for-you") && (
        <div className="px-3 py-2 border-b flex items-center gap-2 text-xs text-muted-foreground">
          <HugeiconsIcon icon={Location01Icon} className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="flex-1 truncate">
            {userLocation ? `Within ${radius} mi of your location` : "Getting your location…"}
          </span>
          {userLocation && (
            <div className="flex gap-1">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    localStorage.setItem("twnsq-map-radius", String(r));
                    window.dispatchEvent(new CustomEvent("map-radius-change", { detail: r }));
                  }}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors",
                    radius === r
                      ? "bg-foreground text-background"
                      : "hover:bg-accent"
                  )}
                >
                  {r}mi
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── For You reason ───────────────────────────────────────────────── */}
      {activeTab === "for-you" && forYouReason && (
        <div className="px-3 py-2 border-b">
          <p className="text-xs text-muted-foreground italic">{forYouReason}</p>
        </div>
      )}

      {/* ── Active filter chips ───────────────────────────────────────────── */}
      {activeFilterCount > 0 && (
        <div className="px-3 py-2 border-b flex flex-wrap gap-1.5">
          {activeFilters.tags.map((tag) => {
            const label = QUICK_TAGS.find((t) => t.slug === tag)?.label || tag;
            return (
              <Badge
                key={tag}
                variant="secondary"
                className="cursor-pointer text-xs gap-1"
                onClick={() => toggleTag(tag)}
              >
                {label}
                <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
              </Badge>
            );
          })}
          {activeFilters.price && (
            <Badge
              variant="secondary"
              className="cursor-pointer text-xs gap-1"
              onClick={() => setPrice(null)}
            >
              {PRICE_OPTIONS.find((p) => p.value === activeFilters.price)?.label}
              <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
            </Badge>
          )}
        </div>
      )}

      {/* ── Location required prompt ──────────────────────────────────────── */}
      {needsLocation && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
          <HugeiconsIcon icon={Location01Icon} className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium text-sm">Waiting for your location</p>
          <p className="text-xs text-muted-foreground">
            Allow location access to see places near you
          </p>
        </div>
      )}

      {/* ── Place list ───────────────────────────────────────────────────── */}
      {!needsLocation && (
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-16 w-16 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <PlacesList
              places={places}
              isLoading={false}
              selectedPlaceId={selectedPlaceId || null}
              onPlaceSelect={handlePlaceClick}
              placeRowRefs={placeRowRefs}
              showStatus={false}
              showSaveDropdown={true}
              hideDropdownUntilHover={true}
              thumbnailMode="photo"
              currentUserPlaceData={currentUserPlaceData}
              showSavedBy={activeTab === "following"}
              hasMore={hasMore}
              onLoadMore={onLoadMore}
              isLoadingMore={isLoadingMore}
              emptyMessage={
                activeTab === "nearby"
                  ? "No places found nearby"
                  : activeTab === "trending"
                  ? "No trending spots found"
                  : activeTab === "for-you"
                  ? "Nothing for you yet"
                  : "No places yet"
              }
              emptySubMessage={
                activeTab === "nearby"
                  ? "Try increasing your radius or searching for a specific place"
                  : activeTab === "trending"
                  ? "Places with recent Instagram or TikTok posts will appear here"
                  : activeTab === "for-you"
                  ? "Rate some places you've visited and we'll find similar spots"
                  : "Follow people to see where they're saving"
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
