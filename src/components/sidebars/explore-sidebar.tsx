"use client";

import { PlaceDetailPanel } from "@/components/place-detail-panel";
import type { SidebarInjectedProps } from "@/components/map/map-layout";
import { PlacesList } from "@/components/shared/places-list";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

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

export interface CollectionTab {
  id: string;
  label: string;
}

export type ExploreView = "list" | "detail";

interface ExploreSidebarProps extends Partial<SidebarInjectedProps> {
  tabs: CollectionTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  places: SavedPlace[];
  isLoading: boolean;
  currentView: ExploreView;
  viewingPlaceId: string | null;
  onNavigate: (view: ExploreView, placeId?: string | null) => void;
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
}: ExploreSidebarProps) {
  const viewingPlace = viewingPlaceId
    ? places.find((p) => p.id === viewingPlaceId)
    : null;

  const handlePlaceClick = (savedPlaceId: string) => {
    onNavigate("detail", savedPlaceId);
    onPlaceSelect?.(savedPlaceId);
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
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-16 w-16 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
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
            displayMode="photo"
          />
        )}
      </div>
    </div>
  );
}
