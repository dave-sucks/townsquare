"use client";

import Link from "next/link";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Bookmark, ListPlus } from "lucide-react";

interface ActivityActor {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface ActivityPlace {
  id: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  photoRefs?: string[] | null;
}

interface ActivityList {
  id: string;
  name: string;
  visibility: string;
  userId: string;
}

interface Activity {
  id: string;
  actorId: string;
  type: "PLACE_SAVED_WANT" | "PLACE_MARKED_BEEN" | "PLACE_ADDED_TO_LIST" | "LIST_CREATED" | "REVIEW_CREATED";
  placeId: string | null;
  listId: string | null;
  metadata: { placeName?: string; listName?: string; rating?: number; note?: string; review_preview?: string } | null;
  createdAt: string;
  actor: ActivityActor;
  place: ActivityPlace | null;
  list: ActivityList | null;
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface FeedPostProps {
  activity: Activity;
}

export function FeedPost({ activity }: FeedPostProps) {
  const actorName = activity.actor.firstName && activity.actor.lastName
    ? `${activity.actor.firstName} ${activity.actor.lastName}`
    : activity.actor.username || "User";

  const actorInitials = activity.actor.firstName && activity.actor.lastName
    ? `${activity.actor.firstName[0]}${activity.actor.lastName[0]}`
    : actorName.charAt(0).toUpperCase();

  const actorLink = `/u/${activity.actor.username || activity.actor.id}`;
  const placeName = activity.place?.name || activity.metadata?.placeName;
  const photoUrl = activity.place?.photoRefs?.[0]
    ? `/api/places/photo?photoRef=${encodeURIComponent(activity.place.photoRefs[0])}&maxWidth=600`
    : null;

  const reviewText = activity.metadata?.note || activity.metadata?.review_preview;
  const rating = activity.metadata?.rating;

  return (
    <article className="bg-card border-b" data-testid={`feed-post-${activity.id}`}>
      <div className="p-4">
        {/* Header: Avatar + "Name @ Place" */}
        <div className="flex items-start gap-3">
          <Link href={actorLink} data-testid={`feed-avatar-${activity.id}`}>
            <Avatar className="h-10 w-10">
              <AvatarImage src={activity.actor.profileImageUrl || undefined} alt={actorName} />
              <AvatarFallback className="text-sm">{actorInitials}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            {/* Name @ Place */}
            <div className="flex items-center gap-1 flex-wrap">
              <Link href={actorLink} className="font-medium hover:underline" data-testid={`feed-author-${activity.id}`}>
                {actorName}
              </Link>
              {placeName && (
                <>
                  <span className="text-muted-foreground">@</span>
                  {activity.place ? (
                    <Link 
                      href={`/places/${activity.place.googlePlaceId}`} 
                      className="font-medium hover:underline"
                      data-testid={`feed-place-name-${activity.id}`}
                    >
                      {placeName}
                    </Link>
                  ) : (
                    <span className="font-medium">{placeName}</span>
                  )}
                </>
              )}
              {activity.type === "LIST_CREATED" && activity.list && (
                <>
                  <span className="text-muted-foreground">created</span>
                  <Link 
                    href={`/lists/${activity.list.id}`} 
                    className="font-medium hover:underline"
                  >
                    {activity.list.name}
                  </Link>
                </>
              )}
            </div>

            {/* Timestamp */}
            <p className="text-sm text-muted-foreground mt-0.5">
              {formatTimeAgo(activity.createdAt)}
            </p>

            {/* Rating (if review) */}
            {activity.type === "REVIEW_CREATED" && rating && (
              <div className="flex items-center gap-0.5 mt-1" data-testid={`feed-rating-${activity.id}`}>
                {[...Array(10)].map((_, i) => (
                  <span
                    key={i}
                    className={`text-sm ${i < rating ? "text-amber-500" : "text-muted-foreground/30"}`}
                  >
                    ●
                  </span>
                ))}
                <span className="text-sm text-muted-foreground ml-1.5">{rating}/10</span>
              </div>
            )}
          </div>
        </div>

        {/* Place Photo Card */}
        {activity.place && photoUrl && (
          <Link
            href={`/places/${activity.place.googlePlaceId}`}
            className="block mt-3 rounded-lg overflow-hidden border"
            data-testid={`feed-place-${activity.id}`}
          >
            <div className="relative aspect-[16/9] bg-muted">
              <Image
                src={photoUrl}
                alt={activity.place.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 500px"
                unoptimized
              />
            </div>
            <div className="p-3 bg-muted/30">
              <p className="font-medium text-sm">{activity.place.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{activity.place.formattedAddress}</p>
            </div>
          </Link>
        )}

        {/* Place Card without photo */}
        {activity.place && !photoUrl && (
          <Link
            href={`/places/${activity.place.googlePlaceId}`}
            className="block mt-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
            data-testid={`feed-place-${activity.id}`}
          >
            <p className="font-medium text-sm">{activity.place.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{activity.place.formattedAddress}</p>
          </Link>
        )}

        {/* Review Text */}
        {reviewText && (
          <p className="text-sm leading-relaxed mt-3" data-testid={`feed-note-${activity.id}`}>
            {reviewText}
          </p>
        )}

        {/* Social Action Buttons */}
        <div className="flex items-center gap-1 mt-3 -ml-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" data-testid={`feed-like-${activity.id}`}>
            <Heart className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" data-testid={`feed-comment-${activity.id}`}>
            <MessageCircle className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" data-testid={`feed-save-${activity.id}`}>
            <Bookmark className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" data-testid={`feed-add-list-${activity.id}`}>
            <ListPlus className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </article>
  );
}
