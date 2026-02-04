"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { MapSettingsContent } from "@/components/map-settings-content";
import { useMapSettings } from "@/hooks/use-map-settings";

interface MapSettingsPanelProps {
  onBack: () => void;
}

export function MapSettingsPanel({ onBack }: MapSettingsPanelProps) {
  const mapSettings = useMapSettings();

  return (
    <div className="h-full flex flex-col bg-background" data-testid="map-settings-panel">
      <div className="flex items-center gap-2 p-3 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          data-testid="button-close-settings"
        >
          <X className="h-4 w-4" />
        </Button>
        <h1 className="font-semibold text-sm flex-1 font-brand">Map Settings</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <MapSettingsContent
          currentStyle={mapSettings.style}
          onStyleChange={mapSettings.setStyle}
          showTraffic={mapSettings.showTraffic}
          onTrafficChange={mapSettings.setShowTraffic}
          showTransit={mapSettings.showTransit}
          onTransitChange={mapSettings.setShowTransit}
          radius={mapSettings.radius}
          onRadiusChange={mapSettings.setRadius}
          labelDensity={mapSettings.labelDensity}
          onLabelDensityChange={mapSettings.setLabelDensity}
        />
      </div>
    </div>
  );
}
