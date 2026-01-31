"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  Users, 
  MapPin, 
  List as ListIcon, 
  UserPlus, 
  UserMinus, 
  Loader2,
  LayoutGrid,
  TableIcon
} from "lucide-react";
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

type ViewMode = "grid" | "table";

function PersonCard({ 
  user, 
  onFollow, 
  isLoading 
}: { 
  user: UserData; 
  onFollow: (e: React.MouseEvent) => void;
  isLoading: boolean;
}) {
  const displayName = user.firstName 
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` 
    : user.username || "User";
  const handle = user.username || user.id;
  const userLink = `/u/${handle}`;

  return (
    <Card className="hover-elevate" data-testid={`card-user-${user.id}`}>
      <Link href={userLink} data-testid={`link-user-${user.id}`}>
        <CardContent className="p-4 flex flex-col items-center text-center">
          <Avatar className="h-16 w-16 mb-3">
            <AvatarImage src={user.profileImageUrl || undefined} alt={displayName} />
            <AvatarFallback className="text-lg">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <h3 className="font-medium truncate w-full" data-testid={`text-name-${user.id}`}>
            {displayName}
          </h3>
          <p className="text-sm text-muted-foreground truncate w-full mb-2" data-testid={`text-handle-${user.id}`}>
            @{handle}
          </p>
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {user._count.savedPlaces}
            </span>
            <span className="flex items-center gap-1">
              <ListIcon className="h-3 w-3" />
              {user._count.lists}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onFollow}
            disabled={isLoading}
            data-testid={`button-follow-${user.id}`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : user.isFollowing ? (
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
        </CardContent>
      </Link>
    </Card>
  );
}

function PersonRow({ 
  user, 
  onFollow, 
  isLoading 
}: { 
  user: UserData; 
  onFollow: (e: React.MouseEvent) => void;
  isLoading: boolean;
}) {
  const displayName = user.firstName 
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` 
    : user.username || "User";
  const handle = user.username || user.id;
  const userLink = `/u/${handle}`;

  return (
    <Link 
      href={userLink} 
      className="flex items-center gap-4 p-3 rounded-md hover-elevate"
      data-testid={`row-user-${user.id}`}
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={user.profileImageUrl || undefined} alt={displayName} />
        <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate" data-testid={`text-name-${user.id}`}>{displayName}</p>
        <p className="text-sm text-muted-foreground truncate" data-testid={`text-handle-${user.id}`}>@{handle}</p>
      </div>
      <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {user._count.savedPlaces}
        </span>
        <span className="flex items-center gap-1">
          <ListIcon className="h-3 w-3" />
          {user._count.lists}
        </span>
      </div>
      <Button
        variant={user.isFollowing ? "outline" : "default"}
        size="sm"
        onClick={onFollow}
        disabled={isLoading}
        data-testid={`button-follow-${user.id}`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : user.isFollowing ? (
          "Unfollow"
        ) : (
          "Follow"
        )}
      </Button>
    </Link>
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
      <p className="text-sm text-muted-foreground">
        {hasSearch ? "Try a different search term" : "Be the first to invite friends!"}
      </p>
    </div>
  );
}

function LoadingSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 flex flex-col items-center">
              <Skeleton className="h-16 w-16 rounded-full mb-3" />
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-3 w-20 mb-3" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function PeoplePage() {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

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

  const content = !isAuthenticated ? (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="font-medium">Please sign in</p>
      <Button asChild className="mt-4">
        <Link href="/">Go to Home</Link>
      </Button>
    </div>
  ) : isLoading ? (
    <LoadingSkeleton viewMode={viewMode} />
  ) : users.length === 0 ? (
    <EmptyState hasSearch={!!debouncedSearch} />
  ) : viewMode === "grid" ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {users.map((userData) => (
        <PersonCard
          key={userData.id}
          user={userData}
          onFollow={(e) => handleFollow(userData.id, userData.isFollowing, e)}
          isLoading={loadingUserId === userData.id}
        />
      ))}
    </div>
  ) : (
    <Card>
      <div className="divide-y">
        {users.map((userData) => (
          <PersonRow
            key={userData.id}
            user={userData}
            onFollow={(e) => handleFollow(userData.id, userData.isFollowing, e)}
            isLoading={loadingUserId === userData.id}
          />
        ))}
      </div>
    </Card>
  );

  return (
    <AppShell user={user}>
      <PageHeader title="People" />
      <ContentContainer maxWidth="lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-users"
            />
          </div>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              data-testid="button-view-grid"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("table")}
              data-testid="button-view-table"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {content}
      </ContentContainer>
    </AppShell>
  );
}
