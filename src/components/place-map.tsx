"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";

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
  status: "WANT" | "BEEN";
  place: Place;
}

interface PlaceMapProps {
  places: SavedPlace[];
  selectedPlaceId: string | null;
  onMarkerClick: (savedPlaceId: string) => void;
}

declare global {
  interface Window {
    google: typeof google;
    __googleMapsLoading?: boolean;
    __googleMapsCallbacks?: (() => void)[];
  }
}

const MARKER_COLORS = {
  want: "#ef4444",
  been: "#22c55e",
  selected: "#3b82f6",
};

const MAP_STORAGE_KEY = "beli-map-view";
const DEFAULT_CENTER = { lat: 40.7128, lng: -74.006 };
const DEFAULT_ZOOM = 12;

function getStoredMapView(): { center: { lat: number; lng: number }; zoom: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(MAP_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.center && typeof parsed.zoom === "number") {
        return parsed;
      }
    }
  } catch (e) {
    // Ignore parse errors
  }
  return null;
}

function saveMapView(center: { lat: number; lng: number }, zoom: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify({ center, zoom }));
  } catch (e) {
    // Ignore storage errors
  }
}

const MARKER_SIZE = {
  default: 24,
  selected: 32,
};

function createMarkerContent(status: "WANT" | "BEEN", isSelected: boolean): HTMLElement {
  const size = isSelected ? MARKER_SIZE.selected : MARKER_SIZE.default;
  const color = isSelected ? MARKER_COLORS.selected : (status === "WANT" ? MARKER_COLORS.want : MARKER_COLORS.been);
  const iconSize = isSelected ? 16 : 12;
  
  const pinElement = document.createElement("div");
  pinElement.style.cssText = `
    background-color: ${color};
    border-radius: 50%;
    width: ${size}px;
    height: ${size}px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: ${isSelected ? "3px" : "2px"} solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    transition: all 0.2s ease;
    cursor: pointer;
    ${isSelected ? "z-index: 1000;" : ""}
  `;
  
  pinElement.innerHTML = `
    <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
      ${status === "WANT" 
        ? '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'
        : '<path d="M20 6 9 17l-5-5"/>'
      }
    </svg>
  `;

  return pinElement;
}

export function PlaceMap({ places, selectedPlaceId, onMarkerClick }: PlaceMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());

  const initMapCallback = useCallback(() => {
    if (!mapRef.current || !window.google) return;

    const storedView = getStoredMapView();
    const initialCenter = storedView?.center || DEFAULT_CENTER;
    const initialZoom = storedView?.zoom || DEFAULT_ZOOM;

    const mapInstance = new google.maps.Map(mapRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      mapId: "beli-map",
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    // Persist map view on idle (after user interaction)
    mapInstance.addListener("idle", () => {
      const center = mapInstance.getCenter();
      const zoom = mapInstance.getZoom();
      if (center && zoom !== undefined) {
        saveMapView({ lat: center.lat(), lng: center.lng() }, zoom);
      }
    });

    setMap(mapInstance);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      setError("Google Maps API key not configured");
      setIsLoading(false);
      return;
    }

    if (window.google?.maps) {
      initMapCallback();
      return;
    }

    if (window.__googleMapsLoading) {
      window.__googleMapsCallbacks = window.__googleMapsCallbacks || [];
      window.__googleMapsCallbacks.push(initMapCallback);
      return;
    }

    window.__googleMapsLoading = true;
    window.__googleMapsCallbacks = [initMapCallback];

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.__googleMapsCallbacks?.forEach(cb => cb());
      window.__googleMapsCallbacks = [];
    };
    script.onerror = () => {
      setError("Failed to load Google Maps");
      setIsLoading(false);
      window.__googleMapsLoading = false;
    };
    document.head.appendChild(script);
  }, [initMapCallback]);

  useEffect(() => {
    if (!map || !window.google) return;

    markersRef.current.forEach((marker) => {
      marker.map = null;
    });
    markersRef.current.clear();

    if (places.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    places.forEach((savedPlace) => {
      const { place, status, id } = savedPlace;
      const position = { lat: place.lat, lng: place.lng };
      const isSelected = id === selectedPlaceId;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        title: place.name,
        content: createMarkerContent(status, isSelected),
        zIndex: isSelected ? 1000 : 1,
      });

      marker.addListener("gmp-click", () => {
        onMarkerClick(id);
      });

      markersRef.current.set(id, marker);
      bounds.extend(position);
    });

    if (places.length === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(14);
    } else if (!selectedPlaceId) {
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }
  }, [map, places, selectedPlaceId, onMarkerClick]);

  useEffect(() => {
    if (!map || !selectedPlaceId) return;

    const selectedPlace = places.find(p => p.id === selectedPlaceId);
    if (selectedPlace) {
      const position = { lat: selectedPlace.place.lat, lng: selectedPlace.place.lng };
      map.panTo(position);
      const currentZoom = map.getZoom() || 12;
      if (currentZoom < 14) {
        map.setZoom(15);
      }
    }
  }, [map, selectedPlaceId, places]);

  useEffect(() => {
    if (!map || !window.google) return;

    markersRef.current.forEach((marker, id) => {
      const savedPlace = places.find(p => p.id === id);
      if (savedPlace) {
        const isSelected = id === selectedPlaceId;
        marker.content = createMarkerContent(savedPlace.status, isSelected);
        marker.zIndex = isSelected ? 1000 : 1;
      }
    });
  }, [selectedPlaceId, places, map]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-muted">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
          <Skeleton className="h-full w-full" />
        </div>
      )}
      <div ref={mapRef} className="h-full w-full" data-testid="map-container" />
    </div>
  );
}
