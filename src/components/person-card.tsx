"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
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

  const handleFollowClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFollow(e);
  };

  return (
    <Link href={userLink} className="block min-w-0" data-testid={`person-card-${id}`}>
      <Card className="overflow-hidden hover-elevate">
        {/* Avatar Area - square aspect ratio with centered avatar */}
        <div className="aspect-square bg-muted flex items-center justify-center">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profileImageUrl || undefined} alt={displayName} />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
        </div>

        {/* Content Area */}
        <div className="p-3 min-w-0">
          <h3 className="text-sm font-medium truncate" data-testid={`text-name-${id}`}>
            {displayName}
          </h3>
          <p className="text-xs text-muted-foreground truncate" data-testid={`text-handle-${id}`}>
            @{handle}
          </p>
          
          {/* Stats */}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {savedPlacesCount}
            </span>
            <span className="flex items-center gap-1">
              <ListIcon className="h-3 w-3" />
              {listsCount}
            </span>
          </div>

          {/* Follow Button */}
          <Button
            variant={isFollowing ? "outline" : "default"}
            size="sm"
            className="w-full mt-3"
            onClick={handleFollowClick}
            disabled={isLoading}
            data-testid={`button-follow-${id}`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isFollowing ? (
              <>
                <UserMinus className="mr-1.5 h-3.5 w-3.5" />
                Unfollow
              </>
            ) : (
              <>
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Follow
              </>
            )}
          </Button>
        </div>
      </Card>
    </Link>
  );
}
