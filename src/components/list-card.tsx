"use client";

import Link from "next/link";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon, LockIcon } from "@hugeicons/core-free-icons";

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
  const firstPhoto = places.find(p => p.photoRefs?.length)?.photoRefs?.[0];
  const photoUrl = firstPhoto ? `/api/places/photo?ref=${encodeURIComponent(firstPhoto)}` : null;

  const userName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.username || null;

  const userInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.username?.[0]?.toUpperCase() || "?";

  return (
    <Link 
      href={`/lists/${id}`} 
      className="block rounded-lg border bg-card overflow-hidden hover-elevate"
      data-testid={`list-card-${id}`}
    >
      {/* Image */}
      <div className="relative aspect-[3/2]">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-primary">
            <HugeiconsIcon icon={Location01Icon} className="h-8 w-8 text-primary-foreground/40" />
          </div>
        )}
        {visibility === "PRIVATE" && (
          <div className="absolute top-2 right-2 p-1 rounded bg-background/80">
            <HugeiconsIcon icon={LockIcon} className="h-3 w-3" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {placeCount} {placeCount === 1 ? "place" : "places"}
        </p>
        {user && userName && (
          <div className="flex items-center gap-1.5 mt-2">
            <Avatar className="h-4 w-4">
              <AvatarImage src={user.profileImageUrl || undefined} alt={userName} />
              <AvatarFallback className="text-[8px]">{userInitials}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">{userName}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
