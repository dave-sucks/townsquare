"use client";

import Link from "next/link";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { FavouriteIcon, Comment01Icon, Bookmark01Icon, AddToListIcon } from "@hugeicons/core-free-icons";
import { SocialPostCard } from "@/components/shared/social-post-card";

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

interface SocialPostData {
  author: string;
  authorImage?: string | null;
  caption?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  likes?: number | null;
  postedAt?: string | null;
  permalink?: string | null;
  source?: 'instagram' | 'tiktok' | 'manual';
}

interface Activity {
  id: string;
  actorId: string;
  type: "PLACE_SAVED" | "PLACE_MARKED_BEEN" | "PLACE_ADDED_TO_LIST" | "LIST_CREATED" | "REVIEW_CREATED";
  placeId: string | null;
  listId: string | null;
  metadata: { placeName?: string; listName?: string; rating?: number; note?: string; review_preview?: string } | null;
  createdAt: string;
  actor: ActivityActor;
  place: ActivityPlace | null;
  list: ActivityList | null;
  socialPost?: SocialPostData | null;
}

const RATING_COLORS: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-yellow-500", 
  3: "bg-green-500",
};

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
  const hasSocialPost = !!activity.socialPost?.permalink;

  // For posts with social embeds, use different layout
  if (hasSocialPost) {
    return (
      <article className="bg-card" data-testid={`feed-post-${activity.id}`}>
        {/* Full-width Instagram embed - no padding */}
        <SocialPostCard
          author={activity.socialPost!.author}
          authorImage={activity.socialPost!.authorImage}
          caption={activity.socialPost!.caption}
          mediaUrl={activity.socialPost!.mediaUrl}
          mediaType={activity.socialPost!.mediaType}
          likes={activity.socialPost!.likes}
          postedAt={activity.socialPost!.postedAt}
          permalink={activity.socialPost!.permalink}
          source={activity.socialPost!.source}
        />
        
        {/* Location banner - minimal spacing above, tight to embed */}
        {activity.place && (
          <Link
            href={`/places/${activity.place.googlePlaceId}`}
            className="flex items-center gap-3 px-4 py-2 bg-muted/40 hover:bg-muted/60 transition-colors"
            data-testid={`feed-place-${activity.id}`}
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{activity.place.name}</p>
              <p className="text-xs text-muted-foreground truncate">{activity.place.formattedAddress}</p>
            </div>
            {/* Rating indicator */}
            {rating && (
              <div className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full ${RATING_COLORS[rating] || "bg-green-500"}`} />
                <span className="text-sm text-muted-foreground">{rating}/10</span>
              </div>
            )}
          </Link>
        )}
        
        {/* Actions bar */}
        <div className="flex items-center gap-1 px-2 py-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" data-testid={`feed-like-${activity.id}`}>
            <HugeiconsIcon icon={FavouriteIcon} className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" data-testid={`feed-comment-${activity.id}`}>
            <HugeiconsIcon icon={Comment01Icon} className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" data-testid={`feed-save-${activity.id}`}>
            <HugeiconsIcon icon={Bookmark01Icon} className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" data-testid={`feed-add-list-${activity.id}`}>
            <HugeiconsIcon icon={AddToListIcon} className="h-5 w-5" />
          </Button>
        </div>
      </article>
    );
  }

  // Standard layout for non-social posts
  return (
    <article className="bg-card" data-testid={`feed-post-${activity.id}`}>
      <div className="p-4">
        {/* Header: Avatar + "Name @ Place" */}
        <div className="flex items-start gap-2">
          <Link href={actorLink} data-testid={`feed-avatar-${activity.id}`}>
            <Avatar className="h-8 w-8">
              <AvatarImage src={activity.actor.profileImageUrl || undefined} alt={actorName} />
              <AvatarFallback className="text-sm">{actorInitials}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            {/* Name @ Place + Action */}
            <div className="flex items-center gap-1 flex-wrap">
              <Link href={actorLink} className="text-sm font-medium hover:underline" data-testid={`feed-author-${activity.id}`}>
                {actorName}
              </Link>
              {placeName && (
                <>
                  <span className="text-sm text-muted-foreground">@</span>
                  {activity.place ? (
                    <Link 
                      href={`/places/${activity.place.googlePlaceId}`} 
                      className="text-sm font-medium hover:underline"
                      data-testid={`feed-place-name-${activity.id}`}
                    >
                      {placeName}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium">{placeName}</span>
                  )}
                </>
              )}
              {/* Action indicator */}
              {activity.type === "PLACE_MARKED_BEEN" && (
                <span className="text-sm flex items-center gap-1 text-muted-foreground">
                  <span>·</span>
                  <span 
                    className={`inline-block w-2.5 h-2.5 rounded-full ${rating ? RATING_COLORS[rating] : "bg-green-500"}`} 
                  />
                  <span>Been</span>
                </span>
              )}
              {activity.type === "PLACE_SAVED" && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <span>·</span>
                  <HugeiconsIcon icon={Bookmark01Icon} className="h-3 w-3" />
                  <span>Saved</span>
                </span>
              )}
              {activity.type === "PLACE_ADDED_TO_LIST" && activity.list && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <span>·</span>
                  <span>added to</span>
                  <Link 
                    href={`/lists/${activity.list.id}`} 
                    className="font-medium hover:underline text-foreground"
                  >
                    {activity.list.name}
                  </Link>
                </span>
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
            <p className="text-xs text-muted-foreground mt-0.5">
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
            <HugeiconsIcon icon={FavouriteIcon} className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" data-testid={`feed-comment-${activity.id}`}>
            <HugeiconsIcon icon={Comment01Icon} className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" data-testid={`feed-save-${activity.id}`}>
            <HugeiconsIcon icon={Bookmark01Icon} className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" data-testid={`feed-add-list-${activity.id}`}>
            <HugeiconsIcon icon={AddToListIcon} className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </article>
  );
}
