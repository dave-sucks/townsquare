"use client";

import { PlaceListPanel } from "@/components/panels/place-list-panel";
import { PlaceDetailPanel } from "@/components/place-detail-panel";
import { MapSettingsPanel } from "@/components/panels/map-settings-panel";
import type { SidebarInjectedProps } from "@/components/map/map-layout";

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
  userId: string;
  placeId: string;
  hasBeen: boolean;
  rating: number | null;
  visitedAt: string | null;
  createdAt: string;
  place: Place;
}

interface Review {
  id: string;
  rating: number;
  note: string | null;
}

export type SidebarView = "list" | "settings" | "detail";

interface DiscoverSidebarProps extends Partial<SidebarInjectedProps> {
  places: SavedPlace[];
  isLoading: boolean;
  statusFilter: "all" | "want" | "been";
  listFilter: string;
  onStatusFilterChange: (value: "all" | "want" | "been") => void;
  onListFilterChange: (listId: string) => void;
  
  // View state managed by parent
  currentView: SidebarView;
  viewingPlaceId: string | null;
  onNavigate: (view: SidebarView, placeId?: string | null) => void;
  
  // Review data
  reviewsByPlaceId?: Map<string, Review>;
  
  // Actions
  onDeletePlace?: (savedPlaceId: string) => void;
  onAddReview?: (placeId: string, placeName: string) => void;
  isDeleting?: boolean;
}

export function DiscoverSidebar({
  places,
  isLoading,
  selectedPlaceId,
  onPlaceSelect,
  placeRowRefs,
  statusFilter,
  listFilter,
  onStatusFilterChange,
  onListFilterChange,
  currentView,
  viewingPlaceId,
  onNavigate,
  reviewsByPlaceId,
  onDeletePlace,
  onAddReview,
  isDeleting,
}: DiscoverSidebarProps) {
  // Get viewing place data if in detail view
  const viewingPlace = viewingPlaceId ? places.find((p) => p.id === viewingPlaceId) : null;
  const viewingReview = viewingPlace ? reviewsByPlaceId?.get(viewingPlace.placeId) : null;

  // Handle place click - navigate to detail and optionally select on map
  const handlePlaceClick = (savedPlaceId: string) => {
    onNavigate("detail", savedPlaceId);
    onPlaceSelect?.(savedPlaceId);
  };

  // Render the appropriate panel based on currentView
  switch (currentView) {
    case "settings":
      return (
        <MapSettingsPanel
          onBack={() => onNavigate("list")}
        />
      );

    case "detail":
      if (!viewingPlace) {
        // Fallback to list if no place found
        return (
          <PlaceListPanel
            places={places}
            isLoading={isLoading}
            selectedPlaceId={selectedPlaceId}
            placeRowRefs={placeRowRefs}
            statusFilter={statusFilter}
            listFilter={listFilter}
            onStatusFilterChange={onStatusFilterChange}
            onListFilterChange={onListFilterChange}
            onPlaceClick={handlePlaceClick}
            onSettingsClick={() => onNavigate("settings")}
          />
        );
      }
      return (
        <PlaceDetailPanel
          savedPlace={viewingPlace}
          myReview={viewingReview}
          onBack={() => onNavigate("list")}
          onDelete={() => onDeletePlace?.(viewingPlace.id)}
          onAddReview={() => onAddReview?.(viewingPlace.placeId, viewingPlace.place.name)}
          isDeleting={isDeleting}
        />
      );

    case "list":
    default:
      return (
        <PlaceListPanel
          places={places}
          isLoading={isLoading}
          selectedPlaceId={selectedPlaceId}
          placeRowRefs={placeRowRefs}
          statusFilter={statusFilter}
          listFilter={listFilter}
          onStatusFilterChange={onStatusFilterChange}
          onListFilterChange={onListFilterChange}
          onPlaceClick={handlePlaceClick}
          onSettingsClick={() => onNavigate("settings")}
        />
      );
  }
}
