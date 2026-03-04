"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Location01Icon,
  Cancel01Icon,
  Bookmark01Icon,
  Fire02Icon,
} from "@hugeicons/core-free-icons";
import { SaveToListDropdown } from "@/components/shared/save-to-list-dropdown";
import type { SaveToListDropdownHandle } from "@/components/shared/save-to-list-dropdown";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface DbPlace {
  id: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  neighborhood: string | null;
  lat: number;
  lng: number;
  primaryType: string | null;
  priceLevel: string | null;
  photoRefs: string[] | null;
  saveCount: number;
  trendingCount: number;
  topTags: Array<{ slug: string; displayName: string }>;
}

export interface SearchLocation {
  label: string;
  lat: number;
  lng: number;
}

interface SearchPanelProps {
  onBack: () => void;
  /** Controlled — the search input lives in SearchBar, not here */
  searchQuery: string;
  /** Category click needs to push a query back up to the SearchBar */
  onSearchQueryChange?: (q: string) => void;
  searchLocation: SearchLocation | null; // null = GPS mode
  onLocationChange: (loc: SearchLocation | null) => void;
  radius: number;
  onRadiusChange: (r: number) => void;
  userGpsLocation: { lat: number; lng: number } | null;
}

// ── Constants ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { emoji: "🍕", label: "Italian" },
  { emoji: "🍣", label: "Sushi" },
  { emoji: "🥩", label: "Burgers" },
  { emoji: "🌮", label: "Mexican" },
  { emoji: "🥐", label: "Brunch" },
  { emoji: "🍜", label: "Asian" },
  { emoji: "🍷", label: "Wine Bar" },
  { emoji: "☕", label: "Coffee" },
  { emoji: "🍹", label: "Cocktails" },
  { emoji: "🎉", label: "Date Night" },
  { emoji: "🌿", label: "Vegan" },
  { emoji: "🍦", label: "Dessert" },
];

const EMPTY_PLACE = {
  googlePlaceId: "",
  name: "",
  formattedAddress: "",
  lat: 0,
  lng: 0,
};

function formatPriceLevel(level: string | null): string {
  const map: Record<string, string> = {
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  };
  return level ? (map[level] || "") : "";
}

// ── Component ─────────────────────────────────────────────────────────────

