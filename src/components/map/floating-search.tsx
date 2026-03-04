"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  Bookmark01Icon,
  Cancel01Icon,
  Location01Icon,
  Fire02Icon,
} from "@hugeicons/core-free-icons";
import { SaveToListDropdown } from "@/components/shared/save-to-list-dropdown";
import type { SaveToListDropdownHandle } from "@/components/shared/save-to-list-dropdown";
import { useUserLocation } from "@/hooks/use-user-location";
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

const EMPTY_PLACE = {
  googlePlaceId: "",
  name: "",
  formattedAddress: "",
  lat: 0,
  lng: 0,
};

// ── Category grid ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { emoji: "🍕", label: "Italian", query: "Italian" },
  { emoji: "🍣", label: "Sushi", query: "Sushi" },
  { emoji: "🥩", label: "Burgers", query: "Burgers" },
  { emoji: "🌮", label: "Mexican", query: "Mexican" },
  { emoji: "🥐", label: "Brunch", query: "Brunch" },
  { emoji: "🍜", label: "Asian", query: "Asian" },
  { emoji: "🍷", label: "Wine Bar", query: "Wine Bar" },
  { emoji: "☕", label: "Coffee", query: "Coffee" },
  { emoji: "🍹", label: "Cocktails", query: "Cocktails" },
  { emoji: "🎉", label: "Date Night", query: "Date Night" },
  { emoji: "🌿", label: "Vegan", query: "Vegan" },
  { emoji: "🍦", label: "Dessert", query: "Dessert" },
];

const RADIUS_OPTIONS = [0.5, 1, 2, 5, 10];

function formatPriceLevel(level: string | null): string {
  if (!level) return "";
  const map: Record<string, string> = {
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  };
  return map[level] || "";
}

// ── Component ─────────────────────────────────────────────────────────────

