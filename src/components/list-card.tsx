"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Plus, MapPin, Lock, ChevronLeft, ChevronRight } from "lucide-react";

interface ListCardPlace {
  id: string;
  name: string;
  formattedAddress: string;
  photoRefs?: string[] | null;
}

interface ListCardUser {
  id: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

interface ListCardProps {
  id: string;
  name: string;
  description?: string | null;
  visibility: "PRIVATE" | "PUBLIC";
  placeCount: number;
  places?: ListCardPlace[];
  user?: ListCardUser;
  location?: string;
}

export function ListCard({
  id,
  name,
  description,
  visibility,
  placeCount,
  places = [],
  user,
  location,
}: ListCardProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const photos: string[] = [];
  places.forEach((place) => {
    if (place.photoRefs && Array.isArray(place.photoRefs)) {
      place.photoRefs.slice(0, 2).forEach((ref) => {
        if (photos.length < 5) {
          photos.push(`/api/places/photo?ref=${encodeURIComponent(ref as string)}`);
        }
      });
    }
  });

  const displayLocation = location || (places[0]?.formattedAddress?.split(",").slice(-2).join(",").trim()) || "";

  const userName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.username || "Unknown";

  const userInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.username?.[0] || "?";

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link href={`/lists/${id}`} data-testid={`list-card-${id}`}>
      <Card className="group overflow-visible hover-elevate">
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-md bg-muted">
          {photos.length > 0 ? (
            <>
              <Image
                src={photos[currentPhotoIndex]}
                alt={name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              {photos.length > 1 && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handlePrevPhoto}
                    data-testid="button-prev-photo"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleNextPhoto}
                    data-testid="button-next-photo"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {photos.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 w-1.5 rounded-full ${
                          idx === currentPhotoIndex ? "bg-white" : "bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <MapPin className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}

          <Badge
            variant="secondary"
            className="absolute left-2 top-2 bg-background/90 text-foreground"
          >
            {placeCount} {placeCount === 1 ? "place" : "places"}
          </Badge>

          <div className="absolute right-2 top-2 flex gap-1">
            {visibility === "PRIVATE" && (
              <Badge variant="secondary" className="bg-background/90">
                <Lock className="h-3 w-3" />
              </Badge>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full bg-background/80"
              onClick={handleActionClick}
              data-testid="button-like-list"
            >
              <Heart className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full bg-background/80"
              onClick={handleActionClick}
              data-testid="button-add-to-trip"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-3 space-y-1">
          <h3 className="font-medium text-sm line-clamp-1" data-testid="text-list-name">
            {name}
          </h3>

          {displayLocation && (
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="line-clamp-1">{displayLocation}</span>
            </div>
          )}

          {user && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Avatar className="h-4 w-4">
                <AvatarImage src={user.profileImageUrl || undefined} alt={userName} />
                <AvatarFallback className="text-[8px]">{userInitials}</AvatarFallback>
              </Avatar>
              <span className="line-clamp-1">{userName}</span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
