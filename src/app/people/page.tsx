"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, LayoutGrid, List as ListIcon } from "lucide-react";
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

type ViewMode = "grid" | "list";

export default function PeoplePage() {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
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
        <ContentContainer maxWidth="3xl">
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
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
      <ContentContainer maxWidth="3xl">
        {/* Search and View Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-users"
            />
          </div>
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              data-testid="button-view-grid"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              data-testid="button-view-list"
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="rounded-lg border p-4 flex flex-col items-center">
                  <Skeleton className="h-16 w-16 rounded-full mb-3" />
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-20 mb-2" />
                  <Skeleton className="h-8 w-full mt-2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          )
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium">{debouncedSearch ? "No users found" : "No users yet"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {debouncedSearch ? "Try a different search" : "Invite friends to get started"}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {users.map((u) => (
              <PersonCard
                key={u.id}
                id={u.id}
                username={u.username}
                firstName={u.firstName}
                lastName={u.lastName}
                profileImageUrl={u.profileImageUrl}
                isFollowing={u.isFollowing}
                savedPlacesCount={u._count.savedPlaces}
                listsCount={u._count.lists}
                onFollow={() => handleFollow(u.id, u.isFollowing)}
                isLoading={loadingUserId === u.id}
                variant="grid"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <PersonCard
                key={u.id}
                id={u.id}
                username={u.username}
                firstName={u.firstName}
                lastName={u.lastName}
                profileImageUrl={u.profileImageUrl}
                isFollowing={u.isFollowing}
                savedPlacesCount={u._count.savedPlaces}
                listsCount={u._count.lists}
                onFollow={() => handleFollow(u.id, u.isFollowing)}
                isLoading={loadingUserId === u.id}
                variant="list"
              />
            ))}
          </div>
        )}
      </ContentContainer>
    </AppShell>
  );
}
