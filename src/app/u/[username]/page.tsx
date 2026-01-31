"use client";

import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Heart, CheckCircle, MapPin, List as ListIcon, Lock, Globe, User, Users, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/hooks/use-auth";

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

interface ProfileData {
  user: User;
  isOwnProfile: boolean;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  wantPlaces: SavedPlace[];
  beenPlaces: SavedPlace[];
  lists: ListData[];
}

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { isAuthenticated } = useAuth();
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

  const user = data?.user;
  const isOwnProfile = data?.isOwnProfile || false;
  const isFollowing = data?.isFollowing || false;
  const followerCount = data?.followerCount || 0;
  const followingCount = data?.followingCount || 0;
  const wantPlaces = data?.wantPlaces || [];
  const beenPlaces = data?.beenPlaces || [];
  const lists = data?.lists || [];

  const isFollowLoading = followMutation.isPending || unfollowMutation.isPending;

  const handleFollow = () => {
    if (!user) return;
    if (isFollowing) {
      unfollowMutation.mutate(user.id);
    } else {
      followMutation.mutate(user.id);
    }
  };

  const displayName = user?.firstName 
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : user?.username || "User";

  if (!isAuthenticated) {
    return (
      <div className="container py-8 max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="mb-4 h-12 w-12 text-muted-foreground" />
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
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="container py-8 max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">User not found</p>
            <Button asChild className="mt-4">
              <Link href="/people">Browse People</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-2xl">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href={isOwnProfile ? "/" : "/people"} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {isOwnProfile ? "Back to Map" : "Back to People"}
        </Link>
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.profileImageUrl || undefined} alt={displayName} />
                <AvatarFallback className="text-xl">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-xl" data-testid="text-user-name">{displayName}</CardTitle>
                {user.username && (
                  <CardDescription data-testid="text-username">@{user.username}</CardDescription>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span data-testid="text-followers">{followerCount} followers</span>
                  <span data-testid="text-following">{followingCount} following</span>
                </div>
              </div>
            </div>
            <div>
              {isOwnProfile ? (
                <Button variant="outline" disabled data-testid="button-edit-profile">
                  Edit Profile
                </Button>
              ) : (
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  onClick={handleFollow}
                  disabled={isFollowLoading}
                  data-testid="button-follow"
                >
                  {isFollowLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : isFollowing ? (
                    <UserMinus className="mr-2 h-4 w-4" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  {isFollowing ? "Unfollow" : "Follow"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="want" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="want" data-testid="tab-want">
            <Heart className="mr-1 h-4 w-4" />
            Want ({wantPlaces.length})
          </TabsTrigger>
          <TabsTrigger value="been" data-testid="tab-been">
            <CheckCircle className="mr-1 h-4 w-4" />
            Been ({beenPlaces.length})
          </TabsTrigger>
          <TabsTrigger value="lists" data-testid="tab-lists">
            <ListIcon className="mr-1 h-4 w-4" />
            Lists ({lists.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="want">
          {wantPlaces.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Heart className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">No places yet</p>
                <p className="text-sm text-muted-foreground">
                  {isOwnProfile ? "Add places you want to visit" : "This user hasn't saved any places yet"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {wantPlaces.map((savedPlace) => (
                <Card key={savedPlace.id} data-testid={`want-place-${savedPlace.id}`}>
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">
                          <Link 
                            href={`/places/${savedPlace.place.googlePlaceId}`}
                            className="hover:underline"
                            data-testid={`link-want-place-${savedPlace.id}`}
                          >
                            {savedPlace.place.name}
                          </Link>
                        </CardTitle>
                        <CardDescription className="mt-1 truncate">
                          {savedPlace.place.formattedAddress}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">
                        <Heart className="mr-1 h-3 w-3" />
                        Want
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="been">
          {beenPlaces.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">No places yet</p>
                <p className="text-sm text-muted-foreground">
                  {isOwnProfile ? "Mark places you've visited" : "This user hasn't visited any places yet"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {beenPlaces.map((savedPlace) => (
                <Card key={savedPlace.id} data-testid={`been-place-${savedPlace.id}`}>
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">
                          <Link 
                            href={`/places/${savedPlace.place.googlePlaceId}`}
                            className="hover:underline"
                            data-testid={`link-been-place-${savedPlace.id}`}
                          >
                            {savedPlace.place.name}
                          </Link>
                        </CardTitle>
                        <CardDescription className="mt-1 truncate">
                          {savedPlace.place.formattedAddress}
                        </CardDescription>
                      </div>
                      <Badge>
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Been
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="lists">
          {lists.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ListIcon className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">No lists yet</p>
                <p className="text-sm text-muted-foreground">
                  {isOwnProfile 
                    ? "Create lists to organize your places" 
                    : "This user hasn't created any public lists yet"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {lists.map((list) => (
                <Card key={list.id} data-testid={`list-${list.id}`}>
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">
                          <Link 
                            href={`/lists/${list.id}`}
                            className="hover:underline"
                            data-testid={`link-list-${list.id}`}
                          >
                            {list.name}
                          </Link>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {list._count.listPlaces} places
                        </CardDescription>
                      </div>
                      <Badge variant="outline">
                        {list.visibility === "PRIVATE" ? (
                          <Lock className="h-3 w-3" />
                        ) : (
                          <Globe className="h-3 w-3" />
                        )}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
