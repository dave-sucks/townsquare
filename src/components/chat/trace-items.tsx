"use client";

/**
 * Item rows inside a chain-of-thought step (townsquare's take on Hindsight's
 * ToolProgressTickerItem / ToolProgressItem):
 *   PlaceItem   — 16px photo (or emoji) + bold name + " — " text
 *   PersonItem  — 16px avatar + @handle + text (+ "Following")
 *   GenericItem — dot + text
 */

import { useState } from "react";
import type { ToolUIItem } from "@/lib/agent/tool-result";
import { cn } from "@/lib/utils";

/**
 * An <img> that swaps to `fallback` when it fails. Creator avatars include
 * app-relative paths that 404 and place photo refs expire (the photo proxy
 * 500s), so every thumbnail needs a way down.
 */
export function FallbackImg({
  src,
  fallback,
  className,
  referrerPolicy,
}: {
  src: string;
  fallback: React.ReactNode;
  className?: string;
  referrerPolicy?: React.ImgHTMLAttributes<HTMLImageElement>["referrerPolicy"];
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt=""
      className={className}
      loading="lazy"
      referrerPolicy={referrerPolicy}
      onError={() => setFailed(true)}
    />
  );
}

export function placePhotoUrl(photoRef: string, maxWidth = 96): string {
  return `/api/places/photo?photoRef=${encodeURIComponent(photoRef)}&maxWidth=${maxWidth}`;
}

function Row({ lead, children, className }: { lead: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-6 min-w-0 items-center gap-2 px-1.5 text-[12.5px]", className)}>
      <span className="flex size-4 shrink-0 items-center justify-center">{lead}</span>
      <span className="min-w-0 truncate text-muted-foreground">{children}</span>
    </div>
  );
}

export function PlaceItem({ item }: { item: Extract<ToolUIItem, { kind: "place" }> }) {
  const noPhoto = item.emoji ? (
    <span className="text-[13px] leading-none">{item.emoji}</span>
  ) : (
    <span className="size-1.5 rounded-full bg-muted-foreground/50" />
  );
  const lead = item.photoRef ? (
    <FallbackImg src={placePhotoUrl(item.photoRef)} fallback={noPhoto} className="size-4 rounded-[4px] object-cover" />
  ) : (
    noPhoto
  );
  return (
    <Row lead={lead}>
      <span className="font-medium text-foreground">{item.name}</span>
      {item.text ? ` — ${item.text}` : null}
    </Row>
  );
}

export function PersonItem({ item }: { item: Extract<ToolUIItem, { kind: "person" }> }) {
  const initial = (
    <span className="flex size-4 items-center justify-center rounded-full bg-muted font-brand text-[9px] text-muted-foreground">
      {item.username.charAt(0).toUpperCase()}
    </span>
  );
  const lead = item.avatar ? (
    <FallbackImg src={item.avatar} fallback={initial} className="size-4 rounded-full object-cover" referrerPolicy="no-referrer" />
  ) : (
    initial
  );
  return (
    <Row lead={lead}>
      <a href={`/u/${item.username}`} className="font-medium text-foreground hover:underline">
        @{item.username}
      </a>
      {item.isFollowed ? <span className="text-muted-foreground/70"> · Following</span> : null}
      {item.text ? ` — ${item.text}` : null}
    </Row>
  );
}

export function GenericItem({ text }: { text: string }) {
  return <Row lead={<span className="size-1.5 rounded-full bg-muted-foreground/50" />}>{text}</Row>;
}

export function TraceItem({ item }: { item: ToolUIItem }) {
  if (item.kind === "place") return <PlaceItem item={item} />;
  if (item.kind === "person") return <PersonItem item={item} />;
  return <GenericItem text={item.text} />;
}
