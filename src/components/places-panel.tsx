"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, ChevronUp, ChevronDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
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
  selectedListId: string;
  selectedTab: string;
  listFilteredPlaces: SavedPlace[];
  onListChange: (listId: string) => void;
  onTabChange: (tab: string) => void;
  onPlaceSelect: (placeId: string) => void;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
  placeRowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

type BottomSheetState = "collapsed" | "half" | "full";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

export function PlacesPanel({
  places,
  lists,
  isLoading,
  selectedPlaceId,
  selectedListId,
  selectedTab,
  listFilteredPlaces,
  onListChange,
  onTabChange,
  onPlaceSelect,
  onToggleStatus,
  onDelete,
  isUpdating,
  isDeleting,
  placeRowRefs,
}: PlacesPanelProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [bottomSheetState, setBottomSheetState] = useState<BottomSheetState>("half");
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartState = useRef<BottomSheetState>("half");

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    dragStartState.current = bottomSheetState;
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (dragStartY.current === null) return;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const delta = dragStartY.current - clientY;

    if (dragStartState.current === "collapsed" && delta > 50) {
      setBottomSheetState("half");
    } else if (dragStartState.current === "half") {
      if (delta > 50) setBottomSheetState("full");
      else if (delta < -50) setBottomSheetState("collapsed");
    } else if (dragStartState.current === "full" && delta < -50) {
      setBottomSheetState("half");
    }
  };

  const handleDragEnd = () => {
    dragStartY.current = null;
  };

  const PlacesList = (
    <>
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
            <p className="text-sm text-muted-foreground">Add your first place to get started</p>
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
    </>
  );

  const FilterControls = (
    <div className="flex flex-col gap-2 p-3 border-b bg-background/80 backdrop-blur-sm">
      <Select value={selectedListId} onValueChange={onListChange}>
        <SelectTrigger className="w-full" data-testid="select-list-filter">
          <SelectValue placeholder="All Places" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Places</SelectItem>
          {lists.map((list) => (
            <SelectItem key={list.id} value={list.id}>
              {list.name} ({list._count.listPlaces})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant={selectedTab === "all" ? "default" : "ghost"}
          onClick={() => onTabChange("all")}
          data-testid="tab-all"
          className="flex-1"
        >
          All ({listFilteredPlaces.length})
        </Button>
        <Button
          size="sm"
          variant={selectedTab === "want" ? "default" : "ghost"}
          onClick={() => onTabChange("want")}
          data-testid="tab-want"
          className="flex-1"
        >
          Want ({listFilteredPlaces.filter((p) => p.status === "WANT").length})
        </Button>
        <Button
          size="sm"
          variant={selectedTab === "been" ? "default" : "ghost"}
          onClick={() => onTabChange("been")}
          data-testid="tab-been"
          className="flex-1"
        >
          Been ({listFilteredPlaces.filter((p) => p.status === "BEEN").length})
        </Button>
      </div>
    </div>
  );

  if (isDesktop) {
    if (isCollapsed) {
      return (
        <div
          className="absolute top-4 left-4 z-20 w-12 h-12 bg-background border rounded-lg shadow-lg"
          data-testid="places-panel-desktop"
        >
          <button
            onClick={() => setIsCollapsed(false)}
            className="flex items-center justify-center w-full h-full hover-elevate rounded-lg"
            data-testid="button-expand-panel"
          >
            <MapPin className="h-5 w-5" />
          </button>
        </div>
      );
    }

    return (
      <div
        className="absolute top-4 left-4 z-20 w-80 max-h-[calc(100vh-140px)] bg-background border rounded-lg shadow-lg overflow-hidden flex flex-col"
        data-testid="places-panel-desktop"
      >
        <div className="flex-shrink-0 flex items-center justify-between gap-2 p-2 border-b">
          <span className="text-sm font-medium pl-2">Places</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(true)}
            data-testid="button-collapse-panel"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-shrink-0">
          {FilterControls}
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-3 space-y-2">
            {PlacesList}
          </div>
        </div>
      </div>
    );
  }

  const sheetHeight =
    bottomSheetState === "collapsed"
      ? "h-16"
      : bottomSheetState === "half"
      ? "h-[45vh]"
      : "h-[85vh]";

  return (
    <div
      ref={sheetRef}
      className={cn(
        "fixed bottom-0 left-0 right-0 z-20 bg-background border-t rounded-t-2xl shadow-lg transition-all duration-300 flex flex-col",
        sheetHeight
      )}
      data-testid="places-panel-mobile"
    >
      <div
        className="flex-shrink-0 flex items-center justify-center py-2 cursor-grab active:cursor-grabbing"
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
      </div>
      <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 pb-2">
        <span className="text-sm font-medium">
          {places.length} {places.length === 1 ? "place" : "places"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setBottomSheetState(
                bottomSheetState === "collapsed"
                  ? "half"
                  : bottomSheetState === "half"
                  ? "full"
                  : "half"
              )
            }
            data-testid="button-toggle-sheet"
          >
            {bottomSheetState === "full" ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      {bottomSheetState !== "collapsed" && (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {FilterControls}
          <div className="p-3 space-y-2">
            {PlacesList}
          </div>
        </div>
      )}
    </div>
  );
}
