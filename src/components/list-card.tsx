"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Lock, ChevronLeft, ChevronRight } from "lucide-react";

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
}

export function ListCard({
  id,
  name,
  visibility,
  placeCount,
  places = [],
  user,
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

  const userName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.username || "Unknown";

  const userInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.username?.[0]?.toUpperCase() || "?";

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

  return (
    <Link href={`/lists/${id}`} className="block min-w-0" data-testid={`list-card-${id}`}>
      <Card className="overflow-hidden hover-elevate">
        {/* Image Area - fixed aspect ratio */}
        <div className="relative aspect-[4/3] bg-muted">
          {photos.length > 0 ? (
            <>
              <Image
                src={photos[currentPhotoIndex]}
                alt={name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                unoptimized
              />
              {photos.length > 1 && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handlePrevPhoto}
                    data-testid="button-prev-photo"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleNextPhoto}
                    data-testid="button-next-photo"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {photos.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 w-1.5 rounded-full transition-colors ${
                          idx === currentPhotoIndex ? "bg-white" : "bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <MapPin className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}

          {/* Badges overlay */}
          <div className="absolute left-2 top-2 flex items-center gap-1.5">
            <Badge variant="secondary" className="bg-background/90 text-foreground text-xs">
              {placeCount} {placeCount === 1 ? "place" : "places"}
            </Badge>
            {visibility === "PRIVATE" && (
              <Badge variant="secondary" className="bg-background/90 px-1.5">
                <Lock className="h-3 w-3" />
              </Badge>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-3 min-w-0">
          <h3 className="text-sm font-medium truncate" data-testid="text-list-name">
            {name}
          </h3>
          {user && (
            <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
              <Avatar className="h-4 w-4 shrink-0">
                <AvatarImage src={user.profileImageUrl || undefined} alt={userName} />
                <AvatarFallback className="text-[8px]">{userInitials}</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate">{userName}</span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
