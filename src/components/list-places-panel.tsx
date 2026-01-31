"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { MapPin, Lock, Globe, ArrowLeft, Trash2 } from "lucide-react";

interface Place {
  id: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  photoRefs: string[] | null;
  primaryType: string | null;
  types: string[] | null;
  priceLevel: string | null;
}

interface ListPlace {
  id: string;
  listId: string;
  placeId: string;
  addedAt: string;
  note: string | null;
  place: Place;
}

interface ListUser {
  id: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

interface ListData {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  visibility: "PRIVATE" | "PUBLIC";
  createdAt: string;
  updatedAt?: string;
  user?: ListUser;
  listPlaces: ListPlace[];
  _count: {
    listPlaces: number;
  };
}

interface ListPlacesPanelProps {
  list: ListData;
  isOwner: boolean;
  selectedPlaceId: string | null;
  onPlaceSelect: (placeId: string) => void;
  onRemovePlace?: (placeId: string) => void;
  isRemovingPlace?: boolean;
  placeRowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

function formatPlaceType(type: string | null | undefined): string {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const ListPlaceRow = forwardRef<HTMLDivElement, {
  listPlace: ListPlace;
  index: number;
  isSelected: boolean;
  isOwner: boolean;
  onSelect: () => void;
  onRemove?: () => void;
  isRemoving?: boolean;
}>(({ listPlace, index, isSelected, isOwner, onSelect, onRemove, isRemoving }, ref) => {
  const photoRef = listPlace.place.photoRefs?.[0];
  const photoUrl = photoRef 
    ? `/api/places/photo?photoRef=${encodeURIComponent(photoRef)}&maxWidth=100`
    : null;
  
  const placeType = formatPlaceType(listPlace.place.primaryType);
  const address = listPlace.place.formattedAddress.split(",")[0];

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors group hover-elevate",
        isSelected && "bg-accent"
      )}
      onClick={onSelect}
      data-selected={isSelected}
      data-testid={`list-place-row-${listPlace.id}`}
    >
      <div className="relative w-14 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={listPlace.place.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <MapPin className="h-5 w-5" />
          </div>
        )}
        <div className="absolute top-0.5 left-0.5 bg-background/80 rounded-full h-5 w-5 flex items-center justify-center text-xs font-medium">
          {index + 1}
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        <h3 className="font-medium text-sm truncate">
          {listPlace.place.name}
        </h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
          {placeType && <span className="truncate">{placeType}</span>}
          {placeType && address && <span className="mx-1">·</span>}
          <span className="truncate">{address}</span>
        </div>
        {listPlace.note && (
          <p className="text-xs text-muted-foreground truncate mt-0.5 italic">
            {listPlace.note}
          </p>
        )}
      </div>

      {isOwner && onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 invisible group-hover:visible shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          disabled={isRemoving}
          data-testid={`button-remove-place-${listPlace.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
});
ListPlaceRow.displayName = "ListPlaceRow";

function ListHeader({ list }: { list: ListData }) {
  const userName = list.user?.firstName && list.user?.lastName
    ? `${list.user.firstName} ${list.user.lastName}`
    : list.user?.username || "Unknown";

  const userInitials = list.user?.firstName && list.user?.lastName
    ? `${list.user.firstName[0]}${list.user.lastName[0]}`
    : list.user?.username?.[0] || "?";

  return (
    <div className="border-b bg-background">
      <div className="flex items-center gap-2 p-2 border-b">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <Button variant="ghost" size="icon" asChild data-testid="button-back-to-lists">
          <Link href="/lists">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1" />
        <ThemeToggle />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold truncate" data-testid="text-list-name">
                {list.name}
              </h1>
              {list.visibility === "PRIVATE" ? (
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </div>
            {list.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {list.description}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-3">
          <Link href={list.user ? `/u/${list.user.username || list.user.id}` : "#"} className="flex items-center gap-2 hover:underline">
            <Avatar className="h-6 w-6 border border-border">
              <AvatarImage src={list.user?.profileImageUrl || undefined} alt={userName} />
              <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{userName}</span>
          </Link>
          <Badge variant="secondary" className="text-xs">
            {list._count.listPlaces} {list._count.listPlaces === 1 ? "place" : "places"}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function ListHeaderSkeleton() {
  return (
    <div className="border-b bg-background">
      <div className="flex items-center gap-2 p-2 border-b">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <Skeleton className="h-8 w-8" />
        <div className="flex-1" />
        <ThemeToggle />
      </div>
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

export function ListPlacesPanel({
  list,
  isOwner,
  selectedPlaceId,
  onPlaceSelect,
  onRemovePlace,
  isRemovingPlace,
  placeRowRefs,
}: ListPlacesPanelProps) {
  return (
    <div className="h-full flex flex-col bg-background" data-testid="list-places-panel">
      <ListHeader list={list} />

      <div className="flex-1 overflow-y-auto p-2">
        {list.listPlaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No places in this list</p>
            <p className="text-sm text-muted-foreground mt-1">Add places from the map</p>
            <Button asChild className="mt-4" data-testid="button-go-to-map">
              <Link href="/">Go to Map</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {list.listPlaces.map((listPlace, index) => (
              <ListPlaceRow
                key={listPlace.id}
                ref={(el) => {
                  if (el) {
                    placeRowRefs.current.set(listPlace.placeId, el);
                  } else {
                    placeRowRefs.current.delete(listPlace.placeId);
                  }
                }}
                listPlace={listPlace}
                index={index}
                isSelected={selectedPlaceId === listPlace.placeId}
                isOwner={isOwner}
                onSelect={() => onPlaceSelect(listPlace.placeId)}
                onRemove={onRemovePlace ? () => onRemovePlace(listPlace.placeId) : undefined}
                isRemoving={isRemovingPlace}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { ListHeaderSkeleton };
