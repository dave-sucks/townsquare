"use client";

import { forwardRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MapPin, Bookmark, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { SaveToListDropdown } from "./save-to-list-dropdown";
import { EmojiPickerPopover } from "./emoji-picker-popover";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";

interface Place {
  id: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  neighborhood?: string | null;
  locality?: string | null;
  lat: number;
  lng: number;
  primaryType: string | null;
  types: string[] | null;
  priceLevel: string | null;
  photoRefs: string[] | null;
}

interface ListInfo {
  id: string;
  name: string;
}

interface SavedPlace {
  id: string;
  userId?: string;
  placeId: string;
  hasBeen: boolean;
  rating: number | null;
  emoji?: string | null;
  visitedAt?: string | null;
  createdAt?: string;
  place: Place;
  lists?: ListInfo[];
}

interface CurrentUserPlaceData {
  savedPlaceId: string | null;
  hasBeen: boolean;
  rating: number | null;
  lists: Array<{ id: string; name: string }>;
}

const RATING_NAMES: Record<number, string> = {
  1: "ehh",
  3: "liked",
  5: "loved",
};

interface PlaceCardProps {
  savedPlace: SavedPlace;
  isSelected: boolean;
  showStatus?: boolean;
  showSaveDropdown?: boolean;
  hideDropdownUntilHover?: boolean;
  listsContainingPlace?: string[];
  actionButton?: React.ReactNode;
  onClick?: () => void;
  isOwnProfile?: boolean;
  currentUserData?: CurrentUserPlaceData | null;
}

function formatPlaceType(type: string | null): string {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export const PlaceCard = forwardRef<HTMLDivElement, PlaceCardProps>(
  ({ savedPlace, isSelected, showStatus = true, showSaveDropdown = false, hideDropdownUntilHover = false, listsContainingPlace = [], actionButton, onClick, isOwnProfile = true, currentUserData }, ref) => {
    const queryClient = useQueryClient();
    const placeType = formatPlaceType(savedPlace.place.primaryType);
    const locationDisplay = savedPlace.place.neighborhood 
      || savedPlace.place.locality 
      || savedPlace.place.formattedAddress.split(",")[0];
    
    const currentUserLists = isOwnProfile 
      ? (savedPlace.lists?.map(l => l.id) || listsContainingPlace)
      : (currentUserData?.lists?.map(l => l.id) || []);
    
    const currentUserSavedPlace = isOwnProfile 
      ? { id: savedPlace.id, placeId: savedPlace.placeId, hasBeen: savedPlace.hasBeen, rating: savedPlace.rating }
      : currentUserData?.savedPlaceId 
        ? { id: currentUserData.savedPlaceId, placeId: savedPlace.placeId, hasBeen: currentUserData.hasBeen, rating: currentUserData.rating }
        : null;

    const updateEmojiMutation = useMutation({
      mutationFn: async (emoji: string | null) => {
        return apiRequest(`/api/saved-places/${savedPlace.id}`, {
          method: "PATCH",
          body: JSON.stringify({ emoji }),
        });
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["saved-places"] });
        queryClient.invalidateQueries({ queryKey: ["place-detail"] });
      },
    });

    const handleEmojiSelect = (emoji: string | null) => {
      if (isOwnProfile) {
        updateEmojiMutation.mutate(emoji);
      }
    };

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        className={cn(
          "group flex items-center gap-3 p-1 rounded-md transition-colors cursor-pointer",
          isSelected ? "bg-accent" : "hover:bg-accent"
        )}
        data-testid={`place-card-${savedPlace.id}`}
        data-selected={isSelected}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
      >
        <div
          data-testid={`place-row-${savedPlace.id}`}
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          {isOwnProfile ? (
            <EmojiPickerPopover
              emoji={savedPlace.emoji || null}
              onEmojiSelect={handleEmojiSelect}
              disabled={updateEmojiMutation.isPending}
              variant="area"
              testId={`button-emoji-picker-${savedPlace.id}`}
            />
          ) : (
            <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
              {savedPlace.emoji ? (
                <span className="text-2xl">{savedPlace.emoji}</span>
              ) : (
                <MapPin className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          )}

          <div className="flex-1 min-w-0 overflow-hidden">
            <h3 className="font-medium text-sm truncate flex items-center gap-1">
              {savedPlace.place.name}
              {savedPlace.hasBeen && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <BadgeCheck className="w-4 h-4 flex-shrink-0 fill-foreground text-background" />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {isOwnProfile ? "You've been here" : "Been here"}: {savedPlace.rating ? RATING_NAMES[savedPlace.rating] : "rated"}
                  </TooltipContent>
                </Tooltip>
              )}
            </h3>
            
            {showStatus && savedPlace.lists && savedPlace.lists.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs mt-0.5">
                <span className="text-foreground truncate">
                  {savedPlace.lists.map(l => l.name).join(" · ")}
                </span>
              </div>
            )}
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">
                {locationDisplay}
                {placeType && <> — {placeType}</>}
              </span>
            </div>
          </div>
        </div>
        
        {showSaveDropdown && (
          <div 
            className={cn(
              "flex-shrink-0",
              hideDropdownUntilHover && "opacity-0 group-hover:opacity-100 transition-opacity"
            )} 
            onClick={(e) => e.stopPropagation()}
          >
            <SaveToListDropdown
              place={savedPlace.place}
              savedPlace={currentUserSavedPlace}
              listsContainingPlace={currentUserLists}
              showLabel={false}
              variant="ghost"
              size="icon"
            />
          </div>
        )}
        {actionButton}
      </div>
    );
  }
);

