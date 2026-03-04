"use client";

import { useState, useCallback } from "react";
import { useMap } from "@/components/ui/map";
import { useMapSettings } from "@/hooks/use-map-settings";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Plus, Minus, Navigation, Shrink } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { SlidersHorizontalIcon } from "@hugeicons/core-free-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MapSettingsContent } from "@/components/map-settings-content";

interface MapControlsProps {
  places?: Array<{ place: { lat: number; lng: number } }>;
}

export function MapControls({ places }: MapControlsProps) {
  const { map } = useMap();
  const [locating, setLocating] = useState(false);
  const { style, setStyle, labelDensity, setLabelDensity, radius, setRadius } =
    useMapSettings();

  const handleZoomIn = useCallback(() => {
    if (!map) return;
    map.setZoom((map.getZoom() || 12) + 1);
  }, [map]);

  const handleZoomOut = useCallback(() => {
    if (!map) return;
    map.setZoom((map.getZoom() || 12) - 1);
  }, [map]);

  const handleLocateMe = useCallback(() => {
    if (!map || locating) return;
    if (!("geolocation" in navigator)) return;
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.panTo({ lat: latitude, lng: longitude });
        map.setZoom(12);
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [map, locating]);

  const handleFitAll = useCallback(() => {
    if (!map || !places || places.length === 0) return;

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
  }, [map, places]);

  return (
    <div
      className="absolute bottom-24 md:bottom-6 right-3 z-20 flex flex-col gap-2"
      data-testid="map-controls"
    >
      {/* Zoom +/- */}
      <div className="flex flex-col bg-background/90 backdrop-blur-sm rounded-md border shadow-md">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomIn}
          aria-label="Zoom in"
          data-testid="button-zoom-in"
          className="rounded-b-none"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Separator className="mx-1.5 w-auto" />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomOut}
          aria-label="Zoom out"
          data-testid="button-zoom-out"
          className="rounded-t-none"
        >
          <Minus className="h-4 w-4" />
        </Button>
      </div>

      {/* Locate me */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleLocateMe}
        disabled={locating}
        aria-label="Go to my location"
        data-testid="button-locate-me"
        className={cn(
          "bg-background/90 backdrop-blur-sm border shadow-md",
          locating && "text-primary animate-pulse"
        )}
      >
        <Navigation className="h-4 w-4" />
      </Button>

      {/* Fit all places */}
      {places && places.length > 0 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleFitAll}
          aria-label="Fit all places in view"
          data-testid="button-fit-all"
          className="bg-background/90 backdrop-blur-sm border shadow-md"
        >
          <Shrink className="h-4 w-4" />
        </Button>
      )}

      {/* Map settings */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Map settings"
            data-testid="button-map-settings"
            className="bg-background/90 backdrop-blur-sm border shadow-md"
          >
            <HugeiconsIcon icon={SlidersHorizontalIcon} className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="left"
          align="end"
          sideOffset={8}
          className="w-80 p-4"
          data-testid="map-settings-popover"
        >
          <h3 className="font-semibold text-sm mb-4">Map Settings</h3>
          <MapSettingsContent
            currentStyle={style}
            onStyleChange={setStyle}
            radius={radius}
            onRadiusChange={setRadius}
            labelDensity={labelDensity}
            onLabelDensityChange={setLabelDensity}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
