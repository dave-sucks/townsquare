"use client";

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type MapStyleKey,
  type LabelDensity,
  applyMapStyle,
  getStoredMapStyle,
  saveMapStyle,
  getStoredLabelDensity,
  saveLabelDensity,
  RETRO_STYLE,
  DEFAULT_LABEL_DENSITY,
} from "@/lib/map-styles";
import { MapSettingsPopover } from "@/components/map-settings-popover";
import { FloatingSearch } from "@/components/map/floating-search";

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
  showSettings?: boolean;
  showSearch?: boolean;
  isSettingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
}

export interface PlaceMapHandle {
  panTo: (lat: number, lng: number) => void;
  setZoom: (zoom: number) => void;
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

function createMarkerIcon(status: "WANT" | "BEEN", isSelected: boolean): google.maps.Symbol {
  const color = isSelected ? MARKER_COLORS.selected : (status === "WANT" ? MARKER_COLORS.want : MARKER_COLORS.been);
  const scale = isSelected ? 10 : 8;
  
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: scale,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "white",
    strokeWeight: isSelected ? 3 : 2,
  };
}

const RADIUS_TO_ZOOM: Record<number, number> = {
  0.25: 15.5,
  0.5: 14.5,
  0.75: 14,
  1: 13.5,
  1.5: 13,
  2: 12.5,
  3: 12,
  4: 11.5,
  5: 11,
  7: 10.5,
  10: 10,
};

