"use client";

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef, useMemo } from "react";
import { Map, MapMarker, MarkerContent, useMap, type MapRef } from "@/components/ui/map";
import { cn } from "@/lib/utils";
import {
  getStoredMapStyle,
  applyMapStyle,
  applyLabelDensity,
  getStoredLabelDensity,
  type MapStyleKey,
  type LabelDensity,
} from "@/lib/map-styles";

interface Place {
  id: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
}

interface SavedPlace {
  id: string;
  emoji?: string | null;
  place: Place;
  savedBy?: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  } | null;
}

interface PlaceMapProps {
  places: SavedPlace[];
  selectedPlaceId: string | null;
  onMarkerClick: (savedPlaceId: string) => void;
  showSettings?: boolean;
  isSettingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
  showAvatars?: boolean;
}

export interface PlaceMapHandle {
  panTo: (lat: number, lng: number) => void;
  setZoom: (zoom: number) => void;
}

const MARKER_COLOR = "#0004EC";
const DEFAULT_CENTER: [number, number] = [-74.006, 40.7128];
const DEFAULT_ZOOM = 12;

const MAP_STORAGE_KEY = "twnsq-map-view";

function getStoredMapView(): { center: [number, number]; zoom: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(MAP_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.center && typeof parsed.zoom === "number") {
        return { center: [parsed.center.lng ?? parsed.center[0], parsed.center.lat ?? parsed.center[1]], zoom: parsed.zoom };
      }
    }
  } catch (e) {}
  return null;
}

function saveMapView(center: [number, number], zoom: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify({ center, zoom }));
  } catch (e) {}
}

function BoundsController({ places }: { places: SavedPlace[] }) {
  const { map, isLoaded } = useMap();
  const prevSignatureRef = useRef<string>("");
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (!map || !isLoaded || places.length === 0) return;

    const currentSignature = places.map(p => `${p.id}:${p.place.lat},${p.place.lng}`).sort().join("|");
    if (currentSignature === prevSignatureRef.current && hasFittedRef.current) return;
    prevSignatureRef.current = currentSignature;
    hasFittedRef.current = true;

    if (places.length === 1) {
      map.panTo({ lat: places[0].place.lat, lng: places[0].place.lng });
      map.setZoom(14);
    } else {
      const bounds = new google.maps.LatLngBounds();
      places.forEach((sp) => {
        bounds.extend({ lat: sp.place.lat, lng: sp.place.lng });
      });
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 220, left: 60 });
    }
  }, [map, isLoaded, places]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const listener = map.addListener("idle", () => {
      const center = map.getCenter();
      if (center) {
        saveMapView([center.lng(), center.lat()], map.getZoom() || DEFAULT_ZOOM);
      }
    });
    return () => { google.maps.event.removeListener(listener); };
  }, [map, isLoaded]);

  return null;
}

function StyleController() {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const handleStyleChange = (e: Event) => {
      const styleKey = (e as CustomEvent).detail as MapStyleKey;
      const density = getStoredLabelDensity();
      applyMapStyle(map, styleKey);
      applyLabelDensity(map, density, styleKey);
    };

    const handleLabelDensityChange = (e: Event) => {
      const density = (e as CustomEvent).detail as LabelDensity;
      const styleKey = getStoredMapStyle();
      applyLabelDensity(map, density, styleKey);
    };

    const initialStyleKey = getStoredMapStyle();
    const initialDensity = getStoredLabelDensity();
    applyMapStyle(map, initialStyleKey);
    applyLabelDensity(map, initialDensity, initialStyleKey);

    window.addEventListener("map-style-change", handleStyleChange);
    window.addEventListener("map-label-density-change", handleLabelDensityChange);

    return () => {
      window.removeEventListener("map-style-change", handleStyleChange);
      window.removeEventListener("map-label-density-change", handleLabelDensityChange);
    };
  }, [map, isLoaded]);

  return null;
}

export const PlaceMap = forwardRef<PlaceMapHandle, PlaceMapProps>(function PlaceMap(
  { places, selectedPlaceId, onMarkerClick, showAvatars = false },
  ref
) {
  const mapRef = useRef<MapRef>(null);

  useImperativeHandle(ref, () => ({
    panTo: (lat: number, lng: number) => {
      const m = mapRef.current;
      if (!m) return;
      m.panTo({ lat, lng });
      const currentZoom = m.getZoom() || 12;
      if (currentZoom < 14) m.setZoom(14);
    },
    setZoom: (zoom: number) => {
      mapRef.current?.setZoom(zoom);
    },
  }));

  const storedView = useMemo(() => getStoredMapView(), []);
  const initialCenter = storedView?.center || DEFAULT_CENTER;
  const initialZoom = storedView?.zoom || DEFAULT_ZOOM;

  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;

  return (
    <div className="relative h-full w-full" data-testid="map-container">
      <Map
        ref={mapRef}
        center={initialCenter}
        zoom={initialZoom}
        className="h-full w-full"
      >
        <BoundsController places={places} />
        <StyleController />
        {places.map((savedPlace) => (
          <PlaceMarker
            key={savedPlace.id}
            savedPlace={savedPlace}
            isSelected={savedPlace.id === selectedPlaceId}
            onClickRef={onMarkerClickRef}
            showAvatar={showAvatars}
          />
        ))}
      </Map>
    </div>
  );
});

function PlaceMarker({
  savedPlace,
  isSelected,
  onClickRef,
  showAvatar = false,
}: {
  savedPlace: SavedPlace;
  isSelected: boolean;
  onClickRef: React.MutableRefObject<(id: string) => void>;
  showAvatar?: boolean;
}) {
  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onClickRef.current(savedPlace.id);
    },
    [savedPlace.id, onClickRef]
  );

  const emoji = savedPlace.emoji;
  const avatarUrl = showAvatar ? savedPlace.savedBy?.profileImageUrl : null;

  return (
    <MapMarker
      longitude={savedPlace.place.lng}
      latitude={savedPlace.place.lat}
      onClick={handleClick}
    >
      <MarkerContent>
        {avatarUrl ? (
          <div
            className={cn(
              "rounded-full shadow-md transition-all duration-200 overflow-hidden hover:scale-110",
              isSelected ? "w-9 h-9 scale-110" : "w-7 h-7",
            )}
            style={{
              borderWidth: "2.5px",
              borderStyle: "solid",
              borderColor: "white",
            }}
            data-testid={`marker-${savedPlace.id}`}
          >
            <img
              src={avatarUrl}
              alt=""
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div
            className={cn(
              "flex items-center justify-center transition-all duration-200",
              emoji
                ? "text-2xl drop-shadow-md hover:scale-110"
                : "rounded-full shadow-md hover:scale-125",
              isSelected && emoji && "scale-125 drop-shadow-lg",
              isSelected && !emoji && "scale-150 shadow-lg",
            )}
            style={!emoji ? {
              width: "14px",
              height: "14px",
              backgroundColor: MARKER_COLOR,
              borderWidth: "2.5px",
              borderStyle: "solid",
              borderColor: "white",
            } : undefined}
            data-testid={`marker-${savedPlace.id}`}
          >
            {emoji || null}
          </div>
        )}
      </MarkerContent>
    </MapMarker>
  );
}
