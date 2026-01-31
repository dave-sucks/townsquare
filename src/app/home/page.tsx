"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, CheckCircle, ListPlus, FolderPlus, MapPin, Users, Star } from "lucide-react";
import { apiRequest } from "@/lib/query-client";
import { AppShell, PageHeader, ContentContainer } from "@/components/layout";

interface ActivityActor {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface ActivityPlace {
  id: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
}

interface ActivityList {
  id: string;
  name: string;
  visibility: string;
  userId: string;
}

interface Activity {
  id: string;
  actorId: string;
  type: "PLACE_SAVED_WANT" | "PLACE_MARKED_BEEN" | "PLACE_ADDED_TO_LIST" | "LIST_CREATED" | "REVIEW_CREATED";
  placeId: string | null;
  listId: string | null;
  metadata: { placeName?: string; listName?: string; rating?: number } | null;
  createdAt: string;
  actor: ActivityActor;
  place: ActivityPlace | null;
  list: ActivityList | null;
}

interface FeedResponse {
  activities: Activity[];
  nextCursor: string | null;
  hasMore: boolean;
}

function getActivityIcon(type: Activity["type"]) {
  switch (type) {
    case "PLACE_SAVED_WANT":
      return <Heart className="h-4 w-4 text-red-500" />;
    case "PLACE_MARKED_BEEN":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "PLACE_ADDED_TO_LIST":
      return <ListPlus className="h-4 w-4 text-blue-500" />;
    case "LIST_CREATED":
      return <FolderPlus className="h-4 w-4 text-purple-500" />;
    case "REVIEW_CREATED":
      return <Star className="h-4 w-4 text-yellow-500" />;
    default:
      return <MapPin className="h-4 w-4" />;
  }
}

function getActivityText(activity: Activity) {
  const placeName = activity.place?.name || activity.metadata?.placeName || "a place";
  const listName = activity.list?.name || activity.metadata?.listName || "a list";

  switch (activity.type) {
    case "PLACE_SAVED_WANT":
      return (
        <>
          wants to visit <span className="font-medium">{placeName}</span>
        </>
      );
    case "PLACE_MARKED_BEEN":
      return (
        <>
          has been to <span className="font-medium">{placeName}</span>
        </>
      );
    case "PLACE_ADDED_TO_LIST":
      return (
        <>
          added <span className="font-medium">{placeName}</span> to{" "}
          <span className="font-medium">{listName}</span>
        </>
      );
    case "LIST_CREATED":
      return (
        <>
          created a new list: <span className="font-medium">{listName}</span>
        </>
      );
    case "REVIEW_CREATED":
      const rating = activity.metadata?.rating;
      return (
        <>
          reviewed <span className="font-medium">{placeName}</span>
          {rating !== undefined && <span className="ml-1">— {rating}/10</span>}
        </>
      );
    default:
      return "did something";
  }
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function ActivityCard({ activity }: { activity: Activity }) {
  const actorName = activity.actor.firstName && activity.actor.lastName
    ? `${activity.actor.firstName} ${activity.actor.lastName}`
    : activity.actor.username || "User";

  return (
    <Card data-testid={`activity-card-${activity.id}`}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start gap-3">
          <Link href={`/u/${activity.actor.username || activity.actor.id}`}>
            <Avatar className="h-10 w-10" data-testid={`activity-avatar-${activity.id}`}>
              <AvatarImage src={activity.actor.profileImageUrl || undefined} alt={actorName} />
              <AvatarFallback>{actorName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {getActivityIcon(activity.type)}
              <p className="text-sm text-foreground">
                <Link
                  href={`/u/${activity.actor.username || activity.actor.id}`}
                  className="font-semibold hover:underline"
                  data-testid={`activity-actor-link-${activity.id}`}
                >
                  {actorName}
                </Link>{" "}
                {getActivityText(activity)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(activity.createdAt)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {activity.place && (
          <Link
            href={`/places/${activity.place.googlePlaceId}`}
            className="block p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
            data-testid={`activity-place-link-${activity.id}`}
          >
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{activity.place.name}</p>
                <p className="text-xs text-muted-foreground truncate">{activity.place.formattedAddress}</p>
              </div>
            </div>
          </Link>
        )}
        {activity.list && !activity.place && (
          <Link
            href={`/lists/${activity.list.id}`}
            className="block p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
            data-testid={`activity-list-link-${activity.id}`}
          >
            <div className="flex items-start gap-2">
              <FolderPlus className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{activity.list.name}</p>
              </div>
            </div>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [cursor, setCursor] = useState<string | null>(null);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, router]);

  const { data, isLoading, isFetching } = useQuery<FeedResponse>({
    queryKey: ["feed", cursor],
    queryFn: () => apiRequest(`/api/feed${cursor ? `?cursor=${cursor}` : ""}`),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (data?.activities) {
      if (cursor) {
        setAllActivities((prev) => [...prev, ...data.activities]);
      } else {
        setAllActivities(data.activities);
      }
    }
  }, [data, cursor]);

  const hasActivity = allActivities.length > 0;

  const content = authLoading || !isAuthenticated ? (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  ) : isLoading && !allActivities.length ? (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  ) : !hasActivity ? (
    <Card className="text-center py-12" data-testid="empty-feed">
      <CardContent>
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">No activity yet</h2>
        <p className="text-muted-foreground mb-4">
          Follow someone or save a place to see activity here.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild data-testid="button-browse-people">
            <Link href="/people">Browse People</Link>
          </Button>
          <Button variant="outline" asChild data-testid="button-go-map">
            <Link href="/">Go to Map</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  ) : (
    <div className="space-y-4">
      {allActivities.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
      {data?.hasMore && (
        <div className="text-center pt-4">
          <Button
            variant="outline"
            onClick={() => setCursor(data.nextCursor)}
            disabled={isFetching}
            data-testid="button-load-more"
          >
            {isFetching ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <AppShell user={user}>
      <PageHeader title="Home" />
      <ContentContainer maxWidth="md">{content}</ContentContainer>
    </AppShell>
  );
}
