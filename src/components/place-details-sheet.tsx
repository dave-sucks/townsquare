"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { 
  Heart, 
  CheckCircle, 
  Trash2, 
  ExternalLink, 
  List, 
  Star, 
  Plus,
  X,
  ArrowRightFromLine,
  MapPin,
  DollarSign,
  Utensils
} from "lucide-react";
import { PlacePhotoGrid } from "./place-photo-grid";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

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

interface Review {
  id: string;
  rating: number;
  note: string | null;
}

interface Photo {
  id: string;
  url: string;
  width?: number | null;
  height?: number | null;
}

interface FriendSaved {
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

interface PlaceDetailsSheetProps {
  savedPlace: SavedPlace | null;
  myReview?: Review | null;
  photos?: Photo[];
  friendsWhoSaved?: FriendSaved[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onAddToList: () => void;
  onAddReview?: () => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
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

export function PlaceDetailsSheet({
  savedPlace,
  myReview,
  photos = [],
  friendsWhoSaved = [],
  open,
  onOpenChange,
  onToggleStatus,
  onDelete,
  onAddToList,
  onAddReview,
  isUpdating,
  isDeleting,
}: PlaceDetailsSheetProps) {
  if (!savedPlace) return null;

  const place = savedPlace.place;
  const googleMapsUrl = `https://www.google.com/maps/place/?q=place_id:${place.googlePlaceId}`;
  const placeType = formatPlaceType(place.primaryType);
  const priceLevel = formatPriceLevel(place.priceLevel);
  
  const friendsWant = friendsWhoSaved.filter(f => f.status === "WANT");
  const friendsBeen = friendsWhoSaved.filter(f => f.status === "BEEN");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col" data-testid="place-details-sheet">
        <VisuallyHidden>
          <SheetTitle>{place.name}</SheetTitle>
          <SheetDescription>{place.formattedAddress}</SheetDescription>
        </VisuallyHidden>
        
        <div className="flex items-center justify-between gap-2 p-3 border-b flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-sheet"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              asChild
              data-testid="button-expand-sheet"
            >
              <Link href={`/places/${place.googlePlaceId}`}>
                <ArrowRightFromLine className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleStatus}
              disabled={isUpdating}
              data-testid="sheet-button-save"
            >
              {savedPlace.status === "WANT" ? (
                <><Heart className="h-4 w-4 mr-1 fill-current" />Saved</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-1" />Been</>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onAddToList}
              data-testid="sheet-button-add-to-list"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add to trip
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <div>
              <h2 className="text-xl font-semibold" data-testid="sheet-place-name">
                {place.name}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                {myReview && (
                  <>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      <span className="font-medium text-foreground">{myReview.rating}/10</span>
                    </div>
                    <span>·</span>
                  </>
                )}
                <span data-testid="sheet-place-address">{place.formattedAddress}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                {placeType && (
                  <>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Utensils className="h-3 w-3" />
                      <span>{placeType}</span>
                    </div>
                  </>
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
                <TabsTrigger value="friends" data-testid="tab-friends">Friends</TabsTrigger>
                <TabsTrigger value="location" data-testid="tab-location">Location</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="pt-4 space-y-4">
                <div className="space-y-3">
                  <Badge 
                    variant={savedPlace.status === "WANT" ? "secondary" : "default"}
                    data-testid="sheet-badge-status"
                  >
                    {savedPlace.status === "WANT" ? (
                      <><Heart className="mr-1 h-3 w-3" />Want to visit</>
                    ) : (
                      <><CheckCircle className="mr-1 h-3 w-3" />Been there</>
                    )}
                  </Badge>
                  
                  {myReview?.note && (
                    <p className="text-sm text-muted-foreground" data-testid="sheet-review-note">
                      {myReview.note}
                    </p>
                  )}
                </div>

                <Separator />

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onToggleStatus}
                    disabled={isUpdating}
                    data-testid="sheet-button-toggle-status"
                  >
                    {savedPlace.status === "WANT" ? "Mark as Been" : "Mark as Want"}
                  </Button>
                  {!myReview && onAddReview && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onAddReview}
                      data-testid="sheet-button-add-review"
                    >
                      <Star className="mr-1 h-4 w-4" />
                      Add Review
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    asChild 
                    data-testid="sheet-button-open-maps"
                  >
                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1 h-4 w-4" />
                      Google Maps
                    </a>
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="friends" className="pt-4">
                {friendsWhoSaved.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-friends">
                    None of your friends have saved this place yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {friendsBeen.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Been here</p>
                        <div className="space-y-2">
                          {friendsBeen.map((friend) => {
                            const displayName = friend.user.firstName
                              ? `${friend.user.firstName}${friend.user.lastName ? ` ${friend.user.lastName}` : ""}`
                              : friend.user.username || "User";
                            return (
                              <Link
                                key={friend.id}
                                href={`/u/${friend.user.username || friend.user.id}`}
                                className="flex items-center gap-2 p-2 rounded-md hover-elevate flex-wrap"
                                data-testid={`friend-${friend.id}`}
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
                        <div className="space-y-2">
                          {friendsWant.map((friend) => {
                            const displayName = friend.user.firstName
                              ? `${friend.user.firstName}${friend.user.lastName ? ` ${friend.user.lastName}` : ""}`
                              : friend.user.username || "User";
                            return (
                              <Link
                                key={friend.id}
                                href={`/u/${friend.user.username || friend.user.id}`}
                                className="flex items-center gap-2 p-2 rounded-md hover-elevate flex-wrap"
                                data-testid={`friend-${friend.id}`}
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
                )}
              </TabsContent>

              <TabsContent value="location" className="pt-4 space-y-4">
                <div className="flex items-start gap-3 flex-wrap">
                  <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Address</p>
                    <p className="text-sm text-muted-foreground">{place.formattedAddress}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild data-testid="button-get-directions">
                  <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 h-4 w-4" />
                    Get Directions
                  </a>
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <div className="border-t p-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={isDeleting}
            className="text-destructive hover:text-destructive w-full"
            data-testid="sheet-button-delete"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Remove from saved
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
