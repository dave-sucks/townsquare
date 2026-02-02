"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, DollarSign, Bookmark, Check, Loader2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PlaceResult {
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  types: string[];
  primaryType: string | null;
  priceLevel: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
  photoRef: string | null;
}

interface ChatPlaceCardProps {
  place: PlaceResult;
  onSaved?: () => void;
}

export function ChatPlaceCard({ place, onSaved }: ChatPlaceCardProps) {
  const [isSaved, setIsSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const detailsResponse = await fetch(`/api/places/details?place_id=${place.googlePlaceId}`);
      const detailsData = await detailsResponse.json();
      if (!detailsData.place) throw new Error("Failed to get place details");
      
      return apiRequest("/api/saved-places", {
        method: "POST",
        body: JSON.stringify({ ...detailsData.place, hasBeen: false }),
      });
    },
    onSuccess: () => {
      setIsSaved(true);
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      toast.success(`Saved ${place.name}!`);
      onSaved?.();
    },
    onError: (error: Error) => {
      if (error.message.includes("already saved")) {
        setIsSaved(true);
        toast.info("Already in your places!");
      } else {
        toast.error(error.message || "Failed to save place");
      }
    },
  });

  const formatType = (type: string | null) => {
    if (!type) return "Place";
    return type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPriceLevel = (level: string | null) => {
    if (!level) return null;
    const num = parseInt(level);
    return "$".repeat(num);
  };

  const photoUrl = place.photoRef 
    ? `/api/places/photo?ref=${place.photoRef}&maxwidth=400`
    : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex">
        {photoUrl && (
          <div className="w-24 h-24 shrink-0">
            <img 
              src={photoUrl} 
              alt={place.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="font-medium text-sm truncate">{place.name}</h4>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span>{formatType(place.primaryType)}</span>
                {place.rating && (
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {place.rating.toFixed(1)}
                    {place.userRatingsTotal && (
                      <span className="text-muted-foreground">({place.userRatingsTotal})</span>
                    )}
                  </span>
                )}
                {getPriceLevel(place.priceLevel) && (
                  <span className="text-muted-foreground">{getPriceLevel(place.priceLevel)}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {place.formattedAddress}
              </p>
            </div>
            <Button
              size="icon-sm"
              variant={isSaved ? "default" : "outline"}
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || isSaved}
              className={cn(isSaved && "bg-green-600 hover:bg-green-600")}
              data-testid={`button-save-place-${place.googlePlaceId}`}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSaved ? (
                <Check className="h-4 w-4" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

interface ChatPlaceCardsProps {
  places: PlaceResult[];
}

export function ChatPlaceCards({ places }: ChatPlaceCardsProps) {
  if (!places || places.length === 0) return null;

  return (
    <div className="space-y-2 my-3">
      {places.map((place) => (
        <ChatPlaceCard key={place.googlePlaceId} place={place} />
      ))}
    </div>
  );
}
