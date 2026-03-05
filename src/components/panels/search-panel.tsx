"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Location01Icon,
  Bookmark01Icon,
  Fire02Icon,
  PinLocation03Icon,
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

interface TrendingResult {
  id: string;
  saveCount: number;
  trendingCount: number;
  place: {
    googlePlaceId: string;
    name: string;
    formattedAddress: string;
    neighborhood: string | null;
    priceLevel: string | null;
    photoRefs: string[] | null;
    lat: number;
    lng: number;
    topTags: Array<{ slug: string; displayName: string }>;
  };
}

export interface SearchLocation {
  label: string;
  lat: number;
  lng: number;
}

interface SearchPanelProps {
  onBack: () => void;
  searchQuery: string;
  onSearchQueryChange?: (q: string) => void;
  searchLocation: SearchLocation | null;
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

const DEFAULT_CITIES = [
  { label: "New York City", lat: 40.7128, lng: -74.006 },
  { label: "Los Angeles", lat: 34.0522, lng: -118.2437 },
  { label: "Chicago", lat: 41.8781, lng: -87.6298 },
  { label: "Miami", lat: 25.7617, lng: -80.1918 },
  { label: "San Francisco", lat: 37.7749, lng: -122.4194 },
];

const EMPTY_PLACE = { googlePlaceId: "", name: "", formattedAddress: "", lat: 0, lng: 0 };

function formatPriceLevel(level: string | null): string {
  const map: Record<string, string> = {
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  };
  return level ? (map[level] || "") : "";
}

// Returns true if any of the place's tags match the query
function tagsMatchQuery(tags: Array<{ slug: string; displayName: string }>, q: string): boolean {
  const ql = q.toLowerCase().trim();
  if (!ql) return false;
  return tags.some((t) => {
    const display = t.displayName.toLowerCase();
    const slug = t.slug.toLowerCase();
    if (display.includes(ql) || ql.includes(display)) return true;
    if (slug.includes(ql) || ql.includes(slug)) return true;
    // Stem: remove trailing 's' (e.g. "burgers" → "burger" matches "smashburger")
    const stem = display.replace(/s$/, "");
    if (stem.length >= 4 && ql.includes(stem)) return true;
    return false;
  });
}

// ── Shared place row ───────────────────────────────────────────────────────

function PlaceRow({
  name,
  neighborhood,
  formattedAddress,
  priceLevel,
  saveCount,
  trendingCount,
  photoRefs,
  onSave,
  badge,
}: {
  name: string;
  neighborhood: string | null;
  formattedAddress: string;
  priceLevel: string | null;
  saveCount: number;
  trendingCount: number;
  photoRefs: string[] | null;
  onSave: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 hover:bg-accent group cursor-pointer">
      <div className="w-10 h-10 rounded-lg bg-muted shrink-0 overflow-hidden">
        {photoRefs?.[0] ? (
          <img
            src={`/api/places/photo?photoRef=${photoRefs[0]}&maxWidth=80`}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <HugeiconsIcon icon={Location01Icon} className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <button className="flex-1 min-w-0 text-left" onClick={onSave}>
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-sm truncate">{name}</p>
          {trendingCount > 0 && (
            <span className="flex items-center gap-0.5 text-orange-500 text-[11px] font-semibold shrink-0">
              <HugeiconsIcon icon={Fire02Icon} className="h-3 w-3" />
              {trendingCount}
            </span>
          )}
          {badge}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{neighborhood || formattedAddress.split(",")[0]}</span>
          {priceLevel && (
            <>
              <span>·</span>
              <span className="shrink-0">{formatPriceLevel(priceLevel)}</span>
            </>
          )}
          {saveCount > 0 && (
            <>
              <span>·</span>
              <span className="shrink-0">{saveCount} saves</span>
            </>
          )}
        </div>
      </button>
      <button
        onClick={onSave}
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      >
        <HugeiconsIcon icon={Bookmark01Icon} className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-3 pb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
      {children}
    </p>
  );
}

function ResultSkeleton() {
  return (
    <div className="px-3 pt-3 space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5 pt-1">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
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
  // Location combobox state
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationInput, setLocationInput] = useState(searchLocation?.label ?? "");
  const [locationSuggestions, setLocationSuggestions] = useState<PlacePrediction[]>([]);

  // Sync input when location changes externally (e.g., cleared from SearchBar badge)
  useEffect(() => {
    setLocationInput(searchLocation?.label ?? "");
  }, [searchLocation]);

  // Place search results
  const [dbResults, setDbResults] = useState<DbPlace[]>([]);
  const [googleResults, setGoogleResults] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Trending (shown in empty state)
  const [trendingResults, setTrendingResults] = useState<TrendingResult[]>([]);
  const [isTrendingLoading, setIsTrendingLoading] = useState(false);

  // Save-to-list
  const [pendingSave, setPendingSave] = useState<typeof EMPTY_PLACE | null>(null);
  const saveRef = useRef<SaveToListDropdownHandle>(null);

  const activeLat = searchLocation?.lat ?? userGpsLocation?.lat;
  const activeLng = searchLocation?.lng ?? userGpsLocation?.lng;
  const hasQuery = searchQuery.trim().length > 0;

  // ── Location autocomplete ─────────────────────────────────────────────

  const searchLocations = useCallback(async (q: string) => {
    if (!q.trim()) { setLocationSuggestions([]); return; }
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}&types=(regions)`);
      const data = await res.json();
      setLocationSuggestions(data.predictions || []);
    } catch {
      setLocationSuggestions([]);
    }
  }, []);

  useEffect(() => {
    if (!locationOpen) return;
    const t = setTimeout(() => searchLocations(locationInput), 300);
    return () => clearTimeout(t);
  }, [locationInput, locationOpen, searchLocations]);

  // ── Trending fetch (empty state only) ────────────────────────────────

  useEffect(() => {
    if (hasQuery || activeLat == null || activeLng == null) {
      setTrendingResults([]);
      return;
    }
    let cancelled = false;
    setIsTrendingLoading(true);
    fetch(`/api/collections?collection=trending&lat=${activeLat}&lng=${activeLng}&limit=5`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setTrendingResults(data.places?.slice(0, 5) ?? []); })
      .catch(() => { if (!cancelled) setTrendingResults([]); })
      .finally(() => { if (!cancelled) setIsTrendingLoading(false); });
    return () => { cancelled = true; };
  }, [hasQuery, activeLat, activeLng]);

  // ── Place search ──────────────────────────────────────────────────────

  const searchPlaces = useCallback(async (query: string) => {
    if (!query.trim()) { setDbResults([]); setGoogleResults([]); return; }
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
      if (googleRes.status === "fulfilled") setGoogleResults(googleRes.value.predictions || []);
    } catch {
      // silent
    } finally {
      setIsSearching(false);
    }
  }, [activeLat, activeLng, radius]);

  useEffect(() => {
    const t = setTimeout(() => searchPlaces(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, searchPlaces]);

  // ── Location handlers ─────────────────────────────────────────────────

  const handleSelectCurrentLocation = () => {
    setLocationOpen(false);
    setLocationInput("");
    onLocationChange(null);
    onBack();
  };

  const handleSelectDefaultCity = (city: typeof DEFAULT_CITIES[0]) => {
    setLocationOpen(false);
    setLocationInput(city.label);
    onLocationChange(city);
    onBack();
  };

  const handleSelectSuggestion = async (prediction: PlacePrediction) => {
    const label = prediction.structured_formatting.main_text;
    setLocationOpen(false);
    setLocationInput(label);
    onBack();
    try {
      const res = await fetch(`/api/places/details?placeId=${prediction.place_id}`);
      const data = await res.json();
      onLocationChange({ label, lat: data.lat ?? 0, lng: data.lng ?? 0 });
    } catch {
      onLocationChange({ label, lat: 0, lng: 0 });
    }
  };

  // ── Save handlers ─────────────────────────────────────────────────────

  const handleDbSave = (place: DbPlace) => {
    setPendingSave({ googlePlaceId: place.googlePlaceId, name: place.name, formattedAddress: place.formattedAddress, lat: place.lat, lng: place.lng });
    setTimeout(() => saveRef.current?.triggerSave(), 50);
  };

  const handleTrendingSave = (tr: TrendingResult) => {
    setPendingSave({ googlePlaceId: tr.place.googlePlaceId, name: tr.place.name, formattedAddress: tr.place.formattedAddress, lat: tr.place.lat, lng: tr.place.lng });
    setTimeout(() => saveRef.current?.triggerSave(), 50);
  };

  const handleGoogleSave = (prediction: PlacePrediction) => {
    setPendingSave({ googlePlaceId: prediction.place_id, name: prediction.structured_formatting.main_text, formattedAddress: prediction.structured_formatting.secondary_text, lat: 0, lng: 0 });
    setTimeout(() => saveRef.current?.triggerSave(), 50);
  };

  // ── Derived ───────────────────────────────────────────────────────────

  // Categories that fuzzy-match the current query
  const matchedCategories = useMemo(() => {
    if (!hasQuery) return [];
    const q = searchQuery.toLowerCase().trim();
    return CATEGORIES.filter((cat) => {
      const label = cat.label.toLowerCase();
      if (label.includes(q) || q.includes(label)) return true;
      // Stem match
      const stem = label.replace(/s$/, "");
      if (stem.length >= 4 && q.includes(stem)) return true;
      return false;
    });
  }, [searchQuery, hasQuery]);

  // Split db results: tag-matched first, then name-only
  const tagMatchedResults = useMemo(
    () => dbResults.filter((p) => tagsMatchQuery(p.topTags ?? [], searchQuery)),
    [dbResults, searchQuery]
  );
  const tagMatchIds = useMemo(() => new Set(tagMatchedResults.map((p) => p.id)), [tagMatchedResults]);
  const nameMatchResults = useMemo(
    () => dbResults.filter((p) => !tagMatchIds.has(p.id)),
    [dbResults, tagMatchIds]
  );

  const dbPlaceIds = new Set(dbResults.map((p) => p.googlePlaceId));
  const filteredGoogle = googleResults.filter((r) => !dbPlaceIds.has(r.place_id));
  const hasTwnsqResults = dbResults.length > 0;

  return (
    <div className="h-full flex flex-col bg-background" data-testid="search-panel">

      {/* ── Location Combobox + Radius ────────────────────────────────── */}
      <div className="px-3 py-2 border-b shrink-0">
        <Popover
          open={locationOpen}
          onOpenChange={(open) => { if (!open) setLocationOpen(false); }}
        >
          <PopoverAnchor asChild>
            <ButtonGroup className="w-full">
              <Input
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onFocus={() => setLocationOpen(true)}
                placeholder="Current location"
                className="h-9 flex-1 min-w-0"
                data-testid="location-input"
              />
              <Select value={String(radius)} onValueChange={(v) => onRadiusChange(Number(v))}>
                <SelectTrigger className="w-24" data-testid="radius-select">
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
          </PopoverAnchor>

          <PopoverContent
            className="p-0 w-72"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={() => setLocationOpen(false)}
          >
            <Command shouldFilter={false}>
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="current-location" onSelect={handleSelectCurrentLocation}>
                    <HugeiconsIcon icon={PinLocation03Icon} className="text-blue-500" />
                    Current Location
                  </CommandItem>
                  {locationInput.trim() ? (
                    locationSuggestions.slice(0, 5).map((s) => (
                      <CommandItem key={s.place_id} value={s.place_id} onSelect={() => handleSelectSuggestion(s)}>
                        <HugeiconsIcon icon={Location01Icon} />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{s.structured_formatting.main_text}</span>
                          <span className="text-xs text-muted-foreground truncate">{s.structured_formatting.secondary_text}</span>
                        </div>
                      </CommandItem>
                    ))
                  ) : (
                    DEFAULT_CITIES.map((city) => (
                      <CommandItem key={city.label} value={city.label} onSelect={() => handleSelectDefaultCity(city)}>
                        <HugeiconsIcon icon={Location01Icon} />
                        {city.label}
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* ── Scrollable content ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── EMPTY STATE ─────────────────────────────────────────────── */}
        {!hasQuery && (
          <>
            {/* Trending nearby */}
            {(isTrendingLoading || trendingResults.length > 0) && (
              <div>
                <SectionHeader>
                  <span className="inline-flex items-center gap-1">
                    <HugeiconsIcon icon={Fire02Icon} className="h-3 w-3 text-orange-500 inline" />
                    Trending nearby
                  </span>
                </SectionHeader>
                {isTrendingLoading ? (
                  <ResultSkeleton />
                ) : (
                  trendingResults.map((tr) => (
                    <PlaceRow
                      key={tr.id}
                      name={tr.place.name}
                      neighborhood={tr.place.neighborhood}
                      formattedAddress={tr.place.formattedAddress}
                      priceLevel={tr.place.priceLevel}
                      saveCount={tr.saveCount}
                      trendingCount={tr.trendingCount}
                      photoRefs={tr.place.photoRefs}
                      onSave={() => handleTrendingSave(tr)}
                    />
                  ))
                )}
              </div>
            )}

            {/* Category grid */}
            <div className={cn("px-3 pb-3", (isTrendingLoading || trendingResults.length > 0) ? "pt-3" : "pt-3")}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
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
                    <span className="text-[11px] font-medium leading-tight text-center">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── SEARCH STATE ────────────────────────────────────────────── */}
        {hasQuery && isSearching && <ResultSkeleton />}

        {hasQuery && !isSearching && (
          <>
            {/* 1. Category suggestions */}
            {matchedCategories.length > 0 && (
              <div className="px-3 pt-3 pb-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Categories
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {matchedCategories.map((cat) => (
                    <button
                      key={cat.label}
                      onClick={() => onSearchQueryChange?.(cat.label)}
                      className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-sm font-medium hover:bg-accent transition-colors"
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Tagged in Townsquare */}
            {tagMatchedResults.length > 0 && (
              <div>
                <SectionHeader>Tagged in Townsquare</SectionHeader>
                {tagMatchedResults.map((place) => (
                  <PlaceRow
                    key={place.id}
                    name={place.name}
                    neighborhood={place.neighborhood}
                    formattedAddress={place.formattedAddress}
                    priceLevel={place.priceLevel}
                    saveCount={place.saveCount}
                    trendingCount={place.trendingCount}
                    photoRefs={place.photoRefs}
                    onSave={() => handleDbSave(place)}
                  />
                ))}
              </div>
            )}

            {/* 3. Name / address matches in Townsquare */}
            {nameMatchResults.length > 0 && (
              <div>
                <SectionHeader>
                  {tagMatchedResults.length > 0 ? "More in Townsquare" : "In Townsquare"}
                </SectionHeader>
                {nameMatchResults.map((place) => (
                  <PlaceRow
                    key={place.id}
                    name={place.name}
                    neighborhood={place.neighborhood}
                    formattedAddress={place.formattedAddress}
                    priceLevel={place.priceLevel}
                    saveCount={place.saveCount}
                    trendingCount={place.trendingCount}
                    photoRefs={place.photoRefs}
                    onSave={() => handleDbSave(place)}
                  />
                ))}
              </div>
            )}

            {/* 4. New places from Google — only when nothing in Townsquare */}
            {!hasTwnsqResults && filteredGoogle.length > 0 && (
              <div>
                <SectionHeader>New places</SectionHeader>
                {filteredGoogle.map((result) => (
                  <button
                    key={result.place_id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-accent w-full text-left transition-colors"
                    onClick={() => handleGoogleSave(result)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{result.structured_formatting.main_text}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.structured_formatting.secondary_text}</p>
                    </div>
                    <HugeiconsIcon icon={Bookmark01Icon} className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {/* No results at all */}
            {!hasTwnsqResults && filteredGoogle.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No places found for &ldquo;{searchQuery}&rdquo;
              </p>
            )}
          </>
        )}
      </div>

      <div className="hidden">
        <SaveToListDropdown ref={saveRef} place={pendingSave || EMPTY_PLACE} onSaveSuccess={() => setPendingSave(null)} />
      </div>
    </div>
  );
}
