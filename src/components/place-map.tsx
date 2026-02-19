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

declare global {
  interface Window {
    google: typeof google;
    __googleMapsLoading?: boolean;
    __googleMapsCallbacks?: (() => void)[];
  }
}

const MARKER_COLOR = "#0004EC";
const MARKER_COLOR_SELECTED = "#0004EC";

const MAP_STORAGE_KEY = "twnsq-map-view";
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

function createMarkerIcon(isSelected: boolean): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: isSelected ? 10 : 8,
    fillColor: MARKER_COLOR,
    fillOpacity: 1,
    strokeColor: isSelected ? MARKER_COLOR_SELECTED : "white",
    strokeWeight: isSelected ? 3 : 2,
  };
}

interface EmojiOverlay extends google.maps.OverlayView {
  setClickHandler: (handler: () => void) => void;
  updateSelection: (isSelected: boolean) => void;
}

function createEmojiMarkerOverlay(
  position: google.maps.LatLngLiteral,
  emoji: string,
  isSelected: boolean
): EmojiOverlay {
  const overlay = new google.maps.OverlayView() as EmojiOverlay & {
    position: google.maps.LatLng;
    emoji: string;
    isSelected: boolean;
    div: HTMLDivElement | null;
    clickHandler: (() => void) | null;
  };
  
  overlay.position = new google.maps.LatLng(position.lat, position.lng);
  overlay.emoji = emoji;
  overlay.isSelected = isSelected;
  overlay.div = null;
  overlay.clickHandler = null;

  overlay.setClickHandler = function(handler: () => void) {
    this.clickHandler = handler;
  };

  overlay.onAdd = function() {
    this.div = document.createElement("div");
    this.div.style.cssText = `
      position: absolute;
      font-size: ${this.isSelected ? "32px" : "24px"};
      cursor: pointer;
      transition: transform 0.15s ease;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      transform: translate(-50%, -100%);
      ${this.isSelected ? "z-index: 1000;" : "z-index: 1;"}
    `;
    this.div.textContent = this.emoji;
    
    if (this.clickHandler) {
      const handler = this.clickHandler;
      this.div.addEventListener("click", (e) => {
        e.stopPropagation();
        handler();
      });
    }

    const panes = this.getPanes();
    panes?.overlayMouseTarget.appendChild(this.div);
  };

  overlay.draw = function() {
    if (!this.div) return;
    const overlayProjection = this.getProjection();
    const pos = overlayProjection.fromLatLngToDivPixel(this.position);
    if (pos) {
      this.div.style.left = pos.x + "px";
      this.div.style.top = pos.y + "px";
    }
  };

  overlay.onRemove = function() {
    if (this.div) {
      this.div.parentNode?.removeChild(this.div);
      this.div = null;
    }
  };

  overlay.updateSelection = function(selected: boolean) {
    this.isSelected = selected;
    if (this.div) {
      this.div.style.fontSize = selected ? "32px" : "24px";
      this.div.style.zIndex = selected ? "1000" : "1";
    }
  };

  return overlay;
}

interface AvatarOverlay extends google.maps.OverlayView {
  setClickHandler: (handler: () => void) => void;
  updateSelection: (isSelected: boolean) => void;
}

