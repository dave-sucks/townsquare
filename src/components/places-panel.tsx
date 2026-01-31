"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MapPin, ChevronDown, Check } from "lucide-react";
import { PlaceRow } from "@/components/place-row";

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
  status: "WANT" | "BEEN";
  visitedAt: string | null;
  createdAt: string;
  place: Place;
}

interface ListData {
  id: string;
  name: string;
  _count: { listPlaces: number };
}

interface PlacesPanelProps {
  places: SavedPlace[];
  lists: ListData[];
  isLoading: boolean;
  selectedPlaceId: string | null;
  selectedTab: string;
  selectedListId: string;
  listFilteredPlaces: SavedPlace[];
  onTabChange: (tab: string) => void;
  onListChange: (listId: string) => void;
  onPlaceSelect: (placeId: string) => void;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
  placeRowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

const statusOptions = [
  { value: "all", label: "All" },
  { value: "want", label: "Want" },
  { value: "been", label: "Been" },
];

export function PlacesPanel({
  places,
  lists,
  isLoading,
  selectedPlaceId,
  selectedTab,
  selectedListId,
  listFilteredPlaces,
  onTabChange,
  onListChange,
  onPlaceSelect,
  onToggleStatus,
  onDelete,
  isUpdating,
  isDeleting,
  placeRowRefs,
}: PlacesPanelProps) {
  const selectedStatusLabel = statusOptions.find((o) => o.value === selectedTab)?.label || "All";
  const selectedListLabel = selectedListId === "all" 
    ? "All Lists" 
    : lists.find((l) => l.id === selectedListId)?.name || "All Lists";

  return (
    <div className="h-full flex flex-col bg-background" data-testid="places-panel">
      <div className="sticky top-0 z-10 bg-background p-2 border-b">
        <div className="flex items-center gap-2 pb-2">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <h1 className="font-semibold text-sm">Places</h1>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="select-status-filter">
                {selectedStatusLabel}
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {statusOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => onTabChange(option.value)}
                  data-active={selectedTab === option.value}
                >
                  {option.label}
                  <Check className={`ml-auto h-4 w-4 ${selectedTab === option.value ? "opacity-100" : "opacity-0"}`} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="select-list-filter">
                {selectedListLabel}
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onSelect={() => onListChange("all")}
                data-active={selectedListId === "all"}
              >
                All Lists
                <Check className={`ml-auto h-4 w-4 ${selectedListId === "all" ? "opacity-100" : "opacity-0"}`} />
              </DropdownMenuItem>
              {lists.map((list) => (
                <DropdownMenuItem
                  key={list.id}
                  onSelect={() => onListChange(list.id)}
                  data-active={selectedListId === list.id}
                >
                  {list.name}
                  <Check className={`ml-auto h-4 w-4 ${selectedListId === list.id ? "opacity-100" : "opacity-0"}`} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto p-1 gap-1 space-y-1">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : places.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MapPin className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No places yet</p>
              <p className="text-sm text-muted-foreground">Search for a place on the map to add it</p>
            </CardContent>
          </Card>
        ) : (
          places.map((savedPlace) => (
            <PlaceRow
              key={savedPlace.id}
              ref={(el) => {
                if (el) placeRowRefs.current.set(savedPlace.id, el);
                else placeRowRefs.current.delete(savedPlace.id);
              }}
              savedPlace={savedPlace}
              isSelected={savedPlace.id === selectedPlaceId}
              onSelect={() => onPlaceSelect(savedPlace.id)}
              onToggleStatus={() => onToggleStatus(savedPlace.id)}
              onDelete={() => onDelete(savedPlace.id)}
              isUpdating={isUpdating}
              isDeleting={isDeleting}
            />
          ))
        )}
      </div>
    </div>
  );
}