export function FloatingSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [googleResults, setGoogleResults] = useState<PlacePrediction[]>([]);
  const [dbResults, setDbResults] = useState<DbPlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [activePrediction, setActivePrediction] = useState<PlacePrediction | null>(null);
  const saveRef = useRef<SaveToListDropdownHandle>(null);
  const pendingSaveRef = useRef<typeof EMPTY_PLACE | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Location + radius from hooks
  const { location: userLocation } = useUserLocation();
  const [radius, setRadius] = useState(() => {
    try {
      return parseFloat(localStorage.getItem("twnsq-map-radius") || "1");
    } catch {
      return 1;
    }
  });

  useEffect(() => {
    const handler = (e: Event) => setRadius((e as CustomEvent).detail);
    window.addEventListener("map-radius-change", handler);
    return () => window.removeEventListener("map-radius-change", handler);
  }, []);

  const handleRadiusChange = (r: number) => {
    setRadius(r);
    try {
      localStorage.setItem("twnsq-map-radius", String(r));
    } catch {}
    window.dispatchEvent(new CustomEvent("map-radius-change", { detail: r }));
  };

  const currentPlace = activePrediction
    ? {
        googlePlaceId: activePrediction.place_id,
        name: activePrediction.structured_formatting.main_text,
        formattedAddress: activePrediction.structured_formatting.secondary_text,
        lat: 0,
        lng: 0,
      }
    : EMPTY_PLACE;

  const activePlace = pendingSaveRef.current || currentPlace;

  // Search both DB and Google
  const search = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setGoogleResults([]);
        setDbResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const [googleRes, dbRes] = await Promise.allSettled([
          fetch(
            `/api/places/search?q=${encodeURIComponent(query)}${
              userLocation ? `&lat=${userLocation.lat}&lng=${userLocation.lng}` : ""
            }`
          ).then((r) => r.json()),
          fetch(
            `/api/places/db-search?q=${encodeURIComponent(query)}${
              userLocation
                ? `&lat=${userLocation.lat}&lng=${userLocation.lng}&radius=${radius}`
                : ""
            }`
          ).then((r) => r.json()),
        ]);

        if (googleRes.status === "fulfilled") {
          setGoogleResults(googleRes.value.predictions || []);
        }
        if (dbRes.status === "fulfilled") {
          setDbResults(dbRes.value.places || []);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    },
    [userLocation, radius]
  );

  useEffect(() => {
    const debounce = setTimeout(() => search(searchQuery), 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, search]);

  const handleClear = () => {
    setSearchQuery("");
    setGoogleResults([]);
    setDbResults([]);
    setActivePrediction(null);
  };

  const handleGoogleSave = (prediction: PlacePrediction) => {
    const placeToSave = {
      googlePlaceId: prediction.place_id,
      name: prediction.structured_formatting.main_text,
      formattedAddress: prediction.structured_formatting.secondary_text,
      lat: 0,
      lng: 0,
    };
    pendingSaveRef.current = placeToSave;
    handleClear();
    setTimeout(() => {
      saveRef.current?.triggerSave();
    }, 50);
  };

  const handleDbSave = (place: DbPlace) => {
    const placeToSave = {
      googlePlaceId: place.googlePlaceId,
      name: place.name,
      formattedAddress: place.formattedAddress,
      lat: place.lat,
      lng: place.lng,
    };
    pendingSaveRef.current = placeToSave;
    handleClear();
    setTimeout(() => {
      saveRef.current?.triggerSave();
    }, 50);
  };

  const handleCategoryClick = (category: (typeof CATEGORIES)[0]) => {
    setSearchQuery(category.query);
    inputRef.current?.focus();
  };

  const showDropdown = isFocused;
  const hasQuery = searchQuery.trim().length > 0;
  const hasResults = dbResults.length > 0 || googleResults.length > 0;

  // Filter out Google results that are already in DB to avoid duplicates
  const dbPlaceIds = new Set(dbResults.map((p) => p.googlePlaceId));
  const filteredGoogle = googleResults.filter((r) => !dbPlaceIds.has(r.place_id));

  return (
    <div className="w-full">
      {/* ── Search input ──────────────────────────────────────────── */}
      <div className="relative">
        <HugeiconsIcon
          icon={Search01Icon}
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          placeholder="Find dinner, brunch, date spots…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          className="pl-10 pr-8 bg-background dark:bg-background shadow-lg border"
          data-testid="input-search-place"
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            data-testid="button-clear-search"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Location context row (shown when no query) ────────────── */}
      {!hasQuery && (
        <div className="flex items-center gap-2 mt-1.5 px-1">
          <HugeiconsIcon
            icon={Location01Icon}
            className={cn(
              "h-3.5 w-3.5 flex-shrink-0",
              userLocation ? "text-blue-500" : "text-muted-foreground"
            )}
          />
          <span className="text-xs text-muted-foreground flex-1 truncate">
            {userLocation ? "Current Location" : "Getting location…"}
          </span>
          {userLocation && (
            <div className="flex gap-0.5">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => handleRadiusChange(r)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors",
                    radius === r
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                  data-testid={`radius-${r}`}
                >
                  {r}mi
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Dropdown ──────────────────────────────────────────────── */}
      {showDropdown && (
        <div className="mt-2 bg-background border rounded-lg shadow-xl max-h-[60vh] overflow-y-auto">
          {/* ── Empty state: category grid ─────────────────────────── */}
          {!hasQuery && (
            <div className="p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Browse by category
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.label}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleCategoryClick(cat)}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-accent transition-colors text-center"
                    data-testid={`category-${cat.label.toLowerCase()}`}
                  >
                    <span className="text-xl">{cat.emoji}</span>
                    <span className="text-[11px] font-medium leading-tight">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Searching spinner ──────────────────────────────────── */}
          {hasQuery && isSearching && (
            <div className="space-y-2 p-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {/* ── Results ───────────────────────────────────────────── */}
          {hasQuery && !isSearching && (
            <>
              {/* DB places — already in Townsquare */}
              {dbResults.length > 0 && (
                <div>
                  <p className="px-3 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    In Townsquare
                  </p>
                  {dbResults.map((place) => (
                    <div
                      key={place.id}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-accent transition-colors cursor-pointer group"
                    >
                      {/* Thumbnail */}
                      <div className="w-10 h-10 rounded bg-muted flex-shrink-0 overflow-hidden">
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

                      {/* Info */}
                      <button
                        className="flex-1 min-w-0 text-left"
                        onClick={() => handleDbSave(place)}
                      >
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm truncate">{place.name}</p>
                          {place.trendingCount > 0 && (
                            <span className="flex items-center gap-0.5 text-orange-500 text-[11px] font-semibold flex-shrink-0">
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
                              <span className="flex-shrink-0">
                                {formatPriceLevel(place.priceLevel)}
                              </span>
                            </>
                          )}
                          {place.saveCount > 0 && (
                            <>
                              <span>·</span>
                              <span className="flex-shrink-0">
                                {place.saveCount} save{place.saveCount !== 1 ? "s" : ""}
                              </span>
                            </>
                          )}
                        </div>
                        {place.topTags.length > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {place.topTags.slice(0, 2).map((tag) => (
                              <span
                                key={tag.slug}
                                className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full"
                              >
                                {tag.displayName}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>

                      {/* Save button */}
                      <div
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDbSave(place);
                        }}
                      >
                        <HugeiconsIcon icon={Bookmark01Icon} className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Google fallback */}
              {filteredGoogle.length > 0 && (
                <div>
                  <p className="px-3 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {dbResults.length > 0 ? "Add new place" : "From Google"}
                  </p>
                  {filteredGoogle.map((result) => (
                    <button
                      key={result.place_id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-accent w-full text-left transition-colors"
                      onClick={() => handleGoogleSave(result)}
                      data-testid={`search-result-${result.place_id}`}
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
                        className="h-4 w-4 text-muted-foreground flex-shrink-0"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* No results */}
              {!hasResults && (
                <p className="p-3 text-center text-sm text-muted-foreground">
                  No places found for &ldquo;{searchQuery}&rdquo;
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Hidden save modal */}
      <div className="hidden">
        <SaveToListDropdown
          ref={saveRef}
          place={activePlace}
          onSaveSuccess={() => {
            pendingSaveRef.current = null;
          }}
        />
      </div>
    </div>
  );
}
