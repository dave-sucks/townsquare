import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { MapPin, Search, Heart, Check, Star, Navigation, DollarSign, Loader2 } from "lucide-react";
import type { SavedPlaceWithPlace, SavedPlaceStatus } from "@shared/schema";
import { AppLayout } from "@/components/app-layout";

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types?: string[];
  price_level?: number;
  photos?: Array<{ photo_reference: string }>;
}

export default function SearchPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [savingStatus, setSavingStatus] = useState<SavedPlaceStatus | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/login");
    }
  }, [user, authLoading, setLocation]);

  const { data: savedPlaces, isLoading: savedPlacesLoading } = useQuery<SavedPlaceWithPlace[]>({
    queryKey: ["/api/saved-places"],
    enabled: !!user,
  });

  const searchPlaces = useCallback(async (query: string) => {
    if (query.length < 2) {
      setPredictions([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/places/autocomplete?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.predictions) {
        setPredictions(data.predictions);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchPlaces(searchQuery);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchPlaces]);

  const selectPlace = async (placeId: string) => {
    try {
      const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(placeId)}`);
      const data = await res.json();
      if (data.result) {
        setSelectedPlace(data.result);
        setPredictions([]);
        setSearchQuery(data.result.name);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to get place details", variant: "destructive" });
    }
  };

  const savePlaceMutation = useMutation({
    mutationFn: async ({ place, status }: { place: PlaceDetails; status: SavedPlaceStatus }) => {
      const res = await fetch("/api/places/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googlePlaceId: place.place_id,
          name: place.name,
          formattedAddress: place.formatted_address,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          types: place.types,
          priceLevel: place.price_level?.toString(),
          photoRefs: place.photos?.slice(0, 3).map(p => p.photo_reference),
          status,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to save place");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-places"] });
      toast({ title: "Success!", description: "Place saved to your list." });
      setSelectedPlace(null);
      setSearchQuery("");
      setSavingStatus(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSavingStatus(null);
    },
  });

  const handleSave = (status: SavedPlaceStatus) => {
    if (!selectedPlace) return;
    setSavingStatus(status);
    savePlaceMutation.mutate({ place: selectedPlace, status });
  };

  const getPriceLevel = (level?: number) => {
    if (!level) return null;
    return "$".repeat(level);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Discover Places</h1>
            <p className="text-muted-foreground">
              Search for restaurants, cafes, and more to add to your list
            </p>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              data-testid="input-search"
              type="search"
              placeholder="Search for a place..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-muted-foreground" />
            )}
          </div>

          {predictions.length > 0 && !selectedPlace && (
            <Card className="mb-6">
              <CardContent className="p-2">
                {predictions.map((prediction) => (
                  <button
                    key={prediction.place_id}
                    data-testid={`prediction-${prediction.place_id}`}
                    onClick={() => selectPlace(prediction.place_id)}
                    className="w-full flex items-start gap-3 p-3 rounded-md hover-elevate text-left transition-colors"
                  >
                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {prediction.structured_formatting.main_text}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {prediction.structured_formatting.secondary_text}
                      </p>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {selectedPlace && (
            <Card className="mb-6 border-primary/20">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-xl">{selectedPlace.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <Navigation className="w-4 h-4" />
                      {selectedPlace.formatted_address}
                    </CardDescription>
                  </div>
                  {selectedPlace.price_level && (
                    <Badge variant="secondary" className="flex-shrink-0">
                      <DollarSign className="w-3 h-3 mr-1" />
                      {getPriceLevel(selectedPlace.price_level)}
                    </Badge>
                  )}
                </div>
                {selectedPlace.types && selectedPlace.types.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedPlace.types.slice(0, 3).map((type) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Button
                    data-testid="button-save-want"
                    onClick={() => handleSave("WANT")}
                    disabled={savePlaceMutation.isPending}
                    className="flex-1"
                    variant="outline"
                  >
                    {savingStatus === "WANT" ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Heart className="w-4 h-4 mr-2" />
                    )}
                    Want to Go
                  </Button>
                  <Button
                    data-testid="button-save-been"
                    onClick={() => handleSave("BEEN")}
                    disabled={savePlaceMutation.isPending}
                    className="flex-1"
                  >
                    {savingStatus === "BEEN" ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Been There
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Your Saved Places</h2>
            {savedPlacesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-5 w-48 mb-2" />
                      <Skeleton className="h-4 w-64" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : savedPlaces && savedPlaces.length > 0 ? (
              <div className="space-y-3">
                {savedPlaces.map((sp) => (
                  <Card
                    key={sp.id}
                    data-testid={`saved-place-${sp.id}`}
                    className="hover-elevate cursor-pointer"
                    onClick={() => setLocation(`/place/${sp.place.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">{sp.place.name}</h3>
                            <Badge
                              variant={sp.status === "BEEN" ? "default" : "secondary"}
                              className="flex-shrink-0"
                            >
                              {sp.status === "BEEN" ? (
                                <>
                                  <Check className="w-3 h-3 mr-1" />
                                  Been
                                </>
                              ) : (
                                <>
                                  <Heart className="w-3 h-3 mr-1" />
                                  Want
                                </>
                              )}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {sp.place.formattedAddress}
                          </p>
                        </div>
                        <Star className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <MapPin className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    No saved places yet. Search for a place above to get started!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
