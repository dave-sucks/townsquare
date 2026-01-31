import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { MapPin, Heart, Check, Navigation, X, ExternalLink, Loader2 } from "lucide-react";
import type { SavedPlaceWithPlace } from "@shared/schema";
import { AppLayout } from "@/components/app-layout";

declare global {
  interface Window {
    google: typeof google;
    initMap: () => void;
  }
}

export default function MapPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<SavedPlaceWithPlace | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/login");
    }
  }, [user, authLoading, setLocation]);

  const { data: savedPlaces, isLoading: placesLoading } = useQuery<SavedPlaceWithPlace[]>({
    queryKey: ["/api/saved-places"],
    enabled: !!user,
  });

  const initializeMap = useCallback(() => {
    if (!mapRef.current || !window.google || mapInstanceRef.current) return;

    const defaultCenter = { lat: 40.7128, lng: -74.006 };
    
    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      zoom: 12,
      center: defaultCenter,
      mapId: "beli-map",
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    setMapLoaded(true);
  }, []);

  useEffect(() => {
    if (window.google) {
      initializeMap();
      return;
    }

    const script = document.createElement("script");
    script.src = `/api/maps/script`;
    script.async = true;
    script.defer = true;
    
    window.initMap = initializeMap;
    script.onload = initializeMap;
    
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [initializeMap]);

  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !savedPlaces) return;

    markersRef.current.forEach((marker) => {
      marker.map = null;
    });
    markersRef.current = [];

    if (savedPlaces.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    savedPlaces.forEach((sp) => {
      const position = { lat: sp.place.lat, lng: sp.place.lng };
      bounds.extend(position);

      const pinBackground = sp.status === "BEEN" ? "#2563eb" : "#f97316";

      const pin = new window.google.maps.marker.PinElement({
        background: pinBackground,
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
        scale: 1.2,
      });

      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapInstanceRef.current,
        position,
        title: sp.place.name,
        content: pin.element,
      });

      marker.addListener("click", () => {
        setSelectedPlace(sp);
      });

      markersRef.current.push(marker);
    });

    if (savedPlaces.length === 1) {
      mapInstanceRef.current.setCenter({
        lat: savedPlaces[0].place.lat,
        lng: savedPlaces[0].place.lng,
      });
      mapInstanceRef.current.setZoom(15);
    } else {
      mapInstanceRef.current.fitBounds(bounds, { padding: 50 });
    }
  }, [mapLoaded, savedPlaces]);

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
      <div className="flex-1 relative overflow-hidden">
        {!mapLoaded || placesLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading map...</p>
            </div>
          </div>
        ) : null}
        
        <div
          ref={mapRef}
          data-testid="map-container"
          className="w-full h-full"
          style={{ minHeight: "calc(100vh - 64px)" }}
        />

        {savedPlaces && savedPlaces.length === 0 && mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Card className="pointer-events-auto max-w-sm mx-4">
              <CardContent className="p-6 text-center">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold mb-2">No places saved yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Search for places to add them to your map
                </p>
                <Button onClick={() => setLocation("/search")}>
                  Search Places
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedPlace && (
          <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-10">
            <Card data-testid="place-overlay" className="shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg truncate" data-testid="overlay-place-name">
                      {selectedPlace.place.name}
                    </CardTitle>
                    <CardDescription className="flex items-start gap-1 mt-1">
                      <Navigation className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2 text-xs">
                        {selectedPlace.place.formattedAddress}
                      </span>
                    </CardDescription>
                  </div>
                  <Button
                    data-testid="button-close-overlay"
                    size="icon"
                    variant="ghost"
                    onClick={() => setSelectedPlace(null)}
                    className="flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-center justify-between">
                  <Badge
                    data-testid="overlay-status"
                    variant={selectedPlace.status === "BEEN" ? "default" : "secondary"}
                  >
                    {selectedPlace.status === "BEEN" ? (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        Been There
                      </>
                    ) : (
                      <>
                        <Heart className="w-3 h-3 mr-1" />
                        Want to Go
                      </>
                    )}
                  </Badge>
                  <Button
                    data-testid="button-view-details"
                    size="sm"
                    onClick={() => setLocation(`/place/${selectedPlace.place.id}`)}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
