"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Search, Heart, CheckCircle, ChevronDown, Check } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { PlacesList } from "@/components/shared/places-list";
import type { SidebarInjectedProps } from "@/components/map/map-layout";

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

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface ListData {
  id: string;
  name: string;
  _count: { listPlaces: number };
}

interface DiscoverSidebarProps extends Partial<SidebarInjectedProps> {
  places: SavedPlace[];
  isLoading: boolean;
  statusFilter: "all" | "want" | "been";
  listFilter: string;
  onStatusFilterChange: (value: "all" | "want" | "been") => void;
  onListFilterChange: (listId: string) => void;
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
}: DiscoverSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { data: listsData } = useQuery<{ lists: ListData[] }>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("/api/lists"),
  });

  const lists = listsData?.lists || [];

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
      toast.success("Place saved!");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save place"),
  });

  const selectedStatusLabel = statusOptions.find((o) => o.value === statusFilter)?.label || "All";
  const selectedListLabel = listFilter === "all" 
    ? "All Lists" 
    : lists.find((l) => l.id === listFilter)?.name || "All Lists";

  return (
    <div className="h-full flex flex-col bg-background" data-testid="discover-sidebar">
      <div className="flex items-center gap-2 p-3 border-b">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <h1 className="font-semibold text-sm flex-1">Places</h1>
      </div>

      <div className="p-3 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search for a place..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-place"
          />
        </div>

        {(isSearching || searchResults.length > 0 || (searchQuery && searchResults.length === 0)) && (
          <div className="border rounded-lg max-h-60 overflow-y-auto">
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
                        className="h-7 text-xs"
                        onClick={() => savePlaceMutation.mutate({ placeId: result.place_id, status: "WANT" })}
                        disabled={savePlaceMutation.isPending}
                        data-testid={`button-save-want-${result.place_id}`}
                      >
                        <Heart className="mr-1 h-3 w-3" />Want
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
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

        <div className="flex gap-2">
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
      </div>

      <div className="flex-1 overflow-y-auto">
        <PlacesList
          places={places}
          isLoading={isLoading}
          selectedPlaceId={selectedPlaceId || null}
          onPlaceSelect={onPlaceSelect || (() => {})}
          placeRowRefs={placeRowRefs}
          showStatus={true}
        />
      </div>
    </div>
  );
}
