"use client";

import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Heart, CheckCircle, MapPin, List as ListIcon, Lock, Globe, User, UserPlus, UserMinus, Loader2, Star } from "lucide-react";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell, PageHeader, ContentContainer } from "@/components/layout";

interface User {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface Place {
  id: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
}

interface SavedPlace {
  id: string;
  placeId: string;
  status: "WANT" | "BEEN";
  createdAt: string;
  place: Place;
}

interface ListData {
  id: string;
  name: string;
  visibility: "PRIVATE" | "PUBLIC";
  _count: {
    listPlaces: number;
  };
}

interface ReviewData {
  id: string;
  rating: number;
  note: string | null;
  visitedAt: string | null;
  createdAt: string;
  place: Place;
}

interface ProfileData {
  user: User;
  isOwnProfile: boolean;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  wantPlaces: SavedPlace[];
  beenPlaces: SavedPlace[];
  lists: ListData[];
  reviews: ReviewData[];
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-6 items-start">
        <Skeleton className="h-20 w-20 rounded-full shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

function PlaceCard({ place, status, testId }: { place: Place; status: "WANT" | "BEEN"; testId: string }) {
  return (
    <Link href={`/places/${place.googlePlaceId}`} data-testid={testId}>
      <Card className="hover-elevate cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{place.name}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{place.formattedAddress}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            {status === "WANT" ? (
              <Badge variant="secondary" className="text-xs">
                <Heart className="mr-1 h-3 w-3" />
                Want
              </Badge>
            ) : (
              <Badge className="text-xs">
                <CheckCircle className="mr-1 h-3 w-3" />
                Been
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ReviewCard({ review, testId }: { review: ReviewData; testId: string }) {
  return (
    <Link href={`/places/${review.place.googlePlaceId}`} data-testid={testId}>
      <Card className="hover-elevate cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Star className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{review.place.name}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{review.place.formattedAddress}</p>
            </div>
          </div>
          {review.note && (
            <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{review.note}</p>
          )}
          <div className="mt-3 flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">
              <Star className="mr-1 h-3 w-3 fill-current" />
              {review.rating}/10
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ListCard({ list, testId }: { list: ListData; testId: string }) {
  return (
    <Link href={`/lists/${list.id}`} data-testid={testId}>
      <Card className="hover-elevate cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
              <ListIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{list.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{list._count.listPlaces} places</p>
            </div>
            {list.visibility === "PRIVATE" ? (
              <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: typeof Heart; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { isAuthenticated, user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<ProfileData>({
    queryKey: ["user-profile", username],
    queryFn: () => apiRequest(`/api/users/${username}`),
    enabled: isAuthenticated,
  });

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("/api/follows", {
        method: "POST",
        body: JSON.stringify({ followingId: userId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", username] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("/api/follows", {
        method: "DELETE",
        body: JSON.stringify({ followingId: userId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", username] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const profileUser = data?.user;
  const isOwnProfile = data?.isOwnProfile || false;
  const isFollowing = data?.isFollowing || false;
  const followerCount = data?.followerCount || 0;
  const followingCount = data?.followingCount || 0;
  const wantPlaces = data?.wantPlaces || [];
  const beenPlaces = data?.beenPlaces || [];
  const lists = data?.lists || [];
  const reviews = data?.reviews || [];

  const isFollowLoading = followMutation.isPending || unfollowMutation.isPending;

  const handleFollow = () => {
    if (!profileUser) return;
    if (isFollowing) {
      unfollowMutation.mutate(profileUser.id);
    } else {
      followMutation.mutate(profileUser.id);
    }
  };

  const displayName = profileUser?.firstName 
    ? `${profileUser.firstName}${profileUser.lastName ? ` ${profileUser.lastName}` : ""}`
    : profileUser?.username || username;
  
  const handle = profileUser?.username || username;

  const content = !isAuthenticated ? (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <User className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-lg font-medium">Please sign in</p>
      <p className="text-sm text-muted-foreground mt-1">Sign in to view profiles</p>
      <Button asChild className="mt-4">
        <Link href="/">Go to Home</Link>
      </Button>
    </div>
  ) : isLoading ? (
    <ProfileSkeleton />
  ) : error || !profileUser ? (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <User className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-lg font-medium">User not found</p>
      <p className="text-sm text-muted-foreground mt-1">This profile doesn't exist</p>
      <Button asChild className="mt-4">
        <Link href="/people">Browse People</Link>
      </Button>
    </div>
  ) : (
    <div className="space-y-6">
      <div className="flex gap-5 items-start">
        <Avatar className="h-20 w-20 border-2 border-border shrink-0">
          <AvatarImage src={profileUser.profileImageUrl || undefined} alt={displayName} />
          <AvatarFallback className="text-2xl font-medium">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate" data-testid="text-user-name">{displayName}</h1>
              <p className="text-sm text-muted-foreground" data-testid="text-username">@{handle}</p>
            </div>
            
            {isOwnProfile ? (
              <Button variant="outline" size="sm" disabled data-testid="button-edit-profile">
                Edit Profile
              </Button>
            ) : (
              <Button
                variant={isFollowing ? "outline" : "default"}
                size="sm"
                onClick={handleFollow}
                disabled={isFollowLoading}
                data-testid="button-follow"
              >
                {isFollowLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isFollowing ? (
                  <><UserMinus className="mr-1.5 h-4 w-4" />Following</>
                ) : (
                  <><UserPlus className="mr-1.5 h-4 w-4" />Follow</>
                )}
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-4 mt-3 text-sm">
            <button className="hover:underline" data-testid="text-following">
              <span className="font-semibold">{followingCount}</span>
              <span className="text-muted-foreground ml-1">following</span>
            </button>
            <button className="hover:underline" data-testid="text-followers">
              <span className="font-semibold">{followerCount}</span>
              <span className="text-muted-foreground ml-1">{followerCount === 1 ? "follower" : "followers"}</span>
            </button>
          </div>
        </div>
      </div>

      <Separator />

      <Tabs defaultValue="places" className="w-full">
        <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 gap-6">
          <TabsTrigger 
            value="places" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-0 pb-3"
            data-testid="tab-places"
          >
            <MapPin className="mr-1.5 h-4 w-4" />
            Places
            <span className="ml-1.5 text-muted-foreground">{wantPlaces.length + beenPlaces.length}</span>
          </TabsTrigger>
          <TabsTrigger 
            value="reviews"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-0 pb-3"
            data-testid="tab-reviews"
          >
            <Star className="mr-1.5 h-4 w-4" />
            Reviews
            <span className="ml-1.5 text-muted-foreground">{reviews.length}</span>
          </TabsTrigger>
          <TabsTrigger 
            value="lists"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-0 pb-3"
            data-testid="tab-lists"
          >
            <ListIcon className="mr-1.5 h-4 w-4" />
            Lists
            <span className="ml-1.5 text-muted-foreground">{lists.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="places" className="mt-6">
          {wantPlaces.length === 0 && beenPlaces.length === 0 ? (
            <EmptyState 
              icon={MapPin}
              title="No places saved"
              subtitle={isOwnProfile ? "Start saving places you want to visit" : "This user hasn't saved any places yet"}
            />
          ) : (
            <div className="space-y-6">
              {wantPlaces.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Heart className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-muted-foreground">Want to visit</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {wantPlaces.map((savedPlace) => (
                      <PlaceCard 
                        key={savedPlace.id} 
                        place={savedPlace.place} 
                        status="WANT"
                        testId={`want-place-${savedPlace.id}`}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {beenPlaces.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-muted-foreground">Been there</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {beenPlaces.map((savedPlace) => (
                      <PlaceCard 
                        key={savedPlace.id} 
                        place={savedPlace.place} 
                        status="BEEN"
                        testId={`been-place-${savedPlace.id}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          {reviews.length === 0 ? (
            <EmptyState 
              icon={Star}
              title="No reviews yet"
              subtitle={isOwnProfile ? "Share your experiences by reviewing places" : "This user hasn't reviewed any places yet"}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {reviews.map((review) => (
                <ReviewCard 
                  key={review.id} 
                  review={review}
                  testId={`review-${review.id}`}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="lists" className="mt-6">
          {lists.length === 0 ? (
            <EmptyState 
              icon={ListIcon}
              title="No lists yet"
              subtitle={isOwnProfile ? "Create lists to organize your places" : "This user hasn't created any public lists yet"}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {lists.map((list) => (
                <ListCard 
                  key={list.id} 
                  list={list}
                  testId={`list-${list.id}`}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <AppShell user={currentUser}>
      <PageHeader backHref={isOwnProfile ? "/" : "/people"} />
      <ContentContainer maxWidth="md">{content}</ContentContainer>
    </AppShell>
  );
}