PlaceCard.displayName = "PlaceCard";

interface PlacesListProps {
  places: SavedPlace[];
  isLoading?: boolean;
  selectedPlaceId: string | null;
  onPlaceSelect?: (savedPlaceId: string) => void;
  placeRowRefs?: React.MutableRefObject<Map<string, HTMLDivElement>>;
  showStatus?: boolean;
  emptyMessage?: string;
  emptySubMessage?: string;
  showSaveDropdown?: boolean;
  hideDropdownUntilHover?: boolean;
  renderAction?: (savedPlace: SavedPlace) => React.ReactNode;
  isOwnProfile?: boolean;
  currentUserPlaceData?: Record<string, CurrentUserPlaceData> | null;
}

export function PlacesList({
  places,
  isLoading = false,
  selectedPlaceId,
  onPlaceSelect,
  placeRowRefs,
  showStatus = true,
  emptyMessage = "No places yet",
  emptySubMessage = "Search for a place on the map to add it",
  showSaveDropdown = false,
  hideDropdownUntilHover = false,
  renderAction,
  isOwnProfile = true,
  currentUserPlaceData,
}: PlacesListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <MapPin className="mb-4 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">{emptyMessage}</p>
        <p className="text-xs text-muted-foreground mt-1">{emptySubMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-1">
      {places.map((savedPlace) => (
        <PlaceCard
          key={savedPlace.id}
          ref={(el) => {
            if (placeRowRefs) {
              if (el) placeRowRefs.current.set(savedPlace.id, el);
              else placeRowRefs.current.delete(savedPlace.id);
            }
          }}
          savedPlace={savedPlace}
          isSelected={savedPlace.id === selectedPlaceId}
          showStatus={showStatus}
          showSaveDropdown={showSaveDropdown}
          hideDropdownUntilHover={hideDropdownUntilHover}
          actionButton={renderAction?.(savedPlace)}
          onClick={onPlaceSelect ? () => onPlaceSelect(savedPlace.id) : undefined}
          isOwnProfile={isOwnProfile}
          currentUserData={currentUserPlaceData?.[savedPlace.placeId] || null}
        />
      ))}
    </div>
  );
}
