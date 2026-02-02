"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ChevronDown, Check, SlidersHorizontal, X, Car, TrainFront } from "lucide-react";
import { apiRequest } from "@/lib/query-client";
import { PlacesList } from "@/components/shared/places-list";
import { PlaceDetailPanel } from "@/components/place-detail-panel";
import { MapSettingsPopover } from "@/components/map-settings-popover";
import { useMapSettings } from "@/hooks/use-map-settings";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { MAP_STYLES, LABEL_DENSITY_OPTIONS, type MapStyleKey, type LabelDensity } from "@/lib/map-styles";
import type { SidebarInjectedProps } from "@/components/map/map-layout";

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
        <defs><linearGradient id="sat-base-ds" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#1e3a2a" /><stop offset="50%" stopColor="#2a4a38" /><stop offset="100%" stopColor="#152a20" /></linearGradient></defs>
        <rect fill="url(#sat-base-ds)" width="80" height="60" />
        <path d="M0 45 Q30 38, 50 48 Q65 55, 80 50 L80 60 L0 60 Z" fill="#1a3040" opacity="0.7" />
      </svg>
    ),
    terrain: (
      <svg viewBox="0 0 80 60" className="w-full h-full">
        <defs><linearGradient id="terrain-base-ds" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stopColor="#d8e8c8" /><stop offset="50%" stopColor="#e0d8c0" /><stop offset="100%" stopColor="#f0e8dc" /></linearGradient></defs>
        <rect fill="url(#terrain-base-ds)" width="80" height="60" />
        <path d="M50 60 L65 20 L80 60 Z" fill="#d0c8b8" opacity="0.6" />
      </svg>
    ),
    silver: (
      <svg viewBox="0 0 80 60" className="w-full h-full">
        <rect fill="#f5f5f5" width="80" height="60" />
        <path d="M0 42 Q25 36, 50 44 Q68 52, 80 48 L80 60 L0 60 Z" fill="#c9c9c9" opacity="0.8" />
        <path d="M0 18 L80 18" stroke="#ffffff" strokeWidth="3" />
      </svg>
    ),
    retro: (
      <svg viewBox="0 0 80 60" className="w-full h-full">
        <rect fill="#ebe3cd" width="80" height="60" />
        <path d="M0 42 Q25 36, 50 44 Q68 52, 80 48 L80 60 L0 60 Z" fill="#b9d3c2" opacity="0.8" />
        <path d="M0 18 L80 18" stroke="#f5f1e6" strokeWidth="3" />
      </svg>
    ),
    dark: (
      <svg viewBox="0 0 80 60" className="w-full h-full">
        <rect fill="#212121" width="80" height="60" />
        <path d="M0 18 L80 18" stroke="#2c2c2c" strokeWidth="3" />
      </svg>
    ),
    night: (
      <svg viewBox="0 0 80 60" className="w-full h-full">
        <rect fill="#242f3e" width="80" height="60" />
        <path d="M0 18 L80 18" stroke="#38414e" strokeWidth="3" />
      </svg>
    ),
    aubergine: (
      <svg viewBox="0 0 80 60" className="w-full h-full">
        <rect fill="#1d2c4d" width="80" height="60" />
        <path d="M0 18 L80 18" stroke="#304a7d" strokeWidth="3" />
      </svg>
    ),
  };
  return (
    <div className={cn("w-full aspect-[4/3] rounded-md overflow-hidden border-2 transition-all", isSelected ? "border-primary ring-2 ring-primary/20" : "border-transparent")}>
      {thumbnails[styleId]}
    </div>
  );
}

interface Place {
  id: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  primaryType: string | null;
  types: string[] | null;
  priceLevel: string | null;
  photoRefs: string[] | null;
}

interface SavedPlace {
  id: string;
  userId: string;
  placeId: string;
  status: "WANT" | "BEEN";
  visitedAt: string | null;
  createdAt: string;
  place: Place;
}

interface ListData {
  id: string;
  name: string;
  _count: { listPlaces: number };
}

interface Review {
  id: string;
  rating: number;
  note: string | null;
}

