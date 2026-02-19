"use client";

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef, useMemo } from "react";
import MapLibreGL from "maplibre-gl";
import { Map, MapMarker, MarkerContent, useMap, type MapRef } from "@/components/ui/map";
import { cn } from "@/lib/utils";
import { getStoredMapStyle, getMapStyleUrl, getStoredLabelDensity, getLabelStyleUrl, type MapStyleKey, type LabelDensity } from "@/lib/map-styles";

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

function BoundsController({ places, selectedPlaceId }: { places: SavedPlace[]; selectedPlaceId: string | null }) {
  const { map, isLoaded } = useMap();
  const prevPlaceIdsRef = useRef<string>("");
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (!map || !isLoaded || places.length === 0) return;

    const currentPlaceIds = places.map(p => p.id).sort().join(",");
    if (currentPlaceIds === prevPlaceIdsRef.current && hasFittedRef.current) return;
    prevPlaceIdsRef.current = currentPlaceIds;
    hasFittedRef.current = true;

    if (places.length === 1) {
      map.flyTo({
        center: [places[0].place.lng, places[0].place.lat],
        zoom: 14,
        duration: 800,
      });
    } else {
      const bounds = new MapLibreGL.LngLatBounds();
      places.forEach((sp) => {
        bounds.extend([sp.place.lng, sp.place.lat]);
      });
      map.fitBounds(bounds, {
        padding: { top: 60, right: 60, bottom: 220, left: 60 },
        maxZoom: 16,
        duration: 800,
      });
    }
  }, [map, isLoaded, places]);

  useEffect(() => {
    if (!map || !isLoaded || !selectedPlaceId) return;
    const selectedPlace = places.find(p => p.id === selectedPlaceId);
    if (selectedPlace) {
      map.flyTo({
        center: [selectedPlace.place.lng, selectedPlace.place.lat],
        zoom: Math.max(map.getZoom(), 14),
        duration: 600,
      });
    }
  }, [map, isLoaded, selectedPlaceId, places]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const handleMoveEnd = () => {
      const center = map.getCenter();
      saveMapView([center.lng, center.lat], map.getZoom());
    };
    map.on("moveend", handleMoveEnd);
    return () => { map.off("moveend", handleMoveEnd); };
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
      const url = density === "minimal" ? getLabelStyleUrl(styleKey, density) : getMapStyleUrl(styleKey);
      map.setStyle(url);
    };

    const handleLabelDensityChange = (e: Event) => {
      const density = (e as CustomEvent).detail as LabelDensity;
      const styleKey = getStoredMapStyle();
      const url = getLabelStyleUrl(styleKey, density);
      map.setStyle(url);
    };

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
  { places, selectedPlaceId, onMarkerClick },
  ref
) {
  const mapRef = useRef<MapRef>(null);

  useImperativeHandle(ref, () => ({
    panTo: (lat: number, lng: number) => {
      mapRef.current?.flyTo({ center: [lng, lat], duration: 600 });
    },
    setZoom: (zoom: number) => {
      mapRef.current?.setZoom(zoom);
    },
  }));

  const storedView = useMemo(() => getStoredMapView(), []);
  const initialCenter = storedView?.center || DEFAULT_CENTER;
  const initialZoom = storedView?.zoom || DEFAULT_ZOOM;

  const initialStyle = useMemo(() => {
    const styleKey = getStoredMapStyle();
    const density = getStoredLabelDensity();
    return getLabelStyleUrl(styleKey, density);
  }, []);

  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;

  return (
    <div className="relative h-full w-full" data-testid="map-container">
      <Map
        ref={mapRef}
        center={initialCenter}
        zoom={initialZoom}
        className="h-full w-full"
        styles={{ light: initialStyle, dark: initialStyle }}
      >
        <BoundsController places={places} selectedPlaceId={selectedPlaceId} />
        <StyleController />
        {places.map((savedPlace) => (
          <PlaceMarker
            key={savedPlace.id}
            savedPlace={savedPlace}
            isSelected={savedPlace.id === selectedPlaceId}
            onClickRef={onMarkerClickRef}
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
}: {
  savedPlace: SavedPlace;
  isSelected: boolean;
  onClickRef: React.MutableRefObject<(id: string) => void>;
}) {
  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onClickRef.current(savedPlace.id);
    },
    [savedPlace.id, onClickRef]
  );

  const emoji = savedPlace.emoji;

  return (
    <MapMarker
      longitude={savedPlace.place.lng}
      latitude={savedPlace.place.lat}
      onClick={handleClick}
    >
      <MarkerContent>
        <div
          className={cn(
            "flex items-center justify-center transition-all duration-200",
            emoji
              ? "text-2xl drop-shadow-md hover:scale-110"
              : "w-3.5 h-3.5 rounded-full border-2 shadow-md hover:scale-125",
            isSelected && emoji && "scale-125 drop-shadow-lg",
            isSelected && !emoji && "scale-150 ring-2 ring-white shadow-lg",
          )}
          style={!emoji ? {
            backgroundColor: MARKER_COLOR,
            borderColor: isSelected ? "white" : "rgba(255,255,255,0.8)",
          } : undefined}
          data-testid={`marker-${savedPlace.id}`}
        >
          {emoji || null}
        </div>
      </MarkerContent>
    </MapMarker>
  );
}
