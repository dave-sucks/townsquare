"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, MapPin } from "lucide-react";
import { apiRequest } from "@/lib/query-client";
import { AppShell, PageHeader, ContentContainer } from "@/components/layout";
import { FeedPost } from "@/components/feed-post";

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
  photoRefs?: string[] | null;
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
  metadata: { placeName?: string; listName?: string; rating?: number; note?: string } | null;
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

  if (!isAuthenticated && !authLoading) {
    return null;
  }

  return (
    <AppShell user={user}>
      <PageHeader title="Feed" />
      <ContentContainer>
        {authLoading || (isLoading && !allActivities.length) ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border-b">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-32 w-full mt-3 rounded-lg" />
              </div>
            ))}
          </div>
        ) : allActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium">Your feed is empty</p>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-xs">
              Follow people or save places to see activity here
            </p>
            <div className="flex gap-2 mt-4">
              <Button asChild data-testid="button-browse-people">
                <Link href="/people">Find People</Link>
              </Button>
              <Button variant="outline" asChild data-testid="button-go-map">
                <Link href="/">
                  <MapPin className="mr-1.5 h-4 w-4" />
                  Map
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg bg-card divide-y">
            {allActivities.map((activity) => (
              <FeedPost key={activity.id} activity={activity} />
            ))}
          </div>
        )}

        {data?.hasMore && allActivities.length > 0 && (
          <div className="text-center py-4">
            <Button
              variant="outline"
              onClick={() => setCursor(data.nextCursor)}
              disabled={isFetching}
              data-testid="button-load-more"
            >
              {isFetching ? "Loading..." : "Load more"}
            </Button>
          </div>
        )}
      </ContentContainer>
    </AppShell>
  );
}
