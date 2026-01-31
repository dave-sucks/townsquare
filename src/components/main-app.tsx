"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapPin, Search, LogOut, Heart, CheckCircle, Plus } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { PlaceMap } from "@/components/place-map";
import { PlaceRow } from "@/components/place-row";
import { PlacePreview } from "@/components/place-preview";

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
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

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export function MainApp({ user }: { user: User }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTab, setSelectedTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  
  const placeRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { data: savedPlacesData, isLoading: isLoadingPlaces } = useQuery<{ savedPlaces: SavedPlace[] }>({
    queryKey: ["saved-places"],
    queryFn: () => apiRequest("/api/saved-places"),
  });

  const savedPlaces = savedPlacesData?.savedPlaces || [];

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
    const debounce = setTimeout(() => {
      searchPlaces(searchQuery);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchPlaces]);

  const savePlaceMutation = useMutation({
    mutationFn: async ({ placeId, status }: { placeId: string; status: "WANT" | "BEEN" }) => {
      const detailsResponse = await fetch(`/api/places/details?place_id=${placeId}`);
      const detailsData = await detailsResponse.json();
      
      if (!detailsData.place) {
        throw new Error("Failed to get place details");
      }

      return apiRequest("/api/saved-places", {
        method: "POST",
        body: JSON.stringify({
          ...detailsData.place,
          status,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      setSearchQuery("");
      setSearchResults([]);
      setDialogOpen(false);
      toast.success("Place saved!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save place");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "WANT" | "BEEN" }) => {
      return apiRequest(`/api/saved-places/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      toast.success("Status updated!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  const deletePlaceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/saved-places/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      if (selectedPlaceId === deletedId) {
        setSelectedPlaceId(null);
      }
      toast.success("Place removed!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove place");
    },
  });

  const filteredPlaces = savedPlaces.filter((sp) => {
    if (selectedTab === "all") return true;
    if (selectedTab === "want") return sp.status === "WANT";
    if (selectedTab === "been") return sp.status === "BEEN";
    return true;
  });

  const selectedPlace = selectedPlaceId 
    ? savedPlaces.find(sp => sp.id === selectedPlaceId) 
    : null;

  const handleListItemClick = useCallback((savedPlaceId: string) => {
    setSelectedPlaceId(savedPlaceId);
  }, []);

  const handleMarkerClick = useCallback((savedPlaceId: string) => {
    setSelectedPlaceId(savedPlaceId);
    
    const rowElement = placeRowRefs.current.get(savedPlaceId);
    if (rowElement) {
      rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const handleClosePreview = useCallback(() => {
    setSelectedPlaceId(null);
  }, []);

  const userName = user.firstName || user.email?.split("@")[0] || "User";

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold">Beli</span>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-place">
                <Plus className="mr-2 h-4 w-4" />
                Add Place
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add a Place</DialogTitle>
                <DialogDescription>
                  Search for a place and save it to your list
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
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
                <div className="max-h-60 overflow-y-auto">
                  {isSearching && (
                    <div className="space-y-2 p-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  )}
                  {!isSearching && searchResults.length > 0 && (
                    <div className="space-y-1">
                      {searchResults.map((result) => (
                        <div
                          key={result.place_id}
                          className="rounded-md border p-3"
                          data-testid={`search-result-${result.place_id}`}
                        >
                          <p className="font-medium">{result.structured_formatting.main_text}</p>
                          <p className="text-sm text-muted-foreground">{result.structured_formatting.secondary_text}</p>
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => savePlaceMutation.mutate({ placeId: result.place_id, status: "WANT" })}
                              disabled={savePlaceMutation.isPending}
                              data-testid={`button-save-want-${result.place_id}`}
                            >
                              <Heart className="mr-1 h-3 w-3" />
                              Want
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => savePlaceMutation.mutate({ placeId: result.place_id, status: "BEEN" })}
                              disabled={savePlaceMutation.isPending}
                              data-testid={`button-save-been-${result.place_id}`}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Been
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!isSearching && searchQuery && searchResults.length === 0 && (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      No places found
                    </p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="button-user-menu">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.profileImageUrl || undefined} alt={userName} />
                  <AvatarFallback>{userName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="flex items-center justify-start gap-2 p-2">
                <p className="text-sm font-medium">{userName}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/api/logout" className="flex items-center" data-testid="button-logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="grid h-full lg:grid-cols-2">
          <div className="flex flex-col border-r">
            <div className="p-4 pb-0">
              <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all" data-testid="tab-all">
                    All ({savedPlaces.length})
                  </TabsTrigger>
                  <TabsTrigger value="want" data-testid="tab-want">
                    Want ({savedPlaces.filter((p) => p.status === "WANT").length})
                  </TabsTrigger>
                  <TabsTrigger value="been" data-testid="tab-been">
                    Been ({savedPlaces.filter((p) => p.status === "BEEN").length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <ScrollArea className="flex-1 p-4">
              {isLoadingPlaces ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : filteredPlaces.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <MapPin className="mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="text-lg font-medium">No places yet</p>
                    <p className="text-sm text-muted-foreground">
                      Add your first place to get started
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredPlaces.map((savedPlace) => (
                    <PlaceRow
                      key={savedPlace.id}
                      ref={(el) => {
                        if (el) {
                          placeRowRefs.current.set(savedPlace.id, el);
                        } else {
                          placeRowRefs.current.delete(savedPlace.id);
                        }
                      }}
                      savedPlace={savedPlace}
                      isSelected={savedPlace.id === selectedPlaceId}
                      onSelect={() => handleListItemClick(savedPlace.id)}
                      onToggleStatus={() =>
                        updateStatusMutation.mutate({
                          id: savedPlace.id,
                          status: savedPlace.status === "WANT" ? "BEEN" : "WANT",
                        })
                      }
                      onDelete={() => deletePlaceMutation.mutate(savedPlace.id)}
                      isUpdating={updateStatusMutation.isPending}
                      isDeleting={deletePlaceMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="relative h-full">
            <PlaceMap
              places={savedPlaces}
              selectedPlaceId={selectedPlaceId}
              onMarkerClick={handleMarkerClick}
            />
            {selectedPlace && (
              <PlacePreview
                savedPlace={selectedPlace}
                onClose={handleClosePreview}
                onToggleStatus={() =>
                  updateStatusMutation.mutate({
                    id: selectedPlace.id,
                    status: selectedPlace.status === "WANT" ? "BEEN" : "WANT",
                  })
                }
                onDelete={() => deletePlaceMutation.mutate(selectedPlace.id)}
                isUpdating={updateStatusMutation.isPending}
                isDeleting={deletePlaceMutation.isPending}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
