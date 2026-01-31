import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { MapPin, Heart, Check, Navigation, DollarSign, ArrowLeft, Map, Loader2, Trash2 } from "lucide-react";
import type { PlaceWithSavedStatus, SavedPlaceStatus } from "@shared/schema";
import { AppLayout } from "@/components/app-layout";

export default function PlacePage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [savingStatus, setSavingStatus] = useState<SavedPlaceStatus | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/login");
    }
  }, [user, authLoading, setLocation]);

  const { data: place, isLoading } = useQuery<PlaceWithSavedStatus>({
    queryKey: ["/api/places", params.id],
    enabled: !!user && !!params.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: SavedPlaceStatus) => {
      const res = await fetch(`/api/places/${params.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/places", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-places"] });
      toast({ title: "Updated!", description: "Place status has been updated." });
      setSavingStatus(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSavingStatus(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/places/${params.id}/remove`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to remove place");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-places"] });
      toast({ title: "Removed", description: "Place has been removed from your list." });
      setLocation("/search");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleUpdateStatus = (status: SavedPlaceStatus) => {
    setSavingStatus(status);
    updateStatusMutation.mutate(status);
  };

  const getPriceLevel = (level?: string | null) => {
    if (!level) return null;
    const num = parseInt(level);
    if (isNaN(num)) return null;
    return "$".repeat(num);
  };

  if (authLoading || isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 overflow-auto">
          <div className="max-w-2xl mx-auto p-6">
            <Skeleton className="h-8 w-32 mb-6" />
            <Card>
              <CardHeader>
                <Skeleton className="h-7 w-64 mb-2" />
                <Skeleton className="h-5 w-full" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!user) return null;

  if (!place) {
    return (
      <AppLayout>
        <div className="flex-1 overflow-auto">
          <div className="max-w-2xl mx-auto p-6">
            <Button
              variant="ghost"
              onClick={() => setLocation("/search")}
              className="mb-6"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Card>
              <CardContent className="p-8 text-center">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Place not found</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-6">
          <Button
            data-testid="button-back"
            variant="ghost"
            onClick={() => setLocation("/search")}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Search
          </Button>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-2xl" data-testid="text-place-name">
                    {place.name}
                  </CardTitle>
                  <CardDescription className="flex items-start gap-1 mt-2">
                    <Navigation className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span data-testid="text-place-address">{place.formattedAddress}</span>
                  </CardDescription>
                </div>
                {place.savedPlace && (
                  <Badge
                    data-testid="badge-status"
                    variant={place.savedPlace.status === "BEEN" ? "default" : "secondary"}
                    className="flex-shrink-0"
                  >
                    {place.savedPlace.status === "BEEN" ? (
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
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-4">
                {place.priceLevel && (
                  <Badge variant="outline">
                    <DollarSign className="w-3 h-3 mr-1" />
                    {getPriceLevel(place.priceLevel)}
                  </Badge>
                )}
                {place.types && Array.isArray(place.types) && place.types.slice(0, 4).map((type) => (
                  <Badge key={type} variant="outline" className="text-xs">
                    {type.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button
                  data-testid="button-want"
                  onClick={() => handleUpdateStatus("WANT")}
                  disabled={updateStatusMutation.isPending}
                  variant={place.savedPlace?.status === "WANT" ? "default" : "outline"}
                  className="flex-1"
                >
                  {savingStatus === "WANT" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Heart className="w-4 h-4 mr-2" />
                  )}
                  Want to Go
                </Button>
                <Button
                  data-testid="button-been"
                  onClick={() => handleUpdateStatus("BEEN")}
                  disabled={updateStatusMutation.isPending}
                  variant={place.savedPlace?.status === "BEEN" ? "default" : "outline"}
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

              <div className="flex gap-3">
                <Button
                  data-testid="button-view-map"
                  variant="outline"
                  onClick={() => setLocation("/map")}
                  className="flex-1"
                >
                  <Map className="w-4 h-4 mr-2" />
                  View on Map
                </Button>
                {place.savedPlace && (
                  <Button
                    data-testid="button-remove"
                    variant="outline"
                    onClick={() => removeMutation.mutate()}
                    disabled={removeMutation.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    {removeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
