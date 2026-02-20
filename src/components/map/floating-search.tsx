"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  Bookmark01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { SaveToListDropdown } from "@/components/shared/save-to-list-dropdown";
import type { SaveToListDropdownHandle } from "@/components/shared/save-to-list-dropdown";

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

const EMPTY_PLACE = {
  googlePlaceId: "",
  name: "",
  formattedAddress: "",
  lat: 0,
  lng: 0,
};

export function FloatingSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [activePrediction, setActivePrediction] = useState<PlacePrediction | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const locationRequested = useRef(false);
  const saveRef = useRef<SaveToListDropdownHandle>(null);

  const currentPlace = activePrediction ? {
    googlePlaceId: activePrediction.place_id,
    name: activePrediction.structured_formatting.main_text,
    formattedAddress: activePrediction.structured_formatting.secondary_text,
    lat: 0,
    lng: 0,
  } : EMPTY_PLACE;

  useEffect(() => {
    if (!locationRequested.current && navigator.geolocation) {
      locationRequested.current = true;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    }
  }, []);

  const searchPlaces = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      let url = `/api/places/search?q=${encodeURIComponent(query)}`;
      if (userLocation) {
        url += `&lat=${userLocation.lat}&lng=${userLocation.lng}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      setSearchResults(data.predictions || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  }, [userLocation]);

  useEffect(() => {
    const debounce = setTimeout(() => searchPlaces(searchQuery), 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchPlaces]);

  const handleClear = () => {
    setSearchQuery("");
    setSearchResults([]);
    setActivePrediction(null);
  };

  const handleSaveClick = (prediction: PlacePrediction) => {
    flushSync(() => {
      setActivePrediction(prediction);
      setSearchResults([]);
    });
    saveRef.current?.triggerSave();
  };

  const showResults = !activePrediction && isFocused && (isSearching || searchResults.length > 0 || searchQuery.trim().length > 0);

  return (
    <div className="md:w-96 md:ml-auto">
      <div className="relative">
        <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search for a place..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (activePrediction) {
              setActivePrediction(null);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 300)}
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

      {showResults && (
        <div className="mt-2 bg-background border rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {isSearching && (
            <div className="space-y-2 p-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}
          {!isSearching && searchResults.length > 0 && (
            <div className="py-1">
              {searchResults.map((result) => (
                <button
                  key={result.place_id}
                  className="flex items-center gap-2 px-3 py-2 hover-elevate w-full text-left"
                  onClick={() => handleSaveClick(result)}
                  data-testid={`search-result-${result.place_id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{result.structured_formatting.main_text}</p>
                    <p className="text-xs text-muted-foreground truncate">{result.structured_formatting.secondary_text}</p>
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    <HugeiconsIcon icon={Bookmark01Icon} className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
          {!isSearching && searchQuery && searchResults.length === 0 && (
            <p className="p-3 text-center text-sm text-muted-foreground">No places found</p>
          )}
        </div>
      )}

      {activePrediction && (
        <div className="mt-2 bg-background border rounded-lg shadow-lg p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{activePrediction.structured_formatting.main_text}</p>
            <p className="text-xs text-muted-foreground truncate">{activePrediction.structured_formatting.secondary_text}</p>
          </div>
          <SaveToListDropdown
            ref={saveRef}
            place={currentPlace}
            onSaveSuccess={() => {}}
            size="sm"
            showLabel
          />
        </div>
      )}
    </div>
  );
}
