"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, MapPin, List as ListIcon, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell, PageHeader, ContentContainer } from "@/components/layout";

interface UserData {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isFollowing: boolean;
  _count: {
    savedPlaces: number;
    lists: number;
  };
}

export default function PeoplePage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading } = useQuery<{ users: UserData[] }>({
    queryKey: ["users", debouncedSearch],
    queryFn: () => apiRequest(`/api/users${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ""}`),
    enabled: isAuthenticated,
  });

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      setLoadingUserId(userId);
      return apiRequest("/api/follows", {
        method: "POST",
        body: JSON.stringify({ followingId: userId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setLoadingUserId(null);
    },
    onError: () => {
      setLoadingUserId(null);
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async (userId: string) => {
      setLoadingUserId(userId);
      return apiRequest("/api/follows", {
        method: "DELETE",
        body: JSON.stringify({ followingId: userId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setLoadingUserId(null);
    },
    onError: () => {
      setLoadingUserId(null);
    },
  });

  const handleFollow = (userId: string, isFollowing: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFollowing) {
      unfollowMutation.mutate(userId);
    } else {
      followMutation.mutate(userId);
    }
  };

  const users = data?.users || [];

  const getDisplayName = (user: UserData) => {
    if (user.firstName) {
      return `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`;
    }
    return user.username || "User";
  };

  const getUserLink = (user: UserData) => {
    return `/u/${user.username || user.id}`;
  };

  const { user } = useAuth();

  const content = !isAuthenticated ? (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Users className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Please sign in</p>
        <Button asChild className="mt-4">
          <Link href="/">Go to Home</Link>
        </Button>
      </CardContent>
    </Card>
  ) : isLoading ? (
    <div className="space-y-3">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  ) : users.length === 0 ? (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Users className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">
          {debouncedSearch ? "No users found" : "No other users yet"}
        </p>
        <p className="text-sm text-muted-foreground">
          {debouncedSearch ? "Try a different search term" : "Be the first to invite friends!"}
        </p>
      </CardContent>
    </Card>
  ) : (
    <div className="space-y-3">
      {users.map((userData) => (
        <Card key={userData.id} className="hover-elevate" data-testid={`user-card-${userData.id}`}>
          <Link href={getUserLink(userData)} data-testid={`link-user-${userData.id}`}>
            <CardHeader className="p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={userData.profileImageUrl || undefined} alt={getDisplayName(userData)} />
                  <AvatarFallback>{getDisplayName(userData).charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate" data-testid={`text-user-name-${userData.id}`}>
                    {getDisplayName(userData)}
                  </CardTitle>
                  {userData.username && (
                    <CardDescription className="truncate" data-testid={`text-username-${userData.id}`}>
                      @{userData.username}
                    </CardDescription>
                  )}
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {userData._count.savedPlaces} places
                    </span>
                    <span className="flex items-center gap-1">
                      <ListIcon className="h-3 w-3" />
                      {userData._count.lists} lists
                    </span>
                  </div>
                </div>
                <Button
                  variant={userData.isFollowing ? "outline" : "default"}
                  size="sm"
                  onClick={(e) => handleFollow(userData.id, userData.isFollowing, e)}
                  disabled={loadingUserId === userData.id}
                  data-testid={`button-follow-${userData.id}`}
                >
                  {loadingUserId === userData.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : userData.isFollowing ? (
                    <>
                      <UserMinus className="mr-1 h-4 w-4" />
                      Unfollow
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-1 h-4 w-4" />
                      Follow
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
          </Link>
        </Card>
      ))}
    </div>
  );

  return (
    <AppShell user={user}>
      <PageHeader title="People" />
      <ContentContainer maxWidth="md">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-users"
          />
        </div>
        {content}
      </ContentContainer>
    </AppShell>
  );
}
