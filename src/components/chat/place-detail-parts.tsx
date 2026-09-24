"use client";

/**
 * Pieces the place list shows in its two deep-dive modes:
 *   CreatorHeaderCard — get_creator: who the list is about
 *   PlaceBuzz         — get_place: the AI summary + the creator post feed
 */

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import type { CreatorHeader, PlacePost } from "@/lib/agent/place-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FallbackImg } from "@/components/chat/trace-items";
import { cn } from "@/lib/utils";

function Initial({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("flex size-full items-center justify-center bg-muted font-brand text-muted-foreground", className)}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function CreatorHeaderCard({ creator }: { creator: CreatorHeader }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-2.5" data-testid="creator-header">
      <span className="size-10 shrink-0 overflow-hidden rounded-full ring-2 ring-background">
        {creator.avatar ? (
          <FallbackImg
            src={creator.avatar}
            referrerPolicy="no-referrer"
            className="size-full object-cover"
            fallback={<Initial name={creator.username} className="text-base" />}
          />
        ) : (
          <Initial name={creator.username} className="text-base" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link href={`/u/${creator.username}`} className="truncate font-brand text-[15px] font-semibold hover:underline">
            @{creator.username}
          </Link>
          {creator.isFollowed && (
            <Badge variant="secondary" className="shrink-0 font-normal">
              Following
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground tabular-nums">
          {creator.displayName ? `${creator.displayName} · ` : ""}
          {creator.postCount} posts · {creator.placeCount} places · {creator.followerCount}{" "}
          {creator.followerCount === 1 ? "follower" : "followers"}
        </p>
        {creator.bio && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{creator.bio}</p>}
      </div>
    </div>
  );
}

function when(iso?: string) {
  if (!iso) return null;
  try {
    return `${formatDistanceToNowStrict(new Date(iso))} ago`;
  } catch {
    return null;
  }
}

function PostItem({ post }: { post: PlacePost }) {
  const [open, setOpen] = useState(false);
  const caption = post.caption?.trim();
  const ago = when(post.postedAt);
  return (
    <div className="flex gap-2.5 py-2" data-testid="place-post">
      <span className="size-6 shrink-0 overflow-hidden rounded-full">
        {post.creator.avatar ? (
          <FallbackImg
            src={post.creator.avatar}
            referrerPolicy="no-referrer"
            className="size-full object-cover"
            fallback={<Initial name={post.creator.username} className="text-[10px]" />}
          />
        ) : (
          <Initial name={post.creator.username} className="text-[10px]" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <Link href={`/u/${post.creator.username}`} className="truncate font-medium text-foreground hover:underline">
            @{post.creator.username}
          </Link>
          {post.creator.isFollowed && <span className="shrink-0">· Following</span>}
          {ago && <span className="shrink-0">· {ago}</span>}
          {typeof post.likes === "number" && (
            <span className="shrink-0 tabular-nums">· {post.likes.toLocaleString()} likes</span>
          )}
        </div>
        {caption && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={cn("mt-0.5 block text-left text-[13px] leading-relaxed text-foreground/90", !open && "line-clamp-3")}
          >
            {caption}
          </button>
        )}
        {post.url && (
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-block text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View post ↗
          </a>
        )}
      </div>
      {post.mediaUrl && (
        <FallbackImg
          src={post.mediaUrl}
          referrerPolicy="no-referrer"
          className="size-14 shrink-0 rounded-lg object-cover"
          fallback={null}
        />
      )}
    </div>
  );
}

const POSTS_PAGE = 3;

export function PlaceBuzz({ aiSummary, posts }: { aiSummary?: string | null; posts: PlacePost[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? posts : posts.slice(0, POSTS_PAGE);
  return (
    <div className="flex flex-col gap-1" data-testid="place-buzz">
      {aiSummary && (
        <blockquote className="rounded-xl bg-muted/60 px-3 py-2 text-[13px] leading-relaxed text-foreground/90">
          {aiSummary}
        </blockquote>
      )}
      {posts.length > 0 && (
        <div className="flex flex-col divide-y divide-border/60 px-1">
          {shown.map((p) => (
            <PostItem key={p.reviewId} post={p} />
          ))}
        </div>
      )}
      {posts.length > POSTS_PAGE && !all && (
        <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={() => setAll(true)}>
          Show {posts.length - POSTS_PAGE} more posts
        </Button>
      )}
    </div>
  );
}
