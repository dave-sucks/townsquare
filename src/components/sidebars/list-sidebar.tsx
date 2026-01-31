"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Lock, Trash2, MapPin } from "lucide-react";
import type { SidebarInjectedProps } from "@/components/map/map-layout";
import { cn } from "@/lib/utils";

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

interface ListPlace {
  id: string;
  listId: string;
  placeId: string;
  addedAt: string;
  place: Place;
}

interface ListOwner {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface ListData {
  id: string;
  name: string;
  description: string | null;
  visibility: "PRIVATE" | "PUBLIC";
  userId: string;
  createdAt: string;
  user: ListOwner;
  listPlaces: ListPlace[];
}

interface ListSidebarProps extends Partial<SidebarInjectedProps> {
  list: ListData | null;
  isLoading?: boolean;
  isOwner: boolean;
  currentUserId?: string;
  onRemovePlace?: (placeId: string) => void;
  isRemovingPlace?: boolean;
}

export function ListSidebar({
  list,
  isLoading = false,
  isOwner,
  currentUserId,
  selectedPlaceId,
  onPlaceSelect,
  placeRowRefs,
  onRemovePlace,
  isRemovingPlace = false,
}: ListSidebarProps) {
  const savedPlaces = list?.listPlaces.map(lp => ({
    id: lp.id,
    placeId: lp.placeId,
    status: "WANT" as const,
    createdAt: lp.addedAt,
    place: lp.place,
  })) || [];

  const ownerHandle = list?.user.username || list?.user.id || "";

  if (isLoading || !list) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex items-center gap-2 p-3 border-b">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <Skeleton className="h-4 w-32 flex-1" />
        </div>
        <div className="p-3 border-b">
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="p-2 space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  const placeCount = list.listPlaces.length;

  return (
    <div className="h-full flex flex-col bg-background" data-testid="list-sidebar">
      <div className="flex items-center gap-2 p-3 border-b">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <span className="font-semibold text-sm flex-1 truncate" data-testid="text-list-name">{list.name}</span>
        {list.visibility === "PRIVATE" && (
          <Lock className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      <div className="p-3 border-b">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{placeCount} {placeCount === 1 ? "place" : "places"}</span>
          <span>·</span>
          <Link 
            href={`/u/${ownerHandle}`} 
            className="hover:underline"
            data-testid="link-list-owner"
          >
            by @{ownerHandle}
          </Link>
        </div>
        {list.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {list.description}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {savedPlaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <MapPin className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No places in this list</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isOwner ? "Add places from your saved places" : "This list is empty"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {savedPlaces.map((savedPlace) => (
              <div key={savedPlace.id} className="group relative">
                <div
                  ref={(el) => {
                    if (placeRowRefs) {
                      if (el) placeRowRefs.current.set(savedPlace.id, el);
                      else placeRowRefs.current.delete(savedPlace.id);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors hover-elevate",
                    selectedPlaceId === savedPlace.id && "bg-accent"
                  )}
                  onClick={() => onPlaceSelect?.(savedPlace.id)}
                  data-testid={`list-place-row-${savedPlace.id}`}
                  data-selected={selectedPlaceId === savedPlace.id}
                >
                  <div className="relative w-14 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
                    {savedPlace.place.photoRefs?.[0] ? (
                      <img
                        src={`/api/places/photo?photoRef=${encodeURIComponent(savedPlace.place.photoRefs[0])}&maxWidth=100`}
                        alt={savedPlace.place.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <MapPin className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 overflow-hidden">
                    <h3 className="font-medium text-sm truncate">
                      {savedPlace.place.name}
                    </h3>
                    {savedPlace.place.primaryType && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {savedPlace.place.primaryType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {savedPlace.place.formattedAddress.split(",")[0]}
                    </p>
                  </div>

                  {isOwner && onRemovePlace && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="invisible group-hover:visible shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePlace(savedPlace.placeId);
                      }}
                      disabled={isRemovingPlace}
                      data-testid={`button-remove-place-${savedPlace.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
