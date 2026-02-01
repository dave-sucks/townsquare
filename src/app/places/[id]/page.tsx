"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Heart, 
  CheckCircle, 
  MapPin, 
  ExternalLink, 
  List, 
  Lock, 
  Globe, 
  Trash2, 
  Star, 
  Edit, 
  Plus,
  Utensils,
  Clock,
  Phone,
  Mail,
  Link as LinkIcon
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { AddToListDialog } from "@/components/add-to-list-dialog";
import { ReviewDialog } from "@/components/review-dialog";
import { PlacePhotoGrid } from "@/components/place-photo-grid";
import { AppShell, PageHeader } from "@/components/layout";

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

interface Photo {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

interface Review {
  id: string;
  userId: string;
  placeId: string;
  rating: number;
  note: string | null;
  visitedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
  photos: Photo[];
}

interface PlaceDetailData {
  place: Place;
  savedPlace: SavedPlace | null;
  listsContainingPlace: ListData[];
  friendsWhoSaved: FriendSavedPlace[];
  myReview: Review | null;
  reviews: Review[];
  photos: Photo[];
}

function formatPlaceType(type: string | null): string {
  if (!type) return "Place";
  return type
    .replace(/_/g, " ")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatPriceLevel(priceLevel: string | null): string {
  if (!priceLevel) return "";
  const levels: Record<string, string> = {
    PRICE_LEVEL_FREE: "Free",
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  };
  return levels[priceLevel] || "";
}

export default function PlaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: placeId } = use(params);
  const { user, isAuthenticated } = useAuth();
  const [addToListDialogOpen, setAddToListDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery<PlaceDetailData>({
    queryKey: ["place-detail", placeId],
    queryFn: () => apiRequest(`/api/places/${placeId}`),
    enabled: isAuthenticated,
  });

  const place = data?.place;
  const savedPlace = data?.savedPlace;
  const listsContainingPlace = data?.listsContainingPlace || [];
  const friendsWhoSaved = data?.friendsWhoSaved || [];
  const myReview = data?.myReview;
  const reviews = data?.reviews || [];
  const photos = data?.photos || [];

  const placeType = formatPlaceType(place?.primaryType || null);
  const priceLevel = formatPriceLevel(place?.priceLevel || null);

  const friendsBeen = friendsWhoSaved.filter(f => f.status === "BEEN");
  const friendsWant = friendsWhoSaved.filter(f => f.status === "WANT");

  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      return apiRequest(`/api/reviews/${reviewId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["place-detail", placeId] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      toast.success("Review deleted!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete review");
    },
  });

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

  const googleMapsUrl = place ? `https://www.google.com/maps/place/?q=place_id:${place.googlePlaceId}` : "";

  if (!isAuthenticated) {
    return (
      <AppShell user={user}>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <MapPin className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Please sign in</p>
          <Button asChild className="mt-4">
            <Link href="/">Go to Home</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell user={user}>
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!place) {
    return (
      <AppShell user={user}>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <MapPin className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Place not found</p>
          <Button asChild className="mt-4">
            <Link href="/">Go to Map</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={user}>
      <PageHeader 
        title={place.name}
        backHref="/"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => saveOrUpdatePlaceMutation.mutate(savedPlace?.status === "WANT" ? "BEEN" : "WANT")}
          disabled={saveOrUpdatePlaceMutation.isPending}
          data-testid="button-save"
        >
          {savedPlace?.status === "WANT" ? (
            <><Heart className="h-4 w-4 mr-1 fill-current" />Saved</>
          ) : savedPlace?.status === "BEEN" ? (
            <><CheckCircle className="h-4 w-4 mr-1" />Been</>
          ) : (
            <><Heart className="h-4 w-4 mr-1" />Save</>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAddToListDialogOpen(true)}
          data-testid="button-add-to-trip"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add to trip
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-auto p-4 max-w-3xl mx-auto w-full">
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              {myReview && (
                <>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    <span className="font-medium text-foreground">{myReview.rating}/10</span>
                  </div>
                  <span>·</span>
                  <span>{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span>
                  <span>·</span>
                </>
              )}
              <span data-testid="text-place-address">{place.formattedAddress}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
              {placeType && (
                <div className="flex items-center gap-1 flex-wrap">
                  <Utensils className="h-3 w-3" />
                  <span>{placeType}</span>
                </div>
              )}
              {priceLevel && (
                <>
                  <span>·</span>
                  <span>{priceLevel}</span>
                </>
              )}
            </div>
          </div>

            <PlacePhotoGrid photos={photos} maxDisplay={5} />

            {friendsWhoSaved.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex -space-x-2 flex-wrap">
                  {friendsWhoSaved.slice(0, 3).map((friend) => {
                    const displayName = friend.user.firstName || friend.user.username || "User";
                    return (
                      <Avatar key={friend.id} className="h-6 w-6 border-2 border-background">
                        <AvatarImage src={friend.user.profileImageUrl || undefined} alt={displayName} />
                        <AvatarFallback className="text-xs">{displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                    );
                  })}
                </div>
                <span className="text-sm text-muted-foreground">
                  {friendsWhoSaved.length === 1 
                    ? `${friendsWhoSaved[0].user.firstName || friendsWhoSaved[0].user.username} saved this`
                    : `${friendsWhoSaved.length} friends saved this`}
                </span>
              </div>
            )}

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="w-full justify-start flex-wrap">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="lists" data-testid="tab-lists">Lists</TabsTrigger>
                <TabsTrigger value="reviews" data-testid="tab-reviews">Reviews</TabsTrigger>
                <TabsTrigger value="location" data-testid="tab-location">Location</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="pt-4 space-y-6">
                <div className="flex items-center gap-2 flex-wrap">
                  {savedPlace && (
                    <Badge 
                      variant={savedPlace.status === "WANT" ? "secondary" : "default"}
                      data-testid="badge-place-status"
                    >
                      {savedPlace.status === "WANT" ? (
                        <><Heart className="mr-1 h-3 w-3" />Want to visit</>
                      ) : (
                        <><CheckCircle className="mr-1 h-3 w-3" />Been there</>
                      )}
                    </Badge>
                  )}
                  {!savedPlace && (
                    <Badge variant="outline" data-testid="badge-place-status">Not saved</Badge>
                  )}
                </div>

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

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2 flex-wrap">
                    <Star className="h-4 w-4" />
                    Your Review
                  </h3>
                  {myReview ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="default" data-testid="badge-my-rating">
                            <Star className="mr-1 h-3 w-3 fill-current" />
                            {myReview.rating}/10
                          </Badge>
                          {myReview.visitedAt && (
                            <span className="text-sm text-muted-foreground">
                              Visited {new Date(myReview.visitedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReviewDialogOpen(true)}
                            data-testid="button-edit-review"
                          >
                            <Edit className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteReviewMutation.mutate(myReview.id)}
                            disabled={deleteReviewMutation.isPending}
                            data-testid="button-delete-review"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {myReview.note && (
                        <p className="text-sm" data-testid="text-my-review-note">{myReview.note}</p>
                      )}
                      {myReview.photos.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {myReview.photos.map((photo) => (
                            <img
                              key={photo.id}
                              src={photo.url}
                              alt="Review photo"
                              className="h-16 w-16 rounded-md object-cover"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-3">
                        Share your experience at this place
                      </p>
                      <Button onClick={() => setReviewDialogOpen(true)} data-testid="button-add-review">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Review
                      </Button>
                    </div>
                  )}
                </div>

                {friendsWhoSaved.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-3">Friends who saved this place</h3>
                      <div className="space-y-3">
                        {friendsBeen.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Been here</p>
                            <div className="flex flex-wrap gap-2">
                              {friendsBeen.map((friend) => {
                                const displayName = friend.user.firstName
                                  ? `${friend.user.firstName}${friend.user.lastName ? ` ${friend.user.lastName}` : ""}`
                                  : friend.user.username || "User";
                                return (
                                  <Link
                                    key={friend.id}
                                    href={`/u/${friend.user.username || friend.user.id}`}
                                    className="flex items-center gap-2 p-2 rounded-md hover-elevate flex-wrap"
                                    data-testid={`friend-saved-${friend.id}`}
                                  >
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={friend.user.profileImageUrl || undefined} alt={displayName} />
                                      <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium">{displayName}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {friendsWant.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Want to visit</p>
                            <div className="flex flex-wrap gap-2">
                              {friendsWant.map((friend) => {
                                const displayName = friend.user.firstName
                                  ? `${friend.user.firstName}${friend.user.lastName ? ` ${friend.user.lastName}` : ""}`
                                  : friend.user.username || "User";
                                return (
                                  <Link
                                    key={friend.id}
                                    href={`/u/${friend.user.username || friend.user.id}`}
                                    className="flex items-center gap-2 p-2 rounded-md hover-elevate flex-wrap"
                                    data-testid={`friend-saved-${friend.id}`}
                                  >
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={friend.user.profileImageUrl || undefined} alt={displayName} />
                                      <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium">{displayName}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="lists" className="pt-4 space-y-4">
                <h3 className="font-semibold">Your Lists</h3>
                {listsContainingPlace.length === 0 ? (
                  <p className="text-sm text-muted-foreground">This place is not in any of your lists yet.</p>
                ) : (
                  <div className="space-y-2">
                    {listsContainingPlace.map((list) => (
                      <div 
                        key={list.id} 
                        className="flex items-center justify-between gap-2 p-3 rounded-md border"
                        data-testid={`list-item-${list.id}`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
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
                <Button
                  variant="outline"
                  onClick={() => setAddToListDialogOpen(true)}
                  data-testid="button-add-to-another-list"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add to another list
                </Button>
              </TabsContent>

              <TabsContent value="reviews" className="pt-4 space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-semibold">All Reviews ({reviews.length})</h3>
                  {!myReview && (
                    <Button 
                      size="sm" 
                      onClick={() => setReviewDialogOpen(true)}
                      data-testid="button-write-review"
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Write a review
                    </Button>
                  )}
                </div>
                {reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-reviews">
                    No reviews yet. Be the first to review!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => {
                      const displayName = review.user.firstName
                        ? `${review.user.firstName}${review.user.lastName ? ` ${review.user.lastName}` : ""}`
                        : review.user.username || "User";
                      return (
                        <div key={review.id} className="border-b pb-4 last:border-0 last:pb-0" data-testid={`review-${review.id}`}>
                          <div className="flex items-start gap-3 flex-wrap">
                            <Link href={`/u/${review.user.username || review.user.id}`}>
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={review.user.profileImageUrl || undefined} alt={displayName} />
                                <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                            </Link>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link 
                                  href={`/u/${review.user.username || review.user.id}`}
                                  className="font-medium text-sm hover:underline"
                                >
                                  {displayName}
                                </Link>
                                <Badge variant="secondary" className="shrink-0">
                                  <Star className="mr-1 h-3 w-3 fill-current" />
                                  {review.rating}/10
                                </Badge>
                                {review.visitedAt && (
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(review.visitedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              {review.note && (
                                <p className="text-sm mt-2 text-muted-foreground">{review.note}</p>
                              )}
                              {review.photos.length > 0 && (
                                <div className="flex gap-2 flex-wrap mt-3">
                                  {review.photos.slice(0, 4).map((photo) => (
                                    <img
                                      key={photo.id}
                                      src={photo.url}
                                      alt="Review photo"
                                      className="h-16 w-16 rounded-md object-cover"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="location" className="pt-4 space-y-4">
                <div className="space-y-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Address</p>
                      <p className="text-sm text-muted-foreground">{place.formattedAddress}</p>
                    </div>
                  </div>
                </div>
                <Button variant="outline" asChild data-testid="button-get-directions">
                  <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Get Directions
                  </a>
                </Button>
              </TabsContent>
            </Tabs>
        </div>
      </div>

      <AddToListDialog
        open={addToListDialogOpen}
        onOpenChange={setAddToListDialogOpen}
        placeId={place.googlePlaceId}
        placeName={place.name}
      />

      <ReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        placeId={place.id}
        placeName={place.name}
        existingReview={myReview}
        onSuccess={() => refetch()}
      />
    </AppShell>
  );
}
