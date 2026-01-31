"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { X, Car, TrainFront } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MAP_STYLES,
  type MapStyleKey,
  type LabelDensity,
  LABEL_DENSITY_OPTIONS,
} from "@/lib/map-styles";

interface MapSettingsPopoverProps {
  currentStyle: MapStyleKey;
  onStyleChange: (style: MapStyleKey) => void;
  showTraffic: boolean;
  onTrafficChange: (show: boolean) => void;
  showTransit: boolean;
  onTransitChange: (show: boolean) => void;
  radius: number;
  onRadiusChange: (radius: number) => void;
  labelDensity: LabelDensity;
  onLabelDensityChange: (density: LabelDensity) => void;
}

const RADIUS_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7, 10];

function MapStyleThumbnail({ styleId, isSelected }: { styleId: MapStyleKey; isSelected: boolean }) {
  const thumbnails: Record<MapStyleKey, React.ReactNode> = {
    standard: (
      <svg viewBox="0 0 80 60" className="w-full h-full">
        <rect fill="#f5f5f5" width="80" height="60" />
        <path d="M0 42 Q25 36, 50 44 Q68 52, 80 48 L80 60 L0 60 Z" fill="#aadaff" opacity="0.8" />
        <rect fill="#c8e4c8" x="52" y="6" width="16" height="12" rx="2" />
        <rect fill="#c8e4c8" x="6" y="24" width="10" height="10" rx="2" />
        <path d="M0 18 L80 18" stroke="#e8e8e8" strokeWidth="3.5" />
        <path d="M35 0 L35 42" stroke="#e8e8e8" strokeWidth="3.5" />
      </svg>
    ),
    satellite: (
      <svg viewBox="0 0 80 60" className="w-full h-full">
        <defs>
          <linearGradient id="sat-base" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a2a" />
            <stop offset="50%" stopColor="#2a4a38" />
            <stop offset="100%" stopColor="#152a20" />
          </linearGradient>
        </defs>
        <rect fill="url(#sat-base)" width="80" height="60" />
        <path d="M0 45 Q30 38, 50 48 Q65 55, 80 50 L80 60 L0 60 Z" fill="#1a3040" opacity="0.7" />
        <rect fill="#4a5058" x="6" y="8" width="18" height="14" opacity="0.85" />
        <rect fill="#4a5058" x="46" y="14" width="20" height="16" opacity="0.85" />
        <path d="M0 22 L80 22" stroke="#5a6068" strokeWidth="1.5" opacity="0.5" />
      </svg>
    ),
    terrain: (
      <svg viewBox="0 0 80 60" className="w-full h-full">
        <defs>
          <linearGradient id="terrain-base" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#d8e8c8" />
            <stop offset="50%" stopColor="#e0d8c0" />
            <stop offset="100%" stopColor="#f0e8dc" />
          </linearGradient>
        </defs>
        <rect fill="url(#terrain-base)" width="80" height="60" />
        <path d="M50 60 L65 20 L80 60 Z" fill="#d0c8b8" opacity="0.6" />
        <path d="M0 60 L20 35 L40 60 Z" fill="#d0c8b8" opacity="0.4" />
        <path d="M0 44 Q25 38, 50 44 T80 40" fill="none" stroke="#b8c0a8" strokeWidth="0.6" />
        <path d="M0 36 Q30 28, 55 34 T80 30" fill="none" stroke="#b8c0a8" strokeWidth="0.6" />
      </svg>
    ),
    silver: (
      <svg viewBox="0 0 80 60" className="w-full h-full">
        <rect fill="#f5f5f5" width="80" height="60" />
        <path d="M0 42 Q25 36, 50 44 Q68 52, 80 48 L80 60 L0 60 Z" fill="#c9c9c9" opacity="0.8" />
        <rect fill="#e5e5e5" x="52" y="6" width="16" height="12" rx="2" />
        <path d="M0 18 L80 18" stroke="#ffffff" strokeWidth="3" />
        <path d="M35 0 L35 42" stroke="#ffffff" strokeWidth="3" />
      </svg>
    ),
    retro: (
      <svg viewBox="0 0 80 60" className="w-full h-full">
        <rect fill="#ebe3cd" width="80" height="60" />
        <path d="M0 42 Q25 36, 50 44 Q68 52, 80 48 L80 60 L0 60 Z" fill="#b9d3c2" opacity="0.8" />
        <rect fill="#a5b076" x="52" y="6" width="16" height="12" rx="2" />
        <rect fill="#a5b076" x="6" y="24" width="10" height="10" rx="2" />
        <path d="M0 18 L80 18" stroke="#f5f1e6" strokeWidth="3" />
        <path d="M35 0 L35 42" stroke="#f8c967" strokeWidth="2.5" />
      </svg>
    ),
    dark: (
      <svg viewBox="0 0 80 60" className="w-full h-full">
        <rect fill="#212121" width="80" height="60" />
        <path d="M0 42 Q25 36, 50 44 Q68 52, 80 48 L80 60 L0 60 Z" fill="#000000" opacity="0.8" />
        <rect fill="#181818" x="52" y="6" width="16" height="12" rx="2" />
        <path d="M0 18 L80 18" stroke="#2c2c2c" strokeWidth="3" />
        <path d="M35 0 L35 42" stroke="#3c3c3c" strokeWidth="2.5" />
      </svg>
    ),
    night: (
      <svg viewBox="0 0 80 60" className="w-full h-full">
        <rect fill="#242f3e" width="80" height="60" />
        <path d="M0 42 Q25 36, 50 44 Q68 52, 80 48 L80 60 L0 60 Z" fill="#17263c" opacity="0.8" />
        <rect fill="#263c3f" x="52" y="6" width="16" height="12" rx="2" />
        <path d="M0 18 L80 18" stroke="#38414e" strokeWidth="3" />
        <path d="M35 0 L35 42" stroke="#746855" strokeWidth="2.5" />
      </svg>
    ),
    aubergine: (
      <svg viewBox="0 0 80 60" className="w-full h-full">
        <rect fill="#1d2c4d" width="80" height="60" />
        <path d="M0 42 Q25 36, 50 44 Q68 52, 80 48 L80 60 L0 60 Z" fill="#0e1626" opacity="0.8" />
        <rect fill="#283d6a" x="52" y="6" width="16" height="12" rx="2" />
        <path d="M0 18 L80 18" stroke="#304a7d" strokeWidth="3" />
        <path d="M35 0 L35 42" stroke="#2c6675" strokeWidth="2.5" />
      </svg>
    ),
  };

  return (
    <div
      className={cn(
        "w-full aspect-[4/3] rounded-md overflow-hidden border-2 transition-all",
        isSelected ? "border-primary ring-2 ring-primary/20" : "border-transparent"
      )}
    >
      {thumbnails[styleId]}
    </div>
  );
}

