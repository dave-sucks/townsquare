"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Heart, CheckCircle, MapPin, ExternalLink, List, Lock, Globe, Trash2, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { AddToListDialog } from "@/components/add-to-list-dialog";

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
}

interface ListData {
  id: string;
  name: string;
  visibility: "PRIVATE" | "PUBLIC";
  _count: {
    listPlaces: number;
  };
}

interface FriendSavedPlace {
  id: string;
  status: "WANT" | "BEEN";
  user: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
}

interface PlaceDetailData {
  place: Place;
  savedPlace: SavedPlace | null;
  listsContainingPlace: ListData[];
  friendsWhoSaved: FriendSavedPlace[];
}

export default function PlaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: placeId } = use(params);
  const { user, isAuthenticated } = useAuth();
  const [addToListDialogOpen, setAddToListDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery<PlaceDetailData>({
    queryKey: ["place-detail", placeId],
    queryFn: () => apiRequest(`/api/places/${placeId}`),
    enabled: isAuthenticated,
  });

  const place = data?.place;
  const savedPlace = data?.savedPlace;
  const listsContainingPlace = data?.listsContainingPlace || [];
  const friendsWhoSaved = data?.friendsWhoSaved || [];

  const saveOrUpdatePlaceMutation = useMutation({
    mutationFn: async (status: "WANT" | "BEEN") => {
      if (savedPlace) {
        return apiRequest(`/api/saved-places/${savedPlace.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
      } else if (place) {
        return apiRequest("/api/saved-places", {
          method: "POST",
          body: JSON.stringify({
            googlePlaceId: place.googlePlaceId,
            name: place.name,
            formattedAddress: place.formattedAddress,
            lat: place.lat,
            lng: place.lng,
            primaryType: place.primaryType,
            types: place.types,
            priceLevel: place.priceLevel,
            photoRefs: place.photoRefs,
            status,
          }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["place-detail", placeId] });
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      toast.success(savedPlace ? "Status updated!" : "Place saved!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update place");
    },
  });

  const removePlaceFromListMutation = useMutation({
    mutationFn: async (listId: string) => {
      return apiRequest(`/api/lists/${listId}/places`, {
        method: "DELETE",
        body: JSON.stringify({ placeId: place?.id }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["place-detail", placeId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      toast.success("Removed from list!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove from list");
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">Please sign in</p>
            <Button asChild className="mt-4">
              <Link href="/">Go to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container py-8 max-w-2xl">
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!place) {
    return (
      <div className="container py-8 max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">Place not found</p>
            <Button asChild className="mt-4">
              <Link href="/">Go to Map</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const googleMapsUrl = `https://www.google.com/maps/place/?q=place_id:${place.googlePlaceId}`;

  return (
    <div className="container py-8 max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/" data-testid="button-back-map">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Map
          </Link>
        </Button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold" data-testid="text-place-name">{place.name}</h1>
            <p className="text-muted-foreground mt-1" data-testid="text-place-address">{place.formattedAddress}</p>
          </div>
          {savedPlace && (
            <Badge 
              variant={savedPlace.status === "WANT" ? "secondary" : "default"}
              data-testid="badge-place-status"
            >
              {savedPlace.status === "WANT" ? (
                <>
                  <Heart className="mr-1 h-3 w-3" />
                  Want to visit
                </>
              ) : (
                <>
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Been there
                </>
              )}
            </Badge>
          )}
          {!savedPlace && (
            <Badge variant="outline" data-testid="badge-place-status">
              Not saved
            </Badge>
          )}
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={savedPlace?.status === "WANT" ? "default" : "outline"}
              onClick={() => saveOrUpdatePlaceMutation.mutate("WANT")}
              disabled={saveOrUpdatePlaceMutation.isPending}
              data-testid="button-mark-want"
            >
              <Heart className="mr-2 h-4 w-4" />
              {savedPlace?.status === "WANT" ? "Saved as Want" : "Mark as Want"}
            </Button>
            <Button
              variant={savedPlace?.status === "BEEN" ? "default" : "outline"}
              onClick={() => saveOrUpdatePlaceMutation.mutate("BEEN")}
              disabled={saveOrUpdatePlaceMutation.isPending}
              data-testid="button-mark-been"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {savedPlace?.status === "BEEN" ? "Saved as Been" : "Mark as Been"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setAddToListDialogOpen(true)}
              data-testid="button-add-to-list"
            >
              <List className="mr-2 h-4 w-4" />
              Add to List
            </Button>
            <Button variant="outline" asChild data-testid="button-open-google-maps">
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in Google Maps
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Your Lists</CardTitle>
          <CardDescription>Lists containing this place</CardDescription>
        </CardHeader>
        <CardContent>
          {listsContainingPlace.length === 0 ? (
            <p className="text-sm text-muted-foreground">This place is not in any of your lists yet.</p>
          ) : (
            <div className="space-y-2">
              {listsContainingPlace.map((list) => (
                <div 
                  key={list.id} 
                  className="flex items-center justify-between gap-2 p-2 rounded-md border"
                  data-testid={`list-item-${list.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Link 
                      href={`/lists/${list.id}`}
                      className="font-medium hover:underline truncate"
                      data-testid={`link-list-${list.id}`}
                    >
                      {list.name}
                    </Link>
                    <Badge variant="outline" className="shrink-0">
                      {list.visibility === "PRIVATE" ? (
                        <Lock className="h-3 w-3" />
                      ) : (
                        <Globe className="h-3 w-3" />
                      )}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removePlaceFromListMutation.mutate(list.id)}
                    disabled={removePlaceFromListMutation.isPending}
                    data-testid={`button-remove-from-list-${list.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">
            <Users className="inline-block mr-2 h-4 w-4" />
            Friends who saved this place
          </CardTitle>
        </CardHeader>
        <CardContent>
          {friendsWhoSaved.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-friends-saved">
              None of the people you follow have saved this place yet.
            </p>
          ) : (
            <div className="space-y-3">
              {friendsWhoSaved.map((friend) => {
                const displayName = friend.user.firstName
                  ? `${friend.user.firstName}${friend.user.lastName ? ` ${friend.user.lastName}` : ""}`
                  : friend.user.username || "User";
                return (
                  <Link
                    key={friend.id}
                    href={`/u/${friend.user.username || friend.user.id}`}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors"
                    data-testid={`friend-saved-${friend.id}`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={friend.user.profileImageUrl || undefined} alt={displayName} />
                      <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{displayName}</p>
                    </div>
                    <Badge variant={friend.status === "WANT" ? "secondary" : "default"} className="shrink-0">
                      {friend.status === "WANT" ? (
                        <>
                          <Heart className="mr-1 h-3 w-3" />
                          Want
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Been
                        </>
                      )}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground" data-testid="text-reviews-placeholder">
            Reviews coming soon
          </p>
        </CardContent>
      </Card>

      <AddToListDialog
        open={addToListDialogOpen}
        onOpenChange={setAddToListDialogOpen}
        placeId={place.googlePlaceId}
        placeName={place.name}
      />
    </div>
  );
}
