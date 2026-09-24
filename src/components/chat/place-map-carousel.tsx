"use client";

/**
 * PlaceMapCarousel — Manifest's "Map Carousel" design (map + pins + a
 * swipeable row of cards, selection synced both ways), built on townsquare's
 * Google Maps wrapper (components/ui/map.tsx) instead of Leaflet, with the
 * user's map style.
 *
 *   tap a pin   → its card scrolls into the center, pin highlights
 *   swipe cards → the centered card's pin highlights, map pans to it
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import type { PlaceRow } from "@/lib/agent/place-row";
import { Map, MapMarker, MarkerContent, useMap } from "@/components/ui/map";
import { applyLabelDensity, applyMapStyle, getStoredLabelDensity, getStoredMapStyle } from "@/lib/map-styles";
import { FallbackImg, placePhotoUrl } from "@/components/chat/trace-items";
import { CreatorStack } from "@/components/chat/place-row-card";
import { cn } from "@/lib/utils";

function FitAndStyle({ places, selectedKey }: { places: PlaceRow[]; selectedKey: string | null }) {
  const { map, isLoaded } = useMap();
  const signature = places.map((p) => p.googlePlaceId).join("|");

  useEffect(() => {
    if (!map || !isLoaded) return;
    const style = getStoredMapStyle();
    applyMapStyle(map, style);
    applyLabelDensity(map, getStoredLabelDensity(), style);
  }, [map, isLoaded]);

  useEffect(() => {
    if (!map || !isLoaded || places.length === 0) return;
    if (places.length === 1) {
      map.setCenter({ lat: places[0].lat, lng: places[0].lng });
      map.setZoom(15);
      return;
    }
    const b = new google.maps.LatLngBounds();
    places.forEach((p) => b.extend({ lat: p.lat, lng: p.lng }));
    // Bottom padding leaves room for the card row over the map.
    map.fitBounds(b, { top: 28, right: 28, bottom: 108, left: 28 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, signature]);

  useEffect(() => {
    if (!map || !isLoaded || !selectedKey) return;
    const p = places.find((x) => x.googlePlaceId === selectedKey);
    if (p) map.panTo({ lat: p.lat, lng: p.lng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, selectedKey]);

  return null;
}

export function PlaceMapCarousel({
  places,
  selectedKey,
  onSelect,
}: {
  places: PlaceRow[];
  selectedKey: string | null;
  onSelect: (place: PlaceRow, source: "map" | "carousel") => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new globalThis.Map<string, HTMLElement>());
  const scrollingFromPin = useRef(false);

  const center = useMemo<[number, number]>(() => {
    if (places.length === 0) return [-74.006, 40.7128];
    const lat = places.reduce((s, p) => s + p.lat, 0) / places.length;
    const lng = places.reduce((s, p) => s + p.lng, 0) / places.length;
    return [lng, lat];
  }, [places]);

  // Pin (or outside) selection → bring the card to the center.
  useEffect(() => {
    if (!selectedKey) return;
    const el = cardRefs.current.get(selectedKey);
    const track = trackRef.current;
    if (!el || !track) return;
    scrollingFromPin.current = true;
    track.scrollTo({ left: el.offsetLeft - (track.clientWidth - el.clientWidth) / 2, behavior: "smooth" });
    const t = setTimeout(() => (scrollingFromPin.current = false), 500);
    return () => clearTimeout(t);
  }, [selectedKey]);

  // Swipe → whichever card is centered becomes the selection.
  const onScrollEnd = useCallback(() => {
    if (scrollingFromPin.current) return;
    const track = trackRef.current;
    if (!track) return;
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best: PlaceRow | null = null;
    let bestDist = Infinity;
    for (const p of places) {
      const el = cardRefs.current.get(p.googlePlaceId);
      if (!el) continue;
      const d = Math.abs(el.offsetLeft + el.clientWidth / 2 - mid);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    if (best && best.googlePlaceId !== selectedKey) onSelect(best, "carousel");
  }, [places, selectedKey, onSelect]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let t: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(t);
      t = setTimeout(onScrollEnd, 120);
    };
    track.addEventListener("scroll", handler, { passive: true });
    return () => {
      clearTimeout(t);
      track.removeEventListener("scroll", handler);
    };
  }, [onScrollEnd]);

  return (
    <div className="relative h-80 w-full overflow-hidden rounded-xl border bg-muted" data-testid="place-map-carousel">
      <Map center={center} zoom={13} className="h-full w-full">
        <FitAndStyle places={places} selectedKey={selectedKey} />
        {places.map((p, i) => {
          const selected = p.googlePlaceId === selectedKey;
          return (
            <MapMarker key={p.googlePlaceId} longitude={p.lng} latitude={p.lat} onClick={() => onSelect(p, "map")}>
              <MarkerContent>
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full border-2 border-white font-brand font-semibold text-white shadow-md transition-all duration-200",
                    selected ? "z-10 size-8 scale-110 bg-brand text-sm" : "size-6 bg-brand/85 text-[11px] hover:scale-110",
                  )}
                  style={{ zIndex: selected ? 10 : undefined }}
                >
                  {p.emoji ?? i + 1}
                </div>
              </MarkerContent>
            </MapMarker>
          );
        })}
      </Map>

      <div
        ref={trackRef}
        className="no-scrollbar absolute inset-x-0 bottom-2 z-10 flex snap-x snap-mandatory gap-2 overflow-x-auto px-3"
      >
        {places.map((p, i) => {
          const selected = p.googlePlaceId === selectedKey;
          return (
            <div
              key={p.googlePlaceId}
              ref={(el) => {
                if (el) cardRefs.current.set(p.googlePlaceId, el);
                else cardRefs.current.delete(p.googlePlaceId);
              }}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(p, "carousel")}
              onKeyDown={(e) => e.key === "Enter" && onSelect(p, "carousel")}
              className={cn(
                "flex w-[82%] shrink-0 snap-center cursor-pointer gap-2.5 rounded-xl bg-background p-2 shadow-lg ring-1 ring-foreground/10 transition-shadow",
                selected && "ring-2 ring-brand",
              )}
            >
              <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                {p.photoRef ? (
                  <FallbackImg
                    src={placePhotoUrl(p.photoRef, 160)}
                    className="size-full object-cover"
                    fallback={<span className="flex size-full items-center justify-center text-2xl">{p.emoji ?? "📍"}</span>}
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-2xl">{p.emoji ?? "📍"}</span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-brand font-brand text-[9px] font-semibold text-white tabular-nums">
                    {i + 1}
                  </span>
                  <Link
                    href={`/places/${p.googlePlaceId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="min-w-0 truncate font-brand text-sm font-semibold hover:underline"
                  >
                    {p.name}
                  </Link>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {[p.category, p.neighborhood, p.distanceMi != null ? `${p.distanceMi} mi` : null].filter(Boolean).join(" · ")}
                </p>
                {p.creators && p.creators.length > 0 ? (
                  <CreatorStack creators={p.creators} postCount={p.postCount} />
                ) : (
                  <p className="truncate text-xs text-muted-foreground">{p.why}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