export const PlaceMap = forwardRef<PlaceMapHandle, PlaceMapProps>(function PlaceMap(
  { places, selectedPlaceId, onMarkerClick, showSettings = true, showSearch = false, isSettingsOpen, onSettingsOpenChange },
  ref
) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  
  const [currentStyle, setCurrentStyle] = useState<MapStyleKey>("retro");
  const [showTraffic, setShowTraffic] = useState(false);
  const [showTransit, setShowTransit] = useState(false);
  const [radius, setRadius] = useState(1);
  const [labelDensity, setLabelDensity] = useState<LabelDensity>(DEFAULT_LABEL_DENSITY);
  
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const transitLayerRef = useRef<google.maps.TransitLayer | null>(null);

  useImperativeHandle(ref, () => ({
    panTo: (lat: number, lng: number) => {
      map?.panTo({ lat, lng });
    },
    setZoom: (zoom: number) => {
      map?.setZoom(zoom);
    },
  }));

  const initMapCallback = useCallback(() => {
    if (!mapRef.current || !window.google) return;

    const storedView = getStoredMapView();
    const storedStyle = getStoredMapStyle();
    const storedDensity = getStoredLabelDensity();
    const initialCenter = storedView?.center || DEFAULT_CENTER;
    const initialZoom = storedView?.zoom || DEFAULT_ZOOM;

    const mapInstance = new google.maps.Map(mapRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: RETRO_STYLE,
    });

    mapInstance.addListener("idle", () => {
      const center = mapInstance.getCenter();
      const zoom = mapInstance.getZoom();
      if (center && zoom !== undefined) {
        saveMapView({ lat: center.lat(), lng: center.lng() }, zoom);
      }
    });

    trafficLayerRef.current = new google.maps.TrafficLayer();
    transitLayerRef.current = new google.maps.TransitLayer();

    setMap(mapInstance);
    setCurrentStyle(storedStyle);
    setLabelDensity(storedDensity);
    setIsLoading(false);

    // Apply the stored style and label density
    applyMapStyle(mapInstance, storedStyle, storedDensity);
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly`;
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

  const handleStyleChange = useCallback((style: MapStyleKey) => {
    if (!map) return;
    setCurrentStyle(style);
    saveMapStyle(style);
    applyMapStyle(map, style, labelDensity);
  }, [map, labelDensity]);

  useEffect(() => {
    const handleExternalStyleChange = (event: Event) => {
      const customEvent = event as CustomEvent<MapStyleKey>;
      if (customEvent.detail && map) {
        setCurrentStyle(customEvent.detail);
        saveMapStyle(customEvent.detail);
        applyMapStyle(map, customEvent.detail, labelDensity);
      }
    };

    const handleExternalLabelDensityChange = (event: Event) => {
      const customEvent = event as CustomEvent<LabelDensity>;
      if (customEvent.detail && map) {
        setLabelDensity(customEvent.detail);
        saveLabelDensity(customEvent.detail);
        applyMapStyle(map, currentStyle, customEvent.detail);
      }
    };

    const handleExternalRadiusChange = (event: Event) => {
      const customEvent = event as CustomEvent<number>;
      if (customEvent.detail !== undefined && map) {
        setRadius(customEvent.detail);
        const zoom = RADIUS_TO_ZOOM[customEvent.detail] || 12;
        map.setZoom(zoom);
      }
    };

    const handleExternalTrafficChange = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      if (customEvent.detail !== undefined) {
        setShowTraffic(customEvent.detail);
        if (trafficLayerRef.current) {
          trafficLayerRef.current.setMap(customEvent.detail ? map : null);
        }
      }
    };

    const handleExternalTransitChange = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      if (customEvent.detail !== undefined) {
        setShowTransit(customEvent.detail);
        if (transitLayerRef.current) {
          transitLayerRef.current.setMap(customEvent.detail ? map : null);
        }
      }
    };

    window.addEventListener("map-style-change", handleExternalStyleChange);
    window.addEventListener("map-label-density-change", handleExternalLabelDensityChange);
    window.addEventListener("map-radius-change", handleExternalRadiusChange);
    window.addEventListener("map-traffic-change", handleExternalTrafficChange);
    window.addEventListener("map-transit-change", handleExternalTransitChange);
    return () => {
      window.removeEventListener("map-style-change", handleExternalStyleChange);
      window.removeEventListener("map-label-density-change", handleExternalLabelDensityChange);
      window.removeEventListener("map-radius-change", handleExternalRadiusChange);
      window.removeEventListener("map-traffic-change", handleExternalTrafficChange);
      window.removeEventListener("map-transit-change", handleExternalTransitChange);
    };
  }, [map, labelDensity, currentStyle]);

  const handleLabelDensityChange = useCallback((density: LabelDensity) => {
    if (!map) return;
    setLabelDensity(density);
    saveLabelDensity(density);
    applyMapStyle(map, currentStyle, density);
  }, [map, currentStyle]);

  const handleTrafficChange = useCallback((show: boolean) => {
    setShowTraffic(show);
    if (trafficLayerRef.current) {
      trafficLayerRef.current.setMap(show ? map : null);
    }
  }, [map]);

  const handleTransitChange = useCallback((show: boolean) => {
    setShowTransit(show);
    if (transitLayerRef.current) {
      transitLayerRef.current.setMap(show ? map : null);
    }
  }, [map]);

  const handleRadiusChange = useCallback((newRadius: number) => {
    setRadius(newRadius);
    if (map) {
      const zoom = RADIUS_TO_ZOOM[newRadius] || 12;
      map.setZoom(zoom);
    }
  }, [map]);

  useEffect(() => {
    if (!map || !window.google) return;

    markersRef.current.forEach((marker) => {
      marker.setMap(null);
    });
    markersRef.current.clear();

    if (places.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    places.forEach((savedPlace) => {
      const { place, status, id } = savedPlace;
      const position = { lat: place.lat, lng: place.lng };
      const isSelected = id === selectedPlaceId;

      const marker = new google.maps.Marker({
        map,
        position,
        title: place.name,
        icon: createMarkerIcon(status, isSelected),
        zIndex: isSelected ? 1000 : 1,
      });

      marker.addListener("click", () => {
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
        marker.setIcon(createMarkerIcon(savedPlace.status, isSelected));
        marker.setZIndex(isSelected ? 1000 : 1);
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
      {showSearch && !isLoading && (
        <FloatingSearch />
      )}
      {showSettings && !isLoading && (
        <MapSettingsPopover
          currentStyle={currentStyle}
          onStyleChange={handleStyleChange}
          showTraffic={showTraffic}
          onTrafficChange={handleTrafficChange}
          showTransit={showTransit}
          onTransitChange={handleTransitChange}
          radius={radius}
          onRadiusChange={handleRadiusChange}
          labelDensity={labelDensity}
          onLabelDensityChange={handleLabelDensityChange}
          isOpen={isSettingsOpen}
          onOpenChange={onSettingsOpenChange}
        />
      )}
    </div>
  );
});
