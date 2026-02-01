"use client";

import Link from "next/link";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, CheckCircle, ListPlus, FolderPlus, Star, MapPin } from "lucide-react";

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

function getActionIcon(type: Activity["type"]) {
  switch (type) {
    case "PLACE_SAVED_WANT":
      return <Heart className="h-3.5 w-3.5 text-primary fill-primary" />;
    case "PLACE_MARKED_BEEN":
      return <CheckCircle className="h-3.5 w-3.5 text-primary" />;
    case "PLACE_ADDED_TO_LIST":
      return <ListPlus className="h-3.5 w-3.5 text-muted-foreground" />;
    case "LIST_CREATED":
      return <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />;
    case "REVIEW_CREATED":
      return <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />;
    default:
      return null;
  }
}

function getActionText(activity: Activity) {
  const placeName = activity.place?.name || activity.metadata?.placeName;
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
    ? `/api/places/photo?photoRef=${encodeURIComponent(activity.place.photoRefs[0])}&maxWidth=500`
    : null;

  return (
    <article className="border-b last:border-b-0" data-testid={`feed-post-${activity.id}`}>
      <div className="p-4">
        {/* Header: Avatar, Name, Action, Time */}
        <div className="flex items-start gap-3">
          <Link href={actorLink} data-testid={`feed-avatar-${activity.id}`}>
            <Avatar className="h-10 w-10">
              <AvatarImage src={activity.actor.profileImageUrl || undefined} alt={actorName} />
              <AvatarFallback>{actorInitials}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link href={actorLink} className="font-semibold text-sm" data-testid={`feed-author-${activity.id}`}>
                {actorName}
              </Link>
              <span className="text-sm text-muted-foreground">{getActionText(activity)}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{formatTimeAgo(activity.createdAt)}</span>
            </div>

            {/* Rating if review */}
            {activity.type === "REVIEW_CREATED" && activity.metadata?.rating && (
              <div className="flex items-center gap-1 mt-1">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-3 rounded-sm ${
                      i < activity.metadata!.rating! ? "bg-amber-500" : "bg-muted"
                    }`}
                  />
                ))}
                <span className="text-xs text-muted-foreground ml-1" data-testid={`feed-rating-${activity.id}`}>{activity.metadata.rating}/10</span>
              </div>
            )}

            {/* Review text - the main content */}
            {activity.type === "REVIEW_CREATED" && (activity.metadata?.note || activity.metadata?.review_preview) && (
              <p className="text-sm mt-2 leading-relaxed" data-testid={`feed-note-${activity.id}`}>
                {activity.metadata.note || activity.metadata.review_preview}
              </p>
            )}
          </div>
        </div>

        {/* Embedded Place Card */}
        {activity.place && (
          <Link
            href={`/places/${activity.place.googlePlaceId}`}
            className="block mt-3 rounded-lg border overflow-hidden hover-elevate"
            data-testid={`feed-place-${activity.id}`}
          >
            {photoUrl && (
              <div className="relative aspect-[2/1] bg-muted">
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
              <p className="text-xs text-muted-foreground truncate mt-0.5">{activity.place.formattedAddress}</p>
            </div>
          </Link>
        )}

        {/* Embedded List Card (only if no place) */}
        {activity.list && !activity.place && (
          <Link
            href={`/lists/${activity.list.id}`}
            className="flex items-center gap-3 mt-3 p-3 rounded-lg border hover-elevate"
            data-testid={`feed-list-${activity.id}`}
          >
            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
              <FolderPlus className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm">{activity.list.name}</p>
              <p className="text-xs text-muted-foreground">New list</p>
            </div>
          </Link>
        )}
      </div>
    </article>
  );
}