export function SearchPanel({
  onBack,
  searchQuery,
  onSearchQueryChange,
  searchLocation,
  onLocationChange,
  radius,
  onRadiusChange,
  userGpsLocation,
}: SearchPanelProps) {
  // Location input state (local — only committed to parent on selection)
  const [locationQuery, setLocationQuery] = useState(searchLocation?.label ?? "");
  const [locationFocused, setLocationFocused] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<PlacePrediction[]>([]);

  // Place search results (driven by searchQuery prop)
  const [dbResults, setDbResults] = useState<DbPlace[]>([]);
  const [googleResults, setGoogleResults] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Save-to-list
  const [pendingSave, setPendingSave] = useState<typeof EMPTY_PLACE | null>(null);
  const saveRef = useRef<SaveToListDropdownHandle>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  // ── Location autocomplete ──────────────────────────────────────────────
  const searchLocations = useCallback(async (q: string) => {
    if (!q.trim()) {
      setLocationSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/places/search?q=${encodeURIComponent(q)}&types=(regions)`
      );
      const data = await res.json();
      setLocationSuggestions(data.predictions || []);
    } catch {
      setLocationSuggestions([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (locationFocused && locationQuery && locationQuery !== searchLocation?.label) {
        searchLocations(locationQuery);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [locationQuery, locationFocused, searchLocations, searchLocation?.label]);

  // ── Place search (driven by searchQuery prop) ──────────────────────────
  const activeLat = searchLocation?.lat ?? userGpsLocation?.lat;
  const activeLng = searchLocation?.lng ?? userGpsLocation?.lng;

  const searchPlaces = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setDbResults([]);
        setGoogleResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const [dbRes, googleRes] = await Promise.allSettled([
          fetch(
            `/api/places/db-search?q=${encodeURIComponent(query)}${
              activeLat != null ? `&lat=${activeLat}&lng=${activeLng}&radius=${radius}` : ""
            }`
          ).then((r) => r.json()),
          fetch(
            `/api/places/search?q=${encodeURIComponent(query)}${
              activeLat != null ? `&lat=${activeLat}&lng=${activeLng}` : ""
            }`
          ).then((r) => r.json()),
        ]);
        if (dbRes.status === "fulfilled") setDbResults(dbRes.value.places || []);
        if (googleRes.status === "fulfilled")
          setGoogleResults(googleRes.value.predictions || []);
      } catch {
        // silent
      } finally {
        setIsSearching(false);
      }
    },
    [activeLat, activeLng, radius]
  );

  useEffect(() => {
    const t = setTimeout(() => searchPlaces(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, searchPlaces]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleLocationSelect = async (prediction: PlacePrediction) => {
    setLocationQuery(prediction.structured_formatting.main_text);
    setLocationFocused(false);
    setLocationSuggestions([]);
    try {
      const res = await fetch(`/api/places/details?placeId=${prediction.place_id}`);
      const data = await res.json();
      if (data.lat && data.lng) {
        onLocationChange({
          label: prediction.structured_formatting.main_text,
          lat: data.lat,
          lng: data.lng,
        });
      }
    } catch {
      onLocationChange({ label: prediction.structured_formatting.main_text, lat: 0, lng: 0 });
    }
  };

  const handleClearLocation = () => {
    setLocationQuery("");
    onLocationChange(null);
    locationInputRef.current?.focus();
  };

  const handleDbSave = (place: DbPlace) => {
    setPendingSave({
      googlePlaceId: place.googlePlaceId,
      name: place.name,
      formattedAddress: place.formattedAddress,
      lat: place.lat,
      lng: place.lng,
    });
    setTimeout(() => saveRef.current?.triggerSave(), 50);
  };

  const handleGoogleSave = (prediction: PlacePrediction) => {
    setPendingSave({
      googlePlaceId: prediction.place_id,
      name: prediction.structured_formatting.main_text,
      formattedAddress: prediction.structured_formatting.secondary_text,
      lat: 0,
      lng: 0,
    });
    setTimeout(() => saveRef.current?.triggerSave(), 50);
  };

  const isCustomLocation = !!searchLocation;
  const hasQuery = searchQuery.trim().length > 0;
  const hasResults = dbResults.length > 0 || googleResults.length > 0;
  const dbPlaceIds = new Set(dbResults.map((p) => p.googlePlaceId));
  const filteredGoogle = googleResults.filter((r) => !dbPlaceIds.has(r.place_id));

  return (
    <div className="h-full flex flex-col bg-background" data-testid="search-panel">
      {/* ── Back + Location/Radius header ───────────────────────────────── */}
      <div className="flex items-center gap-2 px-2 py-2 border-b shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8 shrink-0"
          data-testid="button-search-back"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
        </Button>

        {/* ── Location + Radius button group ───────────────────────────── */}
        {/* Outer div is relative so the location icon can float over Input  */}
        {/* WITHOUT being a wrapper div inside ButtonGroup (causes double borders) */}
        <div className="relative flex-1">
          <HugeiconsIcon
            icon={Location01Icon}
            className={cn(
              "absolute left-2.5 top-1/2 -translate-y-1/2 z-10 h-3.5 w-3.5 pointer-events-none",
              isCustomLocation ? "text-muted-foreground" : "text-blue-500"
            )}
          />

          <ButtonGroup className="w-full">
            {/* Direct Input child — no wrapper, no extra border */}
            <Input
              ref={locationInputRef}
              value={locationFocused ? locationQuery : (searchLocation?.label ?? "")}
              onChange={(e) => setLocationQuery(e.target.value)}
              onFocus={() => {
                setLocationFocused(true);
                setLocationQuery(searchLocation?.label ?? "");
              }}
              onBlur={() => setTimeout(() => setLocationFocused(false), 150)}
              placeholder="My Location"
              className={cn(
                "pl-8",
                isCustomLocation
                  ? ""
                  : "text-blue-600 dark:text-blue-400 placeholder:text-blue-500 placeholder:font-medium font-medium"
              )}
              data-testid="search-panel-location-input"
            />

            {/* Direct Select child — ButtonGroup handles its radius via has-[select] */}
            <Select
              value={String(radius)}
              onValueChange={(v) => onRadiusChange(Number(v))}
            >
              <SelectTrigger className="w-[4.5rem]" data-testid="radius-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="0.5">0.5 mi</SelectItem>
                <SelectItem value="1">1 mi</SelectItem>
                <SelectItem value="2">2 mi</SelectItem>
                <SelectItem value="5">5 mi</SelectItem>
                <SelectItem value="10">10 mi</SelectItem>
              </SelectContent>
            </Select>
          </ButtonGroup>

          {/* Clear location — outside ButtonGroup to avoid border issues */}
          {isCustomLocation && (
            <button
              onClick={handleClearLocation}
              className="absolute right-[calc(4.5rem+1px)] top-1/2 -translate-y-1/2 z-10 text-muted-foreground hover:text-foreground px-1.5"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Location suggestions dropdown ───────────────────────────────── */}
      {locationFocused && locationSuggestions.length > 0 && (
        <div className="mx-3 mt-0.5 border rounded-lg shadow-lg bg-background overflow-hidden z-10 shrink-0">
          {locationSuggestions.slice(0, 5).map((s) => (
            <button
              key={s.place_id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleLocationSelect(s)}
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-accent text-left text-sm transition-colors"
            >
              <HugeiconsIcon
                icon={Location01Icon}
                className="h-3.5 w-3.5 text-muted-foreground shrink-0"
              />
              <div className="min-w-0">
                <p className="font-medium truncate">{s.structured_formatting.main_text}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {s.structured_formatting.secondary_text}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Scrollable content ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Empty state: category grid */}
        {!hasQuery && (
          <div className="px-3 pt-3 pb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Browse by category
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => onSearchQueryChange?.(cat.label)}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-accent transition-colors"
                  data-testid={`category-${cat.label.toLowerCase()}`}
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="text-[11px] font-medium leading-tight text-center">
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {hasQuery && isSearching && (
          <div className="px-3 pt-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5 pt-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {hasQuery && !isSearching && (
          <>
            {dbResults.length > 0 && (
              <div>
                <p className="px-3 pt-2 pb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  In Townsquare
                </p>
                {dbResults.map((place) => (
                  <div
                    key={place.id}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-accent group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted shrink-0 overflow-hidden">
                      {place.photoRefs?.[0] ? (
                        <img
                          src={`/api/places/photo?photoRef=${place.photoRefs[0]}&maxWidth=80`}
                          alt={place.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <HugeiconsIcon
                            icon={Location01Icon}
                            className="h-4 w-4 text-muted-foreground"
                          />
                        </div>
                      )}
                    </div>
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={() => handleDbSave(place)}
                    >
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm truncate">{place.name}</p>
                        {place.trendingCount > 0 && (
                          <span className="flex items-center gap-0.5 text-orange-500 text-[11px] font-semibold shrink-0">
                            <HugeiconsIcon icon={Fire02Icon} className="h-3 w-3" />
                            {place.trendingCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="truncate">
                          {place.neighborhood || place.formattedAddress.split(",")[0]}
                        </span>
                        {place.priceLevel && (
                          <>
                            <span>·</span>
                            <span className="shrink-0">{formatPriceLevel(place.priceLevel)}</span>
                          </>
                        )}
                        {place.saveCount > 0 && (
                          <>
                            <span>·</span>
                            <span className="shrink-0">{place.saveCount} saves</span>
                          </>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => handleDbSave(place)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <HugeiconsIcon icon={Bookmark01Icon} className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {filteredGoogle.length > 0 && (
              <div>
                <p className="px-3 pt-2 pb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {dbResults.length > 0 ? "Add new place" : "From Google"}
                </p>
                {filteredGoogle.map((result) => (
                  <button
                    key={result.place_id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-accent w-full text-left transition-colors"
                    onClick={() => handleGoogleSave(result)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {result.structured_formatting.main_text}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {result.structured_formatting.secondary_text}
                      </p>
                    </div>
                    <HugeiconsIcon
                      icon={Bookmark01Icon}
                      className="h-4 w-4 text-muted-foreground shrink-0"
                    />
                  </button>
                ))}
              </div>
            )}

            {!hasResults && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No places found for &ldquo;{searchQuery}&rdquo;
              </p>
            )}
          </>
        )}
      </div>

      {/* Hidden save modal */}
      <div className="hidden">
        <SaveToListDropdown
          ref={saveRef}
          place={pendingSave || EMPTY_PLACE}
          onSaveSuccess={() => setPendingSave(null)}
        />
      </div>
    </div>
  );
}
