"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlaceDetailPanel } from "@/components/place-detail-panel";
import type { SidebarInjectedProps } from "@/components/map/map-layout";
import { PlacesList } from "@/components/shared/places-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { SlidersHorizontalIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiRequest } from "@/lib/query-client";

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

const PRICE_OPTIONS = [
  { label: "$", value: "PRICE_LEVEL_INEXPENSIVE" },
  { label: "$$", value: "PRICE_LEVEL_MODERATE" },
  { label: "$$$", value: "PRICE_LEVEL_EXPENSIVE" },
  { label: "$$$$", value: "PRICE_LEVEL_VERY_EXPENSIVE" },
];

interface TagCategory {
  id: string;
  slug: string;
  displayName: string;
  tags: Array<{ id: string; slug: string; displayName: string }>;
}

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

  // Fetch tags from DB
  const { data: tagsData } = useQuery<{ categories: TagCategory[] }>({
    queryKey: ["tags"],
    queryFn: () => apiRequest("/api/tags"),
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Flatten all tags for filter chips (use first 2 categories or all if small)
  const quickTags =
    tagsData?.categories.flatMap((cat) =>
      cat.tags.map((t) => ({ label: t.displayName, slug: t.slug }))
    ) ?? [];

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
    onFiltersChange({
      ...activeFilters,
      price: activeFilters.price === price ? null : price,
    });
  };

  const clearFilters = () => {
    onFiltersChange?.({ tags: [], price: null, sort: "default" });
  };

  if (currentView === "detail" && viewingPlace) {
    return (
      <PlaceDetailPanel
        savedPlace={viewingPlace}
        onBack={() => onNavigate("list")}
        onDelete={() => {}}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-background" data-testid="explore-sidebar">
      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 p-3 border-b">
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
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative shrink-0"
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
          <PopoverContent className="w-80 p-4" align="end">
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

              {/* Tags — dynamic from DB */}
              {tagsData?.categories.map((cat) => (
                <div key={cat.slug}>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {cat.displayName}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.tags.map((tag) => (
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
                        {tag.displayName}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Loading state for tags */}
              {!tagsData && (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-7 w-16 rounded-full" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

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
            const label =
              quickTags.find((t) => t.slug === tag)?.label || tag;
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

      {/* ── Place list ───────────────────────────────────────────────────── */}
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
              activeTab === "trending"
                ? "No trending spots found"
                : activeTab === "for-you"
                ? "Nothing for you yet"
                : "No places yet"
            }
            emptySubMessage={
              activeTab === "trending"
                ? "Places with recent Instagram or TikTok posts will appear here"
                : activeTab === "for-you"
                ? "Rate some places you've visited and we'll find similar spots"
                : "Follow people to see where they're saving"
            }
          />
        )}
      </div>
    </div>
  );
}
