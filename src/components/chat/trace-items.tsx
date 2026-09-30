"use client";

/**
 * Item rows inside a chain-of-thought step, after Hindsight's
 * ToolProgressTickerItem: a 16px image, the name in medium weight, the rest
 * muted, all one text size. Rows that point somewhere show a right arrow on
 * hover that opens the creator's or place's page.
 *   PlaceItem   — photo (or emoji) + name — text
 *   PersonItem  — avatar + @handle — text
 *   GenericItem — dot + text
 */

import { useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { ToolUIItem } from "@/lib/agent/tool-result";

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

function Row({ lead, href, children }: { lead: React.ReactNode; href?: string; children: React.ReactNode }) {
  return (
    <div className="group/row relative flex min-h-6 min-w-0 items-center gap-2 pr-6 text-[13px] text-muted-foreground/75">
      <span className="flex size-4 shrink-0 items-center justify-center">{lead}</span>
      <span className="min-w-0 truncate">{children}</span>
      {href && (
        <Link
          href={href}
          aria-label="Open"
          className="absolute right-0 flex size-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 hover:text-foreground focus-visible:opacity-100"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
        </Link>
      )}
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
    <Row lead={lead} href={`/places/${item.googlePlaceId}`}>
      <span className="font-medium">{item.name}</span>
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
    <Row lead={lead} href={`/u/${item.username}`}>
      <span className="font-medium">@{item.username}</span>
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
