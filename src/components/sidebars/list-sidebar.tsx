"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Lock, Globe, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { PlacesList } from "@/components/shared/places-list";
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

function ListHeader({
  list,
  isOwner,
}: {
  list: ListData;
  isOwner: boolean;
}) {
  const router = useRouter();
  const ownerName = list.user.firstName 
    ? `${list.user.firstName}${list.user.lastName ? ` ${list.user.lastName}` : ""}`
    : list.user.username || "User";

  return (
    <div className="border-b">
      <div className="flex items-center gap-2 p-2 border-b">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/lists")}
          data-testid="button-back-to-lists"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <ThemeToggle />
      </div>
      
      <div className="p-4">
        <div className="flex items-start gap-2">
          <h1 className="text-xl font-bold flex-1" data-testid="text-list-name">
            {list.name}
          </h1>
          {list.visibility === "PRIVATE" ? (
            <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          ) : (
            <Globe className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          )}
        </div>
        
        {list.description && (
          <p className="text-sm text-muted-foreground mt-1">
            {list.description}
          </p>
        )}
        
        <div className="flex items-center gap-2 mt-3">
          <Avatar className="h-6 w-6">
            <AvatarImage src={list.user.profileImageUrl || undefined} alt={ownerName} />
            <AvatarFallback className="text-xs">{ownerName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">{ownerName}</span>
          <Badge variant="secondary" className="ml-auto">
            {list.listPlaces.length} {list.listPlaces.length === 1 ? "place" : "places"}
          </Badge>
        </div>
      </div>
    </div>
  );
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

  if (isLoading || !list) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex items-center gap-2 p-2 border-b">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <Skeleton className="h-8 w-8" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-8" />
        </div>
        <div className="p-4 border-b space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="p-2 space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background" data-testid="list-sidebar">
      <ListHeader list={list} isOwner={isOwner} />

      <div className="flex-1 overflow-y-auto">
        {savedPlaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center p-4">
            <p className="text-lg font-medium">No places in this list</p>
            <p className="text-sm text-muted-foreground">
              {isOwner ? "Add places from your saved places" : "This list is empty"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-1">
            {savedPlaces.map((savedPlace) => (
              <div
                key={savedPlace.id}
                className="group relative"
              >
                <div
                  ref={(el) => {
                    if (placeRowRefs) {
                      if (el) placeRowRefs.current.set(savedPlace.id, el);
                      else placeRowRefs.current.delete(savedPlace.id);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 p-1 rounded-lg cursor-pointer transition-colors hover-elevate",
                    selectedPlaceId === savedPlace.id && "bg-accent"
                  )}
                  onClick={() => onPlaceSelect?.(savedPlace.id)}
                  data-testid={`list-place-row-${savedPlace.id}`}
                  data-selected={selectedPlaceId === savedPlace.id}
                >
                  <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                    {savedPlace.place.photoRefs?.[0] ? (
                      <img
                        src={`/api/places/photo?photoRef=${encodeURIComponent(savedPlace.place.photoRefs[0])}&maxWidth=100`}
                        alt={savedPlace.place.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Globe className="h-6 w-6" />
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
                      className="h-8 w-8 invisible group-hover:visible shrink-0"
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
