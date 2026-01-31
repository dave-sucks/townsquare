"use client";

import { useEffect, useRef, useState } from "react";
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
}

declare global {
  interface Window {
    google: typeof google;
    initMap: () => void;
  }
}

export function PlaceMap({ places }: PlaceMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      setError("Google Maps API key not configured");
      setIsLoading(false);
      return;
    }

    if (window.google?.maps) {
      initializeMap();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = initializeMap;
    script.onerror = () => {
      setError("Failed to load Google Maps");
      setIsLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  function initializeMap() {
    if (!mapRef.current || !window.google) return;

    const mapInstance = new google.maps.Map(mapRef.current, {
      center: { lat: 40.7128, lng: -74.006 },
      zoom: 12,
      mapId: "beli-map",
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    setMap(mapInstance);
    setIsLoading(false);
  }

  useEffect(() => {
    if (!map || !window.google) return;

    markersRef.current.forEach((marker) => {
      marker.map = null;
    });
    markersRef.current = [];

    if (places.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    places.forEach((savedPlace) => {
      const { place, status } = savedPlace;
      const position = { lat: place.lat, lng: place.lng };

      const pinColor = status === "WANT" ? "#ef4444" : "#22c55e";
      
      const pinElement = document.createElement("div");
      pinElement.innerHTML = `
        <div style="
          background-color: ${pinColor};
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
            ${status === "WANT" 
              ? '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'
              : '<path d="M20 6 9 17l-5-5"/>'
            }
          </svg>
        </div>
      `;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        title: place.name,
        content: pinElement,
      });

      const infoContent = document.createElement("div");
      infoContent.style.cssText = "padding: 8px; max-width: 200px;";
      
      const nameEl = document.createElement("strong");
      nameEl.style.fontSize = "14px";
      nameEl.textContent = place.name;
      
      const addressEl = document.createElement("p");
      addressEl.style.cssText = "font-size: 12px; color: #666; margin-top: 4px;";
      addressEl.textContent = place.formattedAddress;
      
      const statusEl = document.createElement("span");
      statusEl.style.cssText = `
        display: inline-block;
        margin-top: 8px;
        padding: 2px 8px;
        background-color: ${status === "WANT" ? "#fef2f2" : "#f0fdf4"};
        color: ${status === "WANT" ? "#dc2626" : "#16a34a"};
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      `;
      statusEl.textContent = status === "WANT" ? "Want to visit" : "Been there";
      
      infoContent.appendChild(nameEl);
      infoContent.appendChild(addressEl);
      infoContent.appendChild(statusEl);
      
      const infoWindow = new google.maps.InfoWindow({
        content: infoContent,
      });

      marker.addListener("click", () => {
        infoWindow.open(map, marker);
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    if (places.length === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(14);
    } else {
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }
  }, [map, places]);

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
