"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell, PageHeader } from "@/components/layout";
import { SocialPostCard } from "@/components/shared/social-post-card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Loading03Icon,
  CheckmarkCircle01Icon,
  ArrowRight01Icon,
  Search01Icon,
  Cancel01Icon,
  PlusSignIcon,
  HelpCircleIcon,
} from "@hugeicons/core-free-icons";

interface ImportJob {
  id: string;
  platform: string;
  type: string;
  input: string;
  maxPosts: number;
  status: string;
  postsFetched: number;
  postsProcessed: number;
  reviewsCreated: number;
  postsUnresolved: number;
  postsFailed: number;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface IngestedPost {
  id: string;
  canonicalPostId: string;
  url: string;
  authorHandle: string;
  caption: string | null;
  postedAt: string | null;
  likeCount: number | null;
  media: Array<{ url: string; type: string }> | null;
  resolvedGooglePlaceId: string | null;
  resolveMethod: string | null;
  resolveConfidence: number | null;
  resolveCandidates: Array<{
    googlePlaceId: string;
    name: string;
    address: string;
    score: number;
  }> | null;
  resolvedPlace: { name: string; formattedAddress: string } | null;
  status: string;
  error: string | null;
}

interface SelectedPlace {
  placeId: string;
  name: string;
  address: string;
}

function StatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    processed: "bg-emerald-500",
    completed: "bg-emerald-500",
    running: "bg-blue-500",
    unresolved: "bg-amber-500",
    failed: "bg-red-500",
    pending: "bg-stone-400",
    queued: "bg-stone-400",
    new: "bg-stone-400",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colorMap[status] || "bg-stone-400"}`}
      data-testid={`dot-status-${status}`}
    />
  );
}

function ImportPanel() {
  const queryClient = useQueryClient();
  const [profileUrl, setProfileUrl] = useState("");
  const [maxPosts, setMaxPosts] = useState("100");

  const startImport = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/import/instagram/profile", {
        method: "POST",
        body: JSON.stringify({
          profileUrl,
          maxPosts: parseInt(maxPosts),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/import/jobs"] });
      setProfileUrl("");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Instagram Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="profile-url">Instagram Profile URL</Label>
          <Input
            id="profile-url"
            placeholder="https://www.instagram.com/brotherlyburgers/"
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            data-testid="input-profile-url"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max-posts">Max Posts</Label>
          <Select value={maxPosts} onValueChange={setMaxPosts}>
            <SelectTrigger data-testid="select-max-posts">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => startImport.mutate()}
          disabled={!profileUrl.trim() || startImport.isPending}
          className="w-full"
          data-testid="button-start-import"
        >
          {startImport.isPending ? (
            <>
              <HugeiconsIcon
                icon={Loading03Icon}
                className="mr-2 h-4 w-4 animate-spin"
              />
              Starting...
            </>
          ) : (
            "Start Import"
          )}
        </Button>
        {startImport.isError && (
          <p
            className="text-sm text-destructive"
            data-testid="text-import-error"
          >
            {(startImport.error as Error).message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function JobCard({ job, onSelect }: { job: ImportJob; onSelect: () => void }) {
  const handle = job.input.match(/instagram\.com\/([^/?]+)/)?.[1] || job.input;
  return (
    <Card
      className="hover-elevate cursor-pointer"
      onClick={onSelect}
      data-testid={`card-job-${job.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">@{handle}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(job.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={job.status} />
            <span className="text-sm">{job.status}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
          <span>Fetched: {job.postsFetched}</span>
          <span>Processed: {job.postsProcessed}</span>
          <span>Reviews: {job.reviewsCreated}</span>
          {job.postsUnresolved > 0 && (
            <span className="text-amber-600">
              {job.postsUnresolved} unresolved
            </span>
          )}
          {job.postsFailed > 0 && (
            <span className="text-red-600">{job.postsFailed} failed</span>
          )}
        </div>
        {job.error && (
          <p className="text-xs text-destructive mt-2 truncate">{job.error}</p>
        )}
      </CardContent>
    </Card>
  );
}

function usePlaceSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    Array<{ place_id: string; main_text: string; secondary_text: string }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q || q.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/places/search?q=${encodeURIComponent(q)}`,
        );
        const data = await res.json();
        const predictions = data.predictions || [];
        setResults(
          predictions.map((p: any) => ({
            place_id: p.place_id,
            main_text:
              p.structured_formatting?.main_text || p.description || "",
            secondary_text: p.structured_formatting?.secondary_text || "",
          })),
        );
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const reset = useCallback(() => {
    setQuery("");
    setResults([]);
    setIsSearching(false);
  }, []);

  return { query, results, isSearching, search, reset };
}

function AddPlacesPanel({
  postId,
  onResolved,
  onClose,
}: {
  postId: string;
  onResolved: () => void;
  onClose: () => void;
}) {
  const [selectedPlaces, setSelectedPlaces] = useState<SelectedPlace[]>([]);
  const { query, results, isSearching, search, reset } = usePlaceSearch();

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (selectedPlaces.length === 0) return;
      return apiRequest(`/api/admin/import/posts/${postId}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          googlePlaceIds: selectedPlaces.map((p) => p.placeId),
          confidence: 1.0,
        }),
      });
    },
    onSuccess: () => {
      setSelectedPlaces([]);
      reset();
      onClose();
      onResolved();
    },
  });

  const addPlace = (place: {
    place_id: string;
    main_text: string;
    secondary_text: string;
  }) => {
    if (selectedPlaces.some((p) => p.placeId === place.place_id)) return;
    setSelectedPlaces((prev) => [
      ...prev,
      {
        placeId: place.place_id,
        name: place.main_text,
        address: place.secondary_text,
      },
    ]);
    search("");
  };

  const removePlace = (placeId: string) => {
    setSelectedPlaces((prev) => prev.filter((p) => p.placeId !== placeId));
  };

  return (
    <div className="space-y-3 pt-2" data-testid={`resolve-inline-${postId}`}>
      <div className="relative">
        <HugeiconsIcon
          icon={Search01Icon}
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
        />
        <Input
          placeholder="Search for a place..."
          value={query}
          onChange={(e) => search(e.target.value)}
          className="pl-9"
          autoFocus
          data-testid="input-place-search"
        />
        {query && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={() => search("")}
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              className="h-4 w-4 text-muted-foreground"
            />
          </button>
        )}
      </div>

      {isSearching && (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <HugeiconsIcon
            icon={Loading03Icon}
            className="h-4 w-4 animate-spin"
          />
          Searching...
        </div>
      )}

      {!isSearching && results.length > 0 && (
        <div className="max-h-52 overflow-y-auto border rounded-md divide-y bg-background">
          {results.map((place) => {
            const alreadyAdded = selectedPlaces.some(
              (p) => p.placeId === place.place_id,
            );
            return (
              <div
                key={place.place_id}
                className={`flex items-center gap-2 px-3 py-2.5 ${alreadyAdded ? "opacity-40" : "hover:bg-muted/50 cursor-pointer"}`}
                onClick={() => !alreadyAdded && addPlace(place)}
                data-testid={`place-result-${place.place_id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {place.main_text}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {place.secondary_text}
                  </p>
                </div>
                {alreadyAdded ? (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    Added
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-xs text-primary flex-shrink-0">
                    <HugeiconsIcon icon={PlusSignIcon} className="h-3 w-3" />
                    Add
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isSearching && query.length >= 2 && results.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          No results
        </p>
      )}

      {selectedPlaces.length > 0 && (
        <div className="space-y-1">
          {selectedPlaces.map((place) => (
            <div
              key={place.placeId}
              className="flex items-center gap-2 py-2 border-b last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{place.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {place.address}
                </p>
              </div>
              <button
                className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removePlace(place.placeId)}
                data-testid={`button-remove-place-${place.placeId}`}
              >
                <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedPlaces([]);
            reset();
            onClose();
          }}
          data-testid="button-cancel-resolve"
        >
          Cancel
        </Button>
        {selectedPlaces.length > 0 && (
          <Button
            size="sm"
            onClick={() => resolveMutation.mutate()}
            disabled={resolveMutation.isPending}
            data-testid="button-submit-resolve"
          >
            {resolveMutation.isPending ? (
              <HugeiconsIcon
                icon={Loading03Icon}
                className="h-4 w-4 animate-spin"
              />
            ) : (
              `Save ${selectedPlaces.length} Place${selectedPlaces.length !== 1 ? "s" : ""}`
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function FeedPostItem({
  post,
  onResolved,
  onQuickResolve,
  isQuickResolving,
}: {
  post: IngestedPost;
  onResolved: () => void;
  onQuickResolve: (googlePlaceId: string) => void;
  isQuickResolving: boolean;
}) {
  const [addingPlaces, setAddingPlaces] = useState(false);
  const candidates =
    (post.resolveCandidates as Array<{
      googlePlaceId: string;
      name: string;
      address: string;
      score: number;
    }>) || [];
  const hasResolved = !!post.resolvedPlace;
  const hasCandidates = candidates.length > 0;
  const hasLocations = hasResolved || hasCandidates;

  return (
    <article className="flex flex-col p-4 bg-muted/50 rounded-lg" data-testid={`card-post-${post.id}`}>
      <div className="flex items-center gap-2 px-0 py-3">
        <StatusDot status={post.status} />
        <span className="text-lg">{post.status}</span>
        {post.resolveMethod && (
          <Badge variant="outline" className="text-xs">
            {post.resolveMethod}
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-0 px-0 pb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold uppercase text-muted-foreground">Locations</p>
          {post.status === "unresolved" && !addingPlaces && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddingPlaces(true)}
              data-testid={`button-resolve-${post.id}`}
            >
              Add Places
            </Button>
          )}
          {post.status !== "unresolved" && !addingPlaces && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddingPlaces(true)}
              data-testid={`button-add-more-${post.id}`}
            >
              Add Places
            </Button>
          )}
        </div>

        {hasResolved && (
          <div className="py-2.5 border-t">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{post.resolvedPlace!.name}</p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {post.resolveConfidence != null && (
                  <span className="text-xs text-muted-foreground">
                    {Math.round(post.resolveConfidence * 100)}%
                  </span>
                )}
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  className="h-4 w-4 text-emerald-500"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {post.resolvedPlace!.formattedAddress}
            </p>
          </div>
        )}

        {!hasResolved &&
          candidates.map((c, i) => (
            <div key={i} className="py-2.5 border-b last:border-b-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{c.name}</p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {Math.round(c.score * 100)}%
                  </span>
                  <button
                    className="text-muted-foreground hover:text-primary disabled:opacity-50"
                    disabled={isQuickResolving}
                    onClick={() => onQuickResolve(c.googlePlaceId)}
                    data-testid={`button-resolve-candidate-${i}`}
                  >
                    <HugeiconsIcon icon={HelpCircleIcon} className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.address}
              </p>
            </div>
          ))}

        {!hasResolved && !hasCandidates && !addingPlaces && (
          <p className="text-sm text-muted-foreground py-2">No locations yet</p>
        )}

        {addingPlaces && (
          <AddPlacesPanel
            postId={post.id}
            onResolved={onResolved}
            onClose={() => setAddingPlaces(false)}
          />
        )}
      </div>

      {post.error && (
        <div className="px-4 pb-3">
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded">
            {post.error}
          </p>
        </div>
      )}

      <SocialPostCard
        author={post.authorHandle}
        caption={post.caption}
        mediaUrl={post.media?.[0]?.url || null}
        mediaType={post.media?.[0]?.type || null}
        likes={post.likeCount}
        postedAt={post.postedAt}
        permalink={post.url}
        source="instagram"
      />
    </article>
  );
}

function JobDetail({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("all");

  const jobQuery = useQuery<ImportJob>({
    queryKey: ["/api/admin/import/jobs", jobId],
    queryFn: () => apiRequest(`/api/admin/import/jobs/${jobId}`),
    refetchInterval: 5000,
  });

  const postsQuery = useQuery<{ posts: IngestedPost[] }>({
    queryKey: ["/api/admin/import/jobs", jobId, "posts", selectedTab],
    queryFn: () =>
      apiRequest(
        `/api/admin/import/jobs/${jobId}/posts${selectedTab !== "all" ? `?status=${selectedTab}` : ""}`,
      ),
    refetchInterval: 10000,
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/admin/import/jobs/${jobId}/retry`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/import/jobs", jobId],
      });
    },
  });

  const quickResolveMutation = useMutation({
    mutationFn: async ({
      postId,
      googlePlaceId,
    }: {
      postId: string;
      googlePlaceId: string;
    }) => {
      return apiRequest(`/api/admin/import/posts/${postId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ googlePlaceId, confidence: 1.0 }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/import/jobs", jobId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/import/jobs", jobId, "posts"],
      });
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/admin/import/jobs", jobId],
    });
    queryClient.invalidateQueries({
      queryKey: ["/api/admin/import/jobs", jobId, "posts"],
    });
  };

  const job = jobQuery.data;
  const posts = postsQuery.data?.posts || [];
  const handle = job?.input.match(/instagram\.com\/([^/?]+)/)?.[1] || "";

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 flex-shrink-0"
            data-testid="button-back"
          >
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="h-4 w-4 rotate-180"
            />
          </Button>
          <div className="flex-1 min-w-0">
            {handle && (
              <p className="font-semibold text-lg" data-testid="text-handle">
                @{handle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={job?.status || "pending"} />
            <span className="text-sm">{job?.status || "loading"}</span>
          </div>
        </div>

        {job && (
          <div className="flex items-center gap-4 mt-1 ml-11 text-xs text-muted-foreground">
            <span>{job.postsFetched} fetched</span>
            <span className="text-emerald-600">
              {job.postsProcessed} processed
            </span>
            <span>{job.reviewsCreated} reviews</span>
            {job.postsUnresolved > 0 && (
              <span className="text-amber-600">
                {job.postsUnresolved} unresolved
              </span>
            )}
            {job.postsFailed > 0 && (
              <span className="text-destructive flex items-center gap-1">
                {job.postsFailed} failed
                <button
                  className="underline"
                  onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending}
                  data-testid="button-retry-failed"
                >
                  retry
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 my-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start pb-2">
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="w-auto">
                <TabsTrigger value="all" data-testid="tab-all">
                  All
                </TabsTrigger>
                <TabsTrigger value="processed" data-testid="tab-processed">
                  Processed
                </TabsTrigger>
                <TabsTrigger value="unresolved" data-testid="tab-unresolved">
                  Unresolved
                </TabsTrigger>
                <TabsTrigger value="failed" data-testid="tab-failed">
                  Failed
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div>
            {postsQuery.isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="h-5 w-5 animate-spin"
                />
                <span>Loading posts...</span>
              </div>
            ) : posts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-16 text-center">
                No posts in this category
              </p>
            ) : (
              <div className="divide-y divide-border space-y-12">
                {posts.map((post) => (
                  <FeedPostItem
                    key={post.id}
                    post={post}
                    onResolved={invalidateAll}
                    onQuickResolve={(googlePlaceId) =>
                      quickResolveMutation.mutate({
                        postId: post.id,
                        googlePlaceId,
                      })
                    }
                    isQuickResolving={quickResolveMutation.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminImportPage() {
  const { user } = useAuth();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const jobsQuery = useQuery<{ jobs: ImportJob[] }>({
    queryKey: ["/api/admin/import/jobs"],
    queryFn: () => apiRequest("/api/admin/import/jobs"),
    refetchInterval: 10000,
  });

  const jobs = jobsQuery.data?.jobs || [];

  if (selectedJobId) {
    return (
      <AppShell user={user}>
        <JobDetail
          jobId={selectedJobId}
          onBack={() => setSelectedJobId(null)}
        />
      </AppShell>
    );
  }

  return (
    <AppShell user={user}>
      <PageHeader title="Import Manager" />
      <div className="flex-1 overflow-auto p-4 max-w-4xl mx-auto w-full pb-20 md:pb-4">
        <div className="space-y-6">
          <ImportPanel />
          <Separator />
          <div>
            <h2 className="text-lg font-medium mb-3">Import Jobs</h2>
            {jobsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No imports yet. Start one above.
              </p>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onSelect={() => setSelectedJobId(job.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
