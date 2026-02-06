"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon, LeftToRightListBulletIcon, UserAdd01Icon, UserRemove01Icon, Loading03Icon } from "@hugeicons/core-free-icons";

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
  variant?: "grid" | "list";
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
  variant = "list",
}: PersonCardProps) {
  const displayName = firstName
    ? `${firstName}${lastName ? ` ${lastName}` : ""}`
    : username || "User";
  
  const handle = username || id;
  const userLink = `/u/${handle}`;
  
  const initials = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`
    : displayName.charAt(0).toUpperCase();

  const handleFollowClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFollow(e);
  };

  if (variant === "grid") {
    return (
      <Link 
        href={userLink} 
        className="block rounded-lg border bg-card overflow-hidden hover-elevate"
        data-testid={`person-card-${id}`}
      >
        <div className="p-4 flex flex-col items-center text-center">
          <Avatar className="h-16 w-16 mb-3">
            <AvatarImage src={profileImageUrl || undefined} alt={displayName} />
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <p className="text-sm font-medium truncate w-full">{displayName}</p>
          <p className="text-xs text-muted-foreground truncate w-full">@{handle}</p>
          <div className="flex items-center justify-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <HugeiconsIcon icon={Location01Icon} className="h-3 w-3" />
              {savedPlacesCount}
            </span>
            <span className="flex items-center gap-0.5">
              <HugeiconsIcon icon={LeftToRightListBulletIcon} className="h-3 w-3" />
              {listsCount}
            </span>
          </div>
          <Button
            variant={isFollowing ? "outline" : "default"}
            size="sm"
            className="w-full mt-3"
            onClick={handleFollowClick}
            disabled={isLoading}
            data-testid={`button-follow-${id}`}
          >
            {isLoading ? (
              <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
            ) : isFollowing ? (
              <>
                <HugeiconsIcon icon={UserRemove01Icon} className="mr-1 h-3.5 w-3.5" />
                Unfollow
              </>
            ) : (
              <>
                <HugeiconsIcon icon={UserAdd01Icon} className="mr-1 h-3.5 w-3.5" />
                Follow
              </>
            )}
          </Button>
        </div>
      </Link>
    );
  }

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
            <HugeiconsIcon icon={Location01Icon} className="h-3 w-3" />
            {savedPlacesCount}
          </span>
          <span className="flex items-center gap-0.5">
            <HugeiconsIcon icon={LeftToRightListBulletIcon} className="h-3 w-3" />
            {listsCount}
          </span>
        </div>
      </div>

      <Button
        variant={isFollowing ? "outline" : "default"}
        size="sm"
        onClick={handleFollowClick}
        disabled={isLoading}
        data-testid={`button-follow-${id}`}
      >
        {isLoading ? (
          <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
        ) : isFollowing ? (
          <HugeiconsIcon icon={UserRemove01Icon} className="h-4 w-4" />
        ) : (
          <HugeiconsIcon icon={UserAdd01Icon} className="h-4 w-4" />
        )}
      </Button>
    </Link>
  );
}
