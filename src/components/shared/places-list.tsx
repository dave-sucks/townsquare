"use client";

import { forwardRef, useRef, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon, CheckmarkBadge01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { SaveToListDropdown } from "./save-to-list-dropdown";
import { EmojiPickerPopover } from "./emoji-picker-popover";
import { TagInfo } from "./place-tags";
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
  topTags?: TagInfo[];
}

interface ListInfo {
  id: string;
  name: string;
}

interface SavedByUser {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface SavedPlace {
  id: string;
  userId?: string | null;
  placeId: string;
  hasBeen: boolean;
  rating: number | null;
  emoji?: string | null;
  visitedAt?: string | null;
  createdAt?: string;
  place: Place;
  lists?: ListInfo[];
  savedBy?: SavedByUser | null;
}

interface CurrentUserPlaceData {
  savedPlaceId: string | null;
  hasBeen: boolean;
  rating: number | null;
  emoji?: string | null;
  lists: Array<{ id: string; name: string }>;
}

const RATING_NAMES: Record<number, string> = {
  1: "ehh",
  2: "okay",
  3: "liked",
  4: "great",
  5: "loved",
};

type ThumbnailMode = "emoji" | "my-places" | "photo";

interface PlaceCardProps {
  savedPlace: SavedPlace;
  isSelected: boolean;
  showStatus?: boolean;
  showSaveDropdown?: boolean;
  hideDropdownUntilHover?: boolean;
  listsContainingPlace?: string[];
  actionButton?: React.ReactNode;
  onClick?: () => void;
  thumbnailMode?: ThumbnailMode;
  emojiEditable?: boolean;
  currentUserData?: CurrentUserPlaceData | null;
  showSavedBy?: boolean;
}

const CATEGORY_PRIORITY = [
  "restaurant",
  "bar", 
  "cafe",
  "bakery",
  "coffee_shop",
  "night_club",
  "food",
  "meal_takeaway",
  "meal_delivery",
];

function getBestCategory(primaryType: string | null, types: string[] | null): string {
  if (primaryType && CATEGORY_PRIORITY.includes(primaryType)) {
    return formatCategoryName(primaryType);
  }

  if (types && types.length > 0) {
    for (const category of CATEGORY_PRIORITY) {
      if (types.includes(category)) {
        return formatCategoryName(category);
      }
    }
    const nonGenericTypes = types.filter(t => 
      !["establishment", "point_of_interest", "food", "store"].includes(t)
    );
    if (nonGenericTypes.length > 0) {
      return formatCategoryName(nonGenericTypes[0]);
    }
  }
  
  if (primaryType && !["establishment", "point_of_interest", "food"].includes(primaryType)) {
    return formatCategoryName(primaryType);
  }
  
  if (types?.includes("restaurant")) return "Restaurant";
  
  return "";
}

function formatCategoryName(type: string): string {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export const PlaceCard = forwardRef<HTMLDivElement, PlaceCardProps>(
  ({ savedPlace, isSelected, showStatus = true, showSaveDropdown = false, hideDropdownUntilHover = false, listsContainingPlace = [], actionButton, onClick, thumbnailMode = "photo", emojiEditable = false, currentUserData, showSavedBy = false }, ref) => {
    const queryClient = useQueryClient();
    const category = getBestCategory(savedPlace.place.primaryType, savedPlace.place.types);
    const locationDisplay = savedPlace.place.neighborhood 
      || savedPlace.place.locality 
      || savedPlace.place.formattedAddress.split(",")[0];
    
    const currentUserLists = currentUserData?.lists?.map(l => l.id) || listsContainingPlace || [];
    
    const currentUserSavedPlace = currentUserData?.savedPlaceId 
      ? { id: currentUserData.savedPlaceId, placeId: savedPlace.placeId, hasBeen: currentUserData.hasBeen, rating: currentUserData.rating }
      : null;

    const myHasBeen = currentUserData?.hasBeen ?? false;
    const myRating = currentUserData?.rating ?? null;

    const updateEmojiMutation = useMutation({
      mutationFn: async (emoji: string | null) => {
        const targetId = currentUserData?.savedPlaceId || savedPlace.id;
        if (!targetId) {
          throw new Error("No saved place to update");
        }
        return apiRequest(`/api/saved-places/${targetId}`, {
          method: "PATCH",
          body: JSON.stringify({ emoji }),
        });
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["saved-places"] });
        queryClient.invalidateQueries({ queryKey: ["place-detail"] });
        queryClient.invalidateQueries({ queryKey: ["list"] });
        queryClient.invalidateQueries({ queryKey: ["lists"] });
      },
    });

    const handleEmojiSelect = (emoji: string | null) => {
      if (emojiEditable || thumbnailMode === "my-places") {
        updateEmojiMutation.mutate(emoji);
      }
    };

    const displayTags = savedPlace.place.topTags?.slice(0, 2) || [];
    
    const lists = savedPlace.lists || [];
    const listDisplayText = lists.length === 1 
      ? lists[0].name 
      : lists.length > 1 
        ? `${lists.length} lists` 
        : null;

    function renderThumbnail() {
      const photoElement = savedPlace.place.photoRefs && savedPlace.place.photoRefs.length > 0 ? (
        <img 
          src={`/api/places/photo?photoRef=${savedPlace.place.photoRefs[0]}&maxWidth=96`}
          alt={savedPlace.place.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <HugeiconsIcon icon={Location01Icon} className="h-5 w-5 text-muted-foreground" />
      );

      switch (thumbnailMode) {
        case "emoji":
          if (emojiEditable) {
            return (
              <EmojiPickerPopover
                emoji={savedPlace.emoji || null}
                onEmojiSelect={handleEmojiSelect}
                disabled={updateEmojiMutation.isPending}
                variant="area"
                testId={`button-emoji-picker-${savedPlace.id}`}
              />
            );
          }
          return (
            <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
              {savedPlace.emoji ? (
                <span className="text-2xl">{savedPlace.emoji}</span>
              ) : (
                <HugeiconsIcon icon={Location01Icon} className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          );
        case "my-places":
          return (
            <EmojiPickerPopover
              emoji={savedPlace.emoji || null}
              onEmojiSelect={handleEmojiSelect}
              disabled={updateEmojiMutation.isPending}
              variant="photo-overlay"
              testId={`button-emoji-picker-${savedPlace.id}`}
            >
              <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                {photoElement}
              </div>
            </EmojiPickerPopover>
          );
        case "photo":
        default:
          return (
            <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
              {photoElement}
            </div>
          );
      }
    }

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
          {renderThumbnail()}

          <div className="flex-1 min-w-0 overflow-hidden">
            <h3 className="font-semibold text-sm truncate flex items-center gap-1 font-brand">
              {savedPlace.place.name}
              {myHasBeen && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HugeiconsIcon icon={CheckmarkBadge01Icon} className="w-4 h-4 flex-shrink-0 fill-foreground text-background" />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {myRating ? (RATING_NAMES[myRating] || "rated") : "Been here"}
                  </TooltipContent>
                </Tooltip>
              )}
            </h3>
            
            {(category || displayTags.length > 0) && (
              <div className="flex items-center gap-1 text-sm text-foreground truncate" data-testid="place-card-category-row">
                {category && <span>{category}</span>}
                {category && displayTags.length > 0 && <span>—</span>}
                {displayTags.map((tag, i) => (
                  <span key={tag.id}>
                    {i > 0 && ", "}
                    {tag.displayName}
                  </span>
                ))}
              </div>
            )}
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 truncate" data-testid="place-card-location-row">
              <HugeiconsIcon icon={Location01Icon} className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{locationDisplay}</span>
              {showSavedBy && savedPlace.savedBy?.username && (
                <>
                  <span className="flex-shrink-0">·</span>
                  <span className="flex-shrink-0" data-testid={`text-saved-by-${savedPlace.id}`}>@{savedPlace.savedBy.username}</span>
                </>
              )}
              {showStatus && listDisplayText && (
                <>
                  <span className="flex-shrink-0">·</span>
                  <span className="truncate">{listDisplayText}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {showSaveDropdown && (
          <div 
            className={cn(
              "flex-shrink-0",
              hideDropdownUntilHover && !currentUserSavedPlace && "max-md:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity"
            )} 
            onClick={(e) => e.stopPropagation()}
          >
            <SaveToListDropdown
              place={savedPlace.place}
              savedPlace={currentUserSavedPlace}
              listsContainingPlace={currentUserLists}
              emoji={savedPlace.emoji || currentUserData?.emoji || null}
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
  thumbnailMode?: ThumbnailMode;
  emojiEditable?: boolean;
  currentUserPlaceData?: Record<string, CurrentUserPlaceData> | null;
  showSavedBy?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
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
  thumbnailMode = "photo",
  emojiEditable = false,
  currentUserPlaceData,
  showSavedBy = false,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
}: PlacesListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || !onLoadMore || isLoadingMore) return;
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, isLoadingMore]);

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
        <HugeiconsIcon icon={Location01Icon} className="mb-4 h-10 w-10 text-muted-foreground" />
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
          thumbnailMode={thumbnailMode}
          emojiEditable={emojiEditable}
          currentUserData={currentUserPlaceData?.[savedPlace.placeId] || null}
          showSavedBy={showSavedBy}
        />
      ))}
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-4" data-testid="load-more-trigger">
          {isLoadingMore ? (
            <div className="space-y-3 w-full">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Loading more...</span>
          )}
        </div>
      )}
    </div>
  );
}
