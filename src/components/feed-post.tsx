"use client";

import Link from "next/link";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getActionText(activity: Activity) {
  const listName = activity.list?.name || activity.metadata?.listName;

  switch (activity.type) {
    case "PLACE_SAVED_WANT":
      return "wants to visit";
    case "PLACE_MARKED_BEEN":
      return "visited";
    case "PLACE_ADDED_TO_LIST":
      return `saved to ${listName || "a list"}`;
    case "LIST_CREATED":
      return "created a list";
    case "REVIEW_CREATED":
      return "reviewed";
    default:
      return "";
  }
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
  const photoUrl = activity.place?.photoRefs?.[0]
    ? `/api/places/photo?photoRef=${encodeURIComponent(activity.place.photoRefs[0])}&maxWidth=600`
    : null;

  const reviewText = activity.metadata?.note || activity.metadata?.review_preview;
  const rating = activity.metadata?.rating;

  return (
    <article className="bg-card border-b" data-testid={`feed-post-${activity.id}`}>
      {/* Author Header */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <Link href={actorLink} data-testid={`feed-avatar-${activity.id}`}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={activity.actor.profileImageUrl || undefined} alt={actorName} />
            <AvatarFallback className="text-sm">{actorInitials}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={actorLink} className="font-semibold text-sm hover:underline" data-testid={`feed-author-${activity.id}`}>
              {actorName}
            </Link>
            <span className="text-sm text-muted-foreground">{getActionText(activity)}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">{formatTimeAgo(activity.createdAt)}</span>
          </div>
          {/* Rating dots for reviews - inline with author info */}
          {activity.type === "REVIEW_CREATED" && rating && (
            <div className="flex items-center gap-0.5 mt-1" data-testid={`feed-rating-${activity.id}`}>
              {[...Array(10)].map((_, i) => (
                <span
                  key={i}
                  className={`text-xs ${i < rating ? "text-amber-500" : "text-muted-foreground/30"}`}
                >
                  ●
                </span>
              ))}
              <span className="text-xs text-muted-foreground ml-1.5">{rating}/10</span>
            </div>
          )}
        </div>
      </div>

      {/* Review Text - Main Content */}
      {activity.type === "REVIEW_CREATED" && reviewText && (
        <div className="px-4 pb-3">
          <p className="text-sm leading-relaxed" data-testid={`feed-note-${activity.id}`}>
            {reviewText}
          </p>
        </div>
      )}

      {/* Place Card - Embedded */}
      {activity.place && (
        <Link
          href={`/places/${activity.place.googlePlaceId}`}
          className="block mx-4 mb-4 rounded-lg border overflow-hidden hover:bg-muted/50 transition-colors"
          data-testid={`feed-place-${activity.id}`}
        >
          {photoUrl && (
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
          )}
          <div className="p-3">
            <p className="font-medium text-sm">{activity.place.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{activity.place.formattedAddress}</p>
          </div>
        </Link>
      )}

      {/* List Card - Only for LIST_CREATED */}
      {activity.list && activity.type === "LIST_CREATED" && (
        <Link
          href={`/lists/${activity.list.id}`}
          className="block mx-4 mb-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
          data-testid={`feed-list-${activity.id}`}
        >
          <p className="font-medium text-sm">{activity.list.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">New list</p>
        </Link>
      )}
    </article>
  );
}
