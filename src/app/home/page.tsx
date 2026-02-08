"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserMultiple02Icon, Location01Icon } from "@hugeicons/core-free-icons";
import { apiRequest } from "@/lib/query-client";
import { AppShell, PageHeader } from "@/components/layout";
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
  userId: string | null;
}

interface SocialPost {
  author: string;
  authorImage?: string | null;
  caption?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  likes?: number | null;
  postedAt?: string | null;
  permalink?: string | null;
  source?: 'instagram' | 'tiktok' | 'manual' | string | null;
}

interface Activity {
  id: string;
  actorId: string;
  type: "PLACE_SAVED" | "PLACE_MARKED_BEEN" | "PLACE_ADDED_TO_LIST" | "LIST_CREATED" | "REVIEW_CREATED";
  placeId: string | null;
  listId: string | null;
  metadata: { placeName?: string; listName?: string; rating?: number; note?: string; review_preview?: string } | null;
  createdAt: string;
  actor: ActivityActor;
  place: ActivityPlace | null;
  list: ActivityList | null;
  socialPost?: SocialPost | null;
}

interface FeedResponse {
  activities: Activity[];
  nextCursor: string | null;
  hasMore: boolean;
  hasFollowing: boolean;
}

function FeedList({ filter }: { filter: "all" | "following" }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);

  const { data, isLoading, isFetching } = useQuery<FeedResponse>({
    queryKey: ["feed", filter, cursor],
    queryFn: () => apiRequest(`/api/feed?filter=${filter}${cursor ? `&cursor=${cursor}` : ""}`),
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

  useEffect(() => {
    setCursor(null);
    setAllActivities([]);
  }, [filter]);

  if (isLoading && !allActivities.length) {
    return (
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
    );
  }

  if (allActivities.length === 0) {
    if (filter === "following") {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <HugeiconsIcon icon={UserMultiple02Icon} className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="font-medium">Nothing here yet</p>
          <p className="text-sm text-muted-foreground mt-1 text-center max-w-xs">
            {data?.hasFollowing
              ? "People you follow haven't posted yet"
              : "Follow people to see their activity here"}
          </p>
          {!data?.hasFollowing && (
            <Button asChild className="mt-4" data-testid="button-find-people-following">
              <Link href="/people">Find People</Link>
            </Button>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <HugeiconsIcon icon={UserMultiple02Icon} className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="font-medium">No activity yet</p>
        <p className="text-sm text-muted-foreground mt-1 text-center max-w-xs">
          Save places and leave reviews to see activity here
        </p>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" asChild data-testid="button-go-map-all">
            <Link href="/">
              <HugeiconsIcon icon={Location01Icon} className="mr-1.5 h-4 w-4" />
              Map
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {allActivities.map((activity) => {
          const hasSocial = !!activity.socialPost?.permalink;
          return (
            <div key={activity.id} className={hasSocial ? "overflow-hidden" : "border rounded-lg overflow-hidden"}>
              <FeedPost activity={activity} />
            </div>
          );
        })}
      </div>

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
    </>
  );
}

export default function HomePage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, router]);

  if (!isAuthenticated && !authLoading) {
    return null;
  }

  return (
    <AppShell user={user}>
      <PageHeader title="Feed" />
      <div className="flex-1 overflow-auto max-w-xl mx-auto w-full pb-20 md:pb-0">
        <div className="px-4 pt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="justify-start flex-wrap gap-1" data-testid="feed-tabs">
              <TabsTrigger value="all" data-testid="feed-tab-all">All</TabsTrigger>
              <TabsTrigger value="following" data-testid="feed-tab-following">Following</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-4">
              {authLoading ? (
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
              ) : (
                <FeedList filter="all" />
              )}
            </TabsContent>
            <TabsContent value="following" className="mt-4">
              {authLoading ? (
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
              ) : (
                <FeedList filter="following" />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  );
}