function createAvatarMarkerOverlay(
  position: google.maps.LatLngLiteral,
  imageUrl: string,
  isSelected: boolean
): AvatarOverlay {
  const overlay = new google.maps.OverlayView() as AvatarOverlay & {
    position: google.maps.LatLng;
    imageUrl: string;
    isSelected: boolean;
    div: HTMLDivElement | null;
    clickHandler: (() => void) | null;
  };

  overlay.position = new google.maps.LatLng(position.lat, position.lng);
  overlay.imageUrl = imageUrl;
  overlay.isSelected = isSelected;
  overlay.div = null;
  overlay.clickHandler = null;

  overlay.setClickHandler = function(handler: () => void) {
    this.clickHandler = handler;
  };

  overlay.onAdd = function() {
    this.div = document.createElement("div");
    const size = this.isSelected ? 24 : 20;
    const borderWidth = this.isSelected ? 3 : 2;
    this.div.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      cursor: pointer;
      transition: all 0.15s ease;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      border: ${borderWidth}px solid ${this.isSelected ? MARKER_COLOR : "white"};
      overflow: hidden;
      ${this.isSelected ? "z-index: 1000;" : "z-index: 1;"}
    `;

    const imgUrl = this.imageUrl.startsWith("http")
      ? `/api/proxy-image?url=${encodeURIComponent(this.imageUrl)}`
      : this.imageUrl;

    const img = document.createElement("img");
    img.src = imgUrl;
    img.alt = "";
    img.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    `;
    img.onerror = () => {
      img.style.display = "none";
      if (this.div) {
        this.div.style.background = MARKER_COLOR;
      }
    };
    this.div.appendChild(img);

    if (this.clickHandler) {
      const handler = this.clickHandler;
      this.div.addEventListener("click", (e) => {
        e.stopPropagation();
        handler();
      });
    }

    const panes = this.getPanes();
    if (panes) {
      panes.overlayMouseTarget.appendChild(this.div);
    }
  };

  overlay.draw = function() {
    if (!this.div) return;
    const overlayProjection = this.getProjection();
    const pos = overlayProjection.fromLatLngToDivPixel(this.position);
    if (pos) {
      this.div.style.left = pos.x + "px";
      this.div.style.top = pos.y + "px";
    }
  };

  overlay.onRemove = function() {
    if (this.div) {
      this.div.parentNode?.removeChild(this.div);
      this.div = null;
    }
  };

  overlay.updateSelection = function(selected: boolean) {
    this.isSelected = selected;
    if (this.div) {
      const size = selected ? 24 : 20;
      const borderWidth = selected ? 3 : 2;
      this.div.style.width = size + "px";
      this.div.style.height = size + "px";
      this.div.style.zIndex = selected ? "1000" : "1";
      this.div.style.border = `${borderWidth}px solid ${selected ? MARKER_COLOR : "white"}`;
    }
  };

  return overlay;
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
  { places, selectedPlaceId, onMarkerClick, showSettings = true, isSettingsOpen, onSettingsOpenChange },
  ref
) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker | EmojiOverlay | AvatarOverlay>>(new Map());
  
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
      gestureHandling: "greedy",
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=marker`;
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
      const { place, id, emoji } = savedPlace;
      const position = { lat: place.lat, lng: place.lng };
      const isSelected = id === selectedPlaceId;

      let marker: google.maps.Marker | EmojiOverlay | AvatarOverlay;

      if (savedPlace.savedBy?.profileImageUrl) {
        const overlay = createAvatarMarkerOverlay(position, savedPlace.savedBy.profileImageUrl, isSelected);
        overlay.setClickHandler(() => onMarkerClick(id));
        overlay.setMap(map);
        marker = overlay;
      } else if (emoji) {
        const overlay = createEmojiMarkerOverlay(position, emoji, isSelected);
        overlay.setClickHandler(() => onMarkerClick(id));
        overlay.setMap(map);
        marker = overlay;
      } else {
        marker = new google.maps.Marker({
          map,
          position,
          title: place.name,
          icon: createMarkerIcon(isSelected),
          zIndex: isSelected ? 1000 : 1,
        });
        marker.addListener("click", () => {
          onMarkerClick(id);
        });
      }

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
        
        if (marker instanceof google.maps.Marker) {
          marker.setIcon(createMarkerIcon(isSelected));
          marker.setZIndex(isSelected ? 1000 : 1);
        } else if ('updateSelection' in marker) {
          marker.updateSelection(isSelected);
        }
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
      <div ref={mapRef} className="h-full w-full relative z-0" data-testid="map-container" />
    </div>
  );
});