export function MapSettingsPopover({
  currentStyle,
  onStyleChange,
  showTraffic,
  onTrafficChange,
  showTransit,
  onTransitChange,
  radius,
  onRadiusChange,
  labelDensity,
  onLabelDensityChange,
}: MapSettingsPopoverProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentRadiusIndex = RADIUS_STEPS.findIndex((r) => r >= radius) || 0;
  const displayRadius = RADIUS_STEPS[currentRadiusIndex] || 1;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-radix-popper-content-wrapper]")) return;
      if (!containerRef.current?.contains(target)) {
        setIsExpanded(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExpanded(false);
    };

    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isExpanded]);

  const handleSliderChange = (value: number[]) => {
    const index = Math.round((value[0] / 100) * (RADIUS_STEPS.length - 1));
    onRadiusChange(RADIUS_STEPS[index]);
  };

  const sliderValue = (currentRadiusIndex / (RADIUS_STEPS.length - 1)) * 100;

  return (
    <div ref={containerRef} className="absolute bottom-4 right-4 z-10">
      {isExpanded && (
        <div className="absolute bottom-[calc(100%+8px)] right-0 w-[300px] bg-background/95 backdrop-blur-xl border rounded-lg shadow-lg animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-medium text-sm">Map details</h3>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsExpanded(false)}
              data-testid="button-close-map-settings"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-3 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Map Style</Label>
              <div className="grid grid-cols-4 gap-2">
                {MAP_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => onStyleChange(style.id)}
                    className="flex flex-col items-center gap-1 group"
                    data-testid={`button-style-${style.id}`}
                  >
                    <MapStyleThumbnail styleId={style.id} isSelected={currentStyle === style.id} />
                    <span className={cn(
                      "text-[10px] transition-colors",
                      currentStyle === style.id ? "text-primary font-medium" : "text-muted-foreground"
                    )}>
                      {style.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Label Density</Label>
              <div className="grid grid-cols-4 gap-1">
                {LABEL_DENSITY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => onLabelDensityChange(option.id)}
                    className={cn(
                      "px-2 py-1.5 text-xs rounded-md transition-colors",
                      labelDensity === option.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover-elevate"
                    )}
                    data-testid={`button-density-${option.id}`}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Map radius</Label>
                <span className="text-sm font-medium">{displayRadius < 1 ? `${displayRadius * 4}/4` : displayRadius} mi</span>
              </div>
              <Slider
                value={[sliderValue]}
                max={100}
                step={1}
                onValueChange={handleSliderChange}
                data-testid="slider-map-radius"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1/4 mi</span>
                <span>10 mi</span>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Overlays</Label>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Traffic</span>
                </div>
                <Switch
                  checked={showTraffic}
                  onCheckedChange={onTrafficChange}
                  data-testid="switch-traffic"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrainFront className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Transit</span>
                </div>
                <Switch
                  checked={showTransit}
                  onCheckedChange={onTransitChange}
                  data-testid="switch-transit"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white shadow-lg hover-elevate"
        data-testid="button-map-settings"
      >
        <MapStyleThumbnail styleId={currentStyle} isSelected={false} />
      </button>
    </div>
  );
}
