"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, List as ListIcon, UserPlus, UserMinus, Loader2 } from "lucide-react";

interface PersonCardProps {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isFollowing: boolean;
  savedPlacesCount: number;
  listsCount: number;
  onFollow: (e: React.MouseEvent) => void;
  isLoading?: boolean;
}

export function PersonCard({
  id,
  username,
  firstName,
  lastName,
  profileImageUrl,
  isFollowing,
  savedPlacesCount,
  listsCount,
  onFollow,
  isLoading = false,
}: PersonCardProps) {
  const displayName = firstName
    ? `${firstName}${lastName ? ` ${lastName}` : ""}`
    : username || "User";
  
  const handle = username || id;
  const userLink = `/u/${handle}`;
  
  const initials = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`
    : displayName.charAt(0).toUpperCase();

  return (
    <Link 
      href={userLink} 
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover-elevate"
      data-testid={`person-card-${id}`}
    >
      <Avatar className="h-12 w-12 shrink-0">
        <AvatarImage src={profileImageUrl || undefined} alt={displayName} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground truncate">@{handle}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <MapPin className="h-3 w-3" />
            {savedPlacesCount}
          </span>
          <span className="flex items-center gap-0.5">
            <ListIcon className="h-3 w-3" />
            {listsCount}
          </span>
        </div>
      </div>

      <Button
        variant={isFollowing ? "outline" : "default"}
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onFollow(e);
        }}
        disabled={isLoading}
        data-testid={`button-follow-${id}`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isFollowing ? (
          <UserMinus className="h-4 w-4" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
      </Button>
    </Link>
  );
}
