"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users } from "lucide-react";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell, PageHeader, ContentContainer } from "@/components/layout";
import { PersonCard } from "@/components/person-card";

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

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-square w-full" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3 mt-2" />
            <Skeleton className="h-8 w-full mt-3" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="font-medium">
        {hasSearch ? "No users found" : "No other users yet"}
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        {hasSearch ? "Try a different search term" : "Be the first to invite friends!"}
      </p>
    </div>
  );
}

export default function PeoplePage() {
  const { isAuthenticated, user } = useAuth();
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

  const handleFollow = (userId: string, isFollowing: boolean) => {
    if (isFollowing) {
      unfollowMutation.mutate(userId);
    } else {
      followMutation.mutate(userId);
    }
  };

  const users = data?.users || [];

  if (!isAuthenticated) {
    return (
      <AppShell user={user}>
        <PageHeader title="People" />
        <ContentContainer maxWidth="lg">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium">Please sign in</p>
            <Button asChild className="mt-4">
              <Link href="/">Go to Home</Link>
            </Button>
          </div>
        </ContentContainer>
      </AppShell>
    );
  }

  return (
    <AppShell user={user}>
      <PageHeader title="People" />

      <ContentContainer maxWidth="lg">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-users"
            />
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : users.length === 0 ? (
          <EmptyState hasSearch={!!debouncedSearch} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((userData) => (
              <PersonCard
                key={userData.id}
                id={userData.id}
                username={userData.username}
                firstName={userData.firstName}
                lastName={userData.lastName}
                profileImageUrl={userData.profileImageUrl}
                isFollowing={userData.isFollowing}
                savedPlacesCount={userData._count.savedPlaces}
                listsCount={userData._count.lists}
                onFollow={() => handleFollow(userData.id, userData.isFollowing)}
                isLoading={loadingUserId === userData.id}
              />
            ))}
          </div>
        )}
      </ContentContainer>
    </AppShell>
  );
}
