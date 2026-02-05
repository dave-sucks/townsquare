"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Lock, Trash2, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import type { SidebarInjectedProps } from "@/components/map/map-layout";
import { PlacesList } from "@/components/shared/places-list";

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
  emoji?: string | null;
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
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const url = `${window.location.origin}/lists/${list?.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  const savedPlaces = list?.listPlaces.map(lp => ({
    id: lp.id,
    placeId: lp.placeId,
    hasBeen: false,
    rating: null,
    emoji: lp.emoji || null,
    createdAt: lp.addedAt,
    place: lp.place,
  })) || [];

  const ownerHandle = list?.user.username || list?.user.id || "";

  if (isLoading || !list) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex items-center gap-2 p-3 border-b">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="p-3 border-b space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
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
        <span className="font-semibold text-sm flex-1 font-brand">{placeCount} {placeCount === 1 ? "place" : "places"}</span>
        {list.visibility === "PUBLIC" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            data-testid="button-share-list"
          >
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          </Button>
        )}
        {list.visibility === "PRIVATE" && (
          <Lock className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      <div className="p-3 border-b">
        <h2 className="text-sm font-semibold truncate font-brand" data-testid="text-list-name">{list.name}</h2>
        <Link 
          href={`/u/${ownerHandle}`} 
          className="text-xs text-muted-foreground hover:underline"
          data-testid="link-list-owner"
        >
          by @{ownerHandle}
        </Link>
        {list.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {list.description}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <PlacesList
          places={savedPlaces}
          selectedPlaceId={selectedPlaceId || null}
          onPlaceSelect={onPlaceSelect || (() => {})}
          placeRowRefs={placeRowRefs}
          showStatus={false}
          showSaveDropdown={true}
          isOwnProfile={false}
          emptyMessage="No places in this list"
          emptySubMessage={isOwner ? "Add places from your saved places" : "This list is empty"}
          renderAction={isOwner && onRemovePlace ? (savedPlace) => (
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
          ) : undefined}
        />
      </div>
    </div>
  );
}
