"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Heart, CheckCircle, X, Settings } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export function FloatingSearch({ 
  showSettings = false,
  settingsProps = {} 
}: { 
  showSettings?: boolean;
  settingsProps?: any;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isMobile = useIsMobile();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const searchPlaces = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data.predictions || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => searchPlaces(searchQuery), 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchPlaces]);

  const savePlaceMutation = useMutation({
    mutationFn: async ({ placeId, status }: { placeId: string; status: "WANT" | "BEEN" }) => {
      const detailsResponse = await fetch(`/api/places/details?place_id=${placeId}`);
      const detailsData = await detailsResponse.json();
      if (!detailsData.place) throw new Error("Failed to get place details");
      return apiRequest("/api/saved-places", {
        method: "POST",
        body: JSON.stringify({ ...detailsData.place, status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      setSearchQuery("");
      setSearchResults([]);
      setIsFocused(false);
      toast.success("Place saved!");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save place"),
  });

  const handleClear = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  const showResults = isFocused && (isSearching || searchResults.length > 0 || (searchQuery && searchResults.length === 0));

  return (
    <div className={cn(
      "absolute z-20 transition-all duration-200",
      isMobile 
        ? "top-0 left-0 right-0 p-3 bg-background/80 backdrop-blur-md border-b shadow-sm" 
        : "top-3 right-3 w-80"
    )}>
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search for a place..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            className={cn(
              "pl-10 pr-10 bg-background shadow-lg border h-10",
              isMobile && "shadow-none border-muted"
            )}
            data-testid="input-search-place"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <button
                onClick={handleClear}
                className="p-1 text-muted-foreground hover:text-foreground"
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {isMobile && showSettings && (
              <MapSettingsPopover
                {...settingsProps}
                isOpen={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    data-testid="button-mobile-settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </div>

      {showResults && (
        <div className="mt-2 bg-background border rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {isSearching && (
            <div className="space-y-2 p-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {!isSearching && searchResults.length > 0 && (
            <div className="py-1">
              {searchResults.map((result) => (
                <div
                  key={result.place_id}
                  className="px-3 py-2 hover-elevate cursor-pointer"
                  data-testid={`search-result-${result.place_id}`}
                >
                  <p className="font-medium text-sm">{result.structured_formatting.main_text}</p>
                  <p className="text-xs text-muted-foreground truncate">{result.structured_formatting.secondary_text}</p>
                  <div className="mt-1.5 flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => savePlaceMutation.mutate({ placeId: result.place_id, status: "WANT" })}
                      disabled={savePlaceMutation.isPending}
                      data-testid={`button-save-want-${result.place_id}`}
                    >
                      <Heart className="mr-1 h-3 w-3" />Want
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => savePlaceMutation.mutate({ placeId: result.place_id, status: "BEEN" })}
                      disabled={savePlaceMutation.isPending}
                      data-testid={`button-save-been-${result.place_id}`}
                    >
                      <CheckCircle className="mr-1 h-3 w-3" />Been
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isSearching && searchQuery && searchResults.length === 0 && (
            <p className="p-3 text-center text-sm text-muted-foreground">No places found</p>
          )}
        </div>
      )}
    </div>
  );
}
