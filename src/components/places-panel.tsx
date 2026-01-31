"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";
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
  return (
    <div className="h-full flex flex-col bg-background" data-testid="places-panel">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-2 p-2 border-b">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <h1 className="font-semibold text-sm">Places</h1>
        </div>
        <div className="flex gap-2 p-2">
          <Select value={selectedTab} onValueChange={onTabChange}>
            <SelectTrigger className="w-auto h-8 text-xs" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="want">Want</SelectItem>
              <SelectItem value="been">Been</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedListId} onValueChange={onListChange}>
            <SelectTrigger className="w-auto h-8 text-xs" data-testid="select-list-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lists</SelectItem>
              {lists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
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