interface DiscoverSidebarProps extends Partial<SidebarInjectedProps> {
  places: SavedPlace[];
  isLoading: boolean;
  statusFilter: "all" | "want" | "been";
  listFilter: string;
  onStatusFilterChange: (value: "all" | "want" | "been") => void;
  onListFilterChange: (listId: string) => void;
  viewingPlaceId: string | null;
  onViewPlace: (savedPlaceId: string | null) => void;
  reviewsByPlaceId?: Map<string, Review>;
  onToggleStatus?: (savedPlace: SavedPlace) => void;
  onDeletePlace?: (savedPlaceId: string) => void;
  onAddToList?: (placeId: string, placeName: string) => void;
  onAddReview?: (placeId: string, placeName: string) => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

const statusOptions = [
  { value: "all", label: "All" },
  { value: "want", label: "Want" },
  { value: "been", label: "Been" },
] as const;

export function DiscoverSidebar({
  places,
  isLoading,
  selectedPlaceId,
  onPlaceSelect,
  placeRowRefs,
  statusFilter,
  listFilter,
  onStatusFilterChange,
  onListFilterChange,
  viewingPlaceId,
  onViewPlace,
  reviewsByPlaceId,
  onToggleStatus,
  onDeletePlace,
  onAddToList,
  onAddReview,
  isUpdating,
  isDeleting,
}: DiscoverSidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const mapSettings = useMapSettings();
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  
  const { data: listsData } = useQuery<{ lists: ListData[] }>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("/api/lists"),
  });

  const lists = listsData?.lists || [];

  const selectedStatusLabel = statusOptions.find((o) => o.value === statusFilter)?.label || "All";
  const selectedListLabel = listFilter === "all" 
    ? "All Lists" 
    : lists.find((l) => l.id === listFilter)?.name || "All Lists";

  const currentRadiusIndex = RADIUS_STEPS.findIndex((r) => r >= mapSettings.radius) || 0;
  const displayRadius = RADIUS_STEPS[currentRadiusIndex] || 1;
  const sliderValue = (currentRadiusIndex / (RADIUS_STEPS.length - 1)) * 100;
  
  const handleSliderChange = (value: number[]) => {
    const index = Math.round((value[0] / 100) * (RADIUS_STEPS.length - 1));
    mapSettings.setRadius(RADIUS_STEPS[index]);
  };

  const viewingPlace = viewingPlaceId ? places.find((p) => p.id === viewingPlaceId) : null;
  const viewingReview = viewingPlace ? reviewsByPlaceId?.get(viewingPlace.placeId) : null;

  const handlePlaceClick = (savedPlaceId: string) => {
    onViewPlace(savedPlaceId);
    onPlaceSelect?.(savedPlaceId);
  };

  if (viewingPlace) {
    return (
      <PlaceDetailPanel
        savedPlace={viewingPlace}
        myReview={viewingReview}
        onBack={() => onViewPlace(null)}
        onToggleStatus={() => onToggleStatus?.(viewingPlace)}
        onDelete={() => onDeletePlace?.(viewingPlace.id)}
        onAddToList={() => onAddToList?.(viewingPlace.placeId, viewingPlace.place.name)}
        onAddReview={() => onAddReview?.(viewingPlace.placeId, viewingPlace.place.name)}
        isUpdating={isUpdating}
        isDeleting={isDeleting}
      />
    );
  }

  if (isMobile && settingsOpen) {
    return (
      <div className="h-full flex flex-col bg-background" data-testid="discover-sidebar">
        <div className="flex items-center gap-2 p-3 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(false)}
            data-testid="button-close-settings"
          >
            <X className="h-4 w-4" />
          </Button>
          <h1 className="font-semibold text-sm flex-1">Map Settings</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Map Style</Label>
            <div className="grid grid-cols-4 gap-2">
              {MAP_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => mapSettings.setStyle(style.id)}
                  className="flex flex-col items-center gap-1 group"
                  data-testid={`button-style-${style.id}`}
                >
                  <MapStyleThumbnail styleId={style.id} isSelected={mapSettings.style === style.id} />
                  <span className={cn("text-[10px] transition-colors", mapSettings.style === style.id ? "text-primary font-medium" : "text-muted-foreground")}>{style.name}</span>
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
                  onClick={() => mapSettings.setLabelDensity(option.id)}
                  className={cn("px-2 py-1.5 text-xs rounded-md transition-colors", mapSettings.labelDensity === option.id ? "bg-primary text-primary-foreground" : "bg-muted hover-elevate")}
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
            <Slider value={[sliderValue]} max={100} step={1} onValueChange={handleSliderChange} data-testid="slider-map-radius" />
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
              <Switch checked={mapSettings.showTraffic} onCheckedChange={mapSettings.setShowTraffic} data-testid="switch-traffic" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrainFront className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Transit</span>
              </div>
              <Switch checked={mapSettings.showTransit} onCheckedChange={mapSettings.setShowTransit} data-testid="switch-transit" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background" data-testid="discover-sidebar">
      <div className="flex items-center gap-2 p-3 border-b">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <h1 className="font-semibold text-sm flex-1">Places</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSettingsOpen(!settingsOpen)}
          data-testid="button-map-settings-trigger"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
        {!isMobile && settingsOpen && (
          <div className="absolute top-12 right-2 z-50">
            <MapSettingsPopover
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
              isOpen={settingsOpen}
              onOpenChange={setSettingsOpen}
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 p-3 border-b">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" data-testid="select-status-filter">
              {selectedStatusLabel}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {statusOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => onStatusFilterChange(option.value)}
                data-active={statusFilter === option.value}
              >
                {option.label}
                <Check className={`ml-auto h-4 w-4 ${statusFilter === option.value ? "opacity-100" : "opacity-0"}`} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" data-testid="select-list-filter">
              {selectedListLabel}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onSelect={() => onListFilterChange("all")}
              data-active={listFilter === "all"}
            >
              All Lists
              <Check className={`ml-auto h-4 w-4 ${listFilter === "all" ? "opacity-100" : "opacity-0"}`} />
            </DropdownMenuItem>
            {lists.map((list) => (
              <DropdownMenuItem
                key={list.id}
                onSelect={() => onListFilterChange(list.id)}
                data-active={listFilter === list.id}
              >
                {list.name}
                <Check className={`ml-auto h-4 w-4 ${listFilter === list.id ? "opacity-100" : "opacity-0"}`} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto">
        <PlacesList
          places={places}
          isLoading={isLoading}
          selectedPlaceId={selectedPlaceId || null}
          onPlaceSelect={handlePlaceClick}
          placeRowRefs={placeRowRefs}
          showStatus={true}
        />
      </div>
    </div>
  );
}
