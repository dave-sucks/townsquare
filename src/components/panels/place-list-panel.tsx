"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Tick01Icon, SlidersHorizontalIcon } from "@hugeicons/core-free-icons";
import { apiRequest } from "@/lib/query-client";
import { PlacesList } from "@/components/shared/places-list";
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
  lists?: Array<{ id: string; name: string }>;
}

interface ListData {
  id: string;
  name: string;
  _count: { listPlaces: number };
}

interface PlaceListPanelProps extends Partial<SidebarInjectedProps> {
  places: SavedPlace[];
  isLoading: boolean;
  statusFilter: "all" | "not_visited" | "been";
  listFilter: string;
  onStatusFilterChange: (value: "all" | "not_visited" | "been") => void;
  onListFilterChange: (listId: string) => void;
  onPlaceClick: (savedPlaceId: string) => void;
  onSettingsClick: () => void;
}

const statusOptions = [
  { value: "all", label: "All" },
  { value: "not_visited", label: "Not visited" },
  { value: "been", label: "Been" },
] as const;

export function PlaceListPanel({
  places,
  isLoading,
  selectedPlaceId,
  placeRowRefs,
  statusFilter,
  listFilter,
  onStatusFilterChange,
  onListFilterChange,
  onPlaceClick,
  onSettingsClick,
}: PlaceListPanelProps) {
  const { data: listsData } = useQuery<{ lists: ListData[] }>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("/api/lists"),
  });

  const lists = listsData?.lists || [];

  const currentUserPlaceData = useMemo(() => {
    const map: Record<string, { savedPlaceId: string | null; hasBeen: boolean; rating: number | null; emoji?: string | null; lists: Array<{ id: string; name: string }> }> = {};
    for (const sp of places) {
      map[sp.placeId] = {
        savedPlaceId: sp.id,
        hasBeen: sp.hasBeen,
        rating: sp.rating,
        emoji: sp.emoji || null,
        lists: sp.lists || [],
      };
    }
    return map;
  }, [places]);

  const selectedStatusLabel = statusOptions.find((o) => o.value === statusFilter)?.label || "All";
  const selectedListLabel = listFilter === "all" 
    ? "All Lists" 
    : lists.find((l) => l.id === listFilter)?.name || "All Lists";

  return (
    <div className="h-full flex flex-col bg-background" data-testid="place-list-panel">
      <div className="flex items-center gap-2 p-3 border-b">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" data-testid="select-status-filter">
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
            <Button variant="outline" size="sm" data-testid="select-list-filter">
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
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsClick}
          data-testid="button-map-settings-trigger"
        >
          <HugeiconsIcon icon={SlidersHorizontalIcon} className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <PlacesList
          places={places}
          isLoading={isLoading}
          selectedPlaceId={selectedPlaceId || null}
          onPlaceSelect={onPlaceClick}
          placeRowRefs={placeRowRefs}
          showStatus={true}
          showSaveDropdown={true}
          hideDropdownUntilHover={true}
          thumbnailMode="my-places"
          currentUserPlaceData={currentUserPlaceData}
        />
      </div>
    </div>
  );
}
