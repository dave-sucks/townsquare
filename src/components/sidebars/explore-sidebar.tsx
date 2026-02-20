"use client";

import { PlaceDetailPanel } from "@/components/place-detail-panel";
import type { SidebarInjectedProps } from "@/components/map/map-layout";
import { PlacesList } from "@/components/shared/places-list";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
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

interface CurrentUserPlaceData {
  savedPlaceId: string | null;
  hasBeen: boolean;
  rating: number | null;
  lists: Array<{ id: string; name: string }>;
}

interface ListData {
  id: string;
  name: string;
  _count: { listPlaces: number };
}

const statusOptions = [
  { value: "all", label: "All" },
  { value: "not_visited", label: "Not visited" },
  { value: "been", label: "Been" },
] as const;

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
  statusFilter?: "all" | "not_visited" | "been";
  listFilter?: string;
  lists?: ListData[];
  onStatusFilterChange?: (value: "all" | "not_visited" | "been") => void;
  onListFilterChange?: (listId: string) => void;
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
  statusFilter = "all",
  listFilter = "all",
  lists = [],
  onStatusFilterChange,
  onListFilterChange,
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

  const selectedStatusLabel = statusOptions.find((o) => o.value === statusFilter)?.label || "All";
  const selectedListLabel = listFilter === "all"
    ? "All Lists"
    : lists.find((l) => l.id === listFilter)?.name || "All Lists";

  return (
    <div className="h-full flex flex-col bg-background" data-testid="explore-sidebar">
      <div className="flex flex-col gap-2 p-3 border-b">
        <div className="flex items-center gap-2">
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
        {onStatusFilterChange && onListFilterChange && (
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="explore-select-status-filter">
                  {selectedStatusLabel}
                  <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {statusOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onSelect={() => onStatusFilterChange(option.value)}
                    data-active={statusFilter === option.value}
                  >
                    {option.label}
                    <HugeiconsIcon icon={Tick01Icon} className={`ml-auto h-4 w-4 ${statusFilter === option.value ? "opacity-100" : "opacity-0"}`} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="explore-select-list-filter">
                  {selectedListLabel}
                  <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onSelect={() => onListFilterChange("all")}
                  data-active={listFilter === "all"}
                >
                  All Lists
                  <HugeiconsIcon icon={Tick01Icon} className={`ml-auto h-4 w-4 ${listFilter === "all" ? "opacity-100" : "opacity-0"}`} />
                </DropdownMenuItem>
                {lists.map((list) => (
                  <DropdownMenuItem
                    key={list.id}
                    onSelect={() => onListFilterChange(list.id)}
                    data-active={listFilter === list.id}
                  >
                    {list.name}
                    <HugeiconsIcon icon={Tick01Icon} className={`ml-auto h-4 w-4 ${listFilter === list.id ? "opacity-100" : "opacity-0"}`} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
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
            thumbnailMode="photo"
            currentUserPlaceData={currentUserPlaceData}
            showSavedBy={activeTab === "following"}
          />
        )}
      </div>
    </div>
  );
}
