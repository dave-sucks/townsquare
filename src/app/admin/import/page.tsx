"use client";

import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell, PageHeader } from "@/components/layout";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Loading03Icon,
  CheckmarkCircle01Icon,
  AlertCircleIcon,
  ArrowRight01Icon,
  RefreshIcon,
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
  statusBreakdown?: Record<string, number>;
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
  status: string;
  error: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    queued: "secondary",
    running: "default",
    completed: "default",
    failed: "destructive",
    new: "outline",
    processed: "default",
    unresolved: "secondary",
  };
  return (
    <Badge variant={variants[status] || "outline"} data-testid={`badge-status-${status}`}>
      {status}
    </Badge>
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
              <HugeiconsIcon icon={Loading03Icon} className="mr-2 h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            "Start Import"
          )}
        </Button>
        {startImport.isError && (
          <p className="text-sm text-destructive" data-testid="text-import-error">
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
          <StatusBadge status={job.status} />
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
          <span>Fetched: {job.postsFetched}</span>
          <span>Processed: {job.postsProcessed}</span>
          <span>Reviews: {job.reviewsCreated}</span>
          {job.postsUnresolved > 0 && (
            <Badge variant="secondary">{job.postsUnresolved} unresolved</Badge>
          )}
          {job.postsFailed > 0 && (
            <Badge variant="destructive">{job.postsFailed} failed</Badge>
          )}
        </div>
        {job.error && (
          <p className="text-xs text-destructive mt-2 truncate">{job.error}</p>
        )}
      </CardContent>
    </Card>
  );
}

function JobDetail({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [resolveDialogPost, setResolveDialogPost] = useState<IngestedPost | null>(null);
  const [placeSearchQuery, setPlaceSearchQuery] = useState("");
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
        `/api/admin/import/jobs/${jobId}/posts${selectedTab !== "all" ? `?status=${selectedTab}` : ""}`
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/import/jobs", jobId] });
    },
  });

  const placeSearch = useQuery<{ results: Array<{ place_id: string; name: string; formatted_address: string }> }>({
    queryKey: ["/api/places/search", placeSearchQuery],
    queryFn: () => apiRequest(`/api/places/search?query=${encodeURIComponent(placeSearchQuery)}`),
    enabled: placeSearchQuery.length > 2,
  });

  const resolveMutation = useMutation({
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
      setResolveDialogPost(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/import/jobs", jobId] });
    },
  });

  const job = jobQuery.data;
  const posts = postsQuery.data?.posts || [];

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} data-testid="button-back">
        Back to Jobs
      </Button>

      {job && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="font-medium text-lg" data-testid="text-job-input">
                  {job.input}
                </p>
                <p className="text-sm text-muted-foreground">
                  Created: {new Date(job.createdAt).toLocaleString()}
                </p>
              </div>
              <StatusBadge status={job.status} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
              <div className="text-center">
                <p className="text-2xl font-bold" data-testid="text-posts-fetched">
                  {job.postsFetched}
                </p>
                <p className="text-xs text-muted-foreground">Fetched</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold" data-testid="text-posts-processed">
                  {job.postsProcessed}
                </p>
                <p className="text-xs text-muted-foreground">Processed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold" data-testid="text-reviews-created">
                  {job.reviewsCreated}
                </p>
                <p className="text-xs text-muted-foreground">Reviews</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-500" data-testid="text-posts-unresolved">
                  {job.postsUnresolved}
                </p>
                <p className="text-xs text-muted-foreground">Unresolved</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive" data-testid="text-posts-failed">
                  {job.postsFailed}
                </p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
            {job.postsFailed > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => retryMutation.mutate()}
                disabled={retryMutation.isPending}
                data-testid="button-retry-failed"
              >
                <HugeiconsIcon icon={RefreshIcon} className="mr-1 h-3 w-3" />
                Retry Failed
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          <TabsTrigger value="processed" data-testid="tab-processed">Processed</TabsTrigger>
          <TabsTrigger value="unresolved" data-testid="tab-unresolved">Unresolved</TabsTrigger>
          <TabsTrigger value="failed" data-testid="tab-failed">Failed</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-4">
          {postsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading posts...</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No posts in this category
            </p>
          ) : (
            <div className="space-y-2">
              {posts.map((post) => (
                <Card key={post.id} data-testid={`card-post-${post.id}`}>
                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      {post.media && (post.media as any[]).length > 0 && (
                        <img
                          src={(post.media as any[])[0].url}
                          alt=""
                          className="h-16 w-16 rounded-md object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">@{post.authorHandle}</span>
                          <StatusBadge status={post.status} />
                        </div>
                        {post.caption && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {post.caption}
                          </p>
                        )}
                        {post.resolveCandidates && (post.resolveCandidates as any[]).length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-medium">Candidates:</p>
                            {(post.resolveCandidates as any[]).map((c: any, i: number) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 text-xs text-muted-foreground"
                              >
                                <span className="truncate flex-1">{c.name} - {c.address}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {Math.round(c.score * 100)}%
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    resolveMutation.mutate({
                                      postId: post.id,
                                      googlePlaceId: c.googlePlaceId,
                                    });
                                  }}
                                  data-testid={`button-resolve-candidate-${i}`}
                                >
                                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        {post.error && (
                          <p className="text-xs text-destructive mt-1">{post.error}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        {post.status === "unresolved" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setResolveDialogPost(post);
                              setPlaceSearchQuery("");
                            }}
                            data-testid={`button-resolve-${post.id}`}
                          >
                            Resolve
                          </Button>
                        )}
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          View Post
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!resolveDialogPost}
        onOpenChange={(open) => !open && setResolveDialogPost(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Post to Place</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {resolveDialogPost?.caption && (
              <p className="text-sm text-muted-foreground line-clamp-3">
                {resolveDialogPost.caption}
              </p>
            )}
            <div className="space-y-2">
              <Label>Search for a place</Label>
              <Input
                placeholder="Search Google Places..."
                value={placeSearchQuery}
                onChange={(e) => setPlaceSearchQuery(e.target.value)}
                data-testid="input-place-search"
              />
            </div>
            {placeSearch.data?.results && (
              <div className="max-h-60 overflow-y-auto space-y-1">
                {placeSearch.data.results.map((place: any) => (
                  <div
                    key={place.place_id}
                    className="flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                    onClick={() => {
                      if (resolveDialogPost) {
                        resolveMutation.mutate({
                          postId: resolveDialogPost.id,
                          googlePlaceId: place.place_id,
                        });
                      }
                    }}
                    data-testid={`place-result-${place.place_id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{place.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {place.formatted_address}
                      </p>
                    </div>
                    <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResolveDialogPost(null)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

  return (
    <AppShell user={user}>
      <PageHeader title="Import Manager" />
      <div className="flex-1 overflow-auto p-4 max-w-4xl mx-auto w-full pb-20 md:pb-4">
        {selectedJobId ? (
          <JobDetail
            jobId={selectedJobId}
            onBack={() => setSelectedJobId(null)}
          />
        ) : (
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
        )}
      </div>
    </AppShell>
  );
}
