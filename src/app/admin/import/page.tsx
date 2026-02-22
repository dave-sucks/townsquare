"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
  Search01Icon,
  Cancel01Icon,
  PlusSignIcon,
  Location01Icon,
  Calendar03Icon,
  FavouriteIcon,
  LinkSquare01Icon,
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
  resolvedPlace: { name: string; formattedAddress: string } | null;
  status: string;
  error: string | null;
}

interface SelectedPlace {
  placeId: string;
  name: string;
  address: string;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    pending: { variant: "secondary" },
    queued: { variant: "secondary" },
    running: { variant: "default" },
    completed: { variant: "default" },
    failed: { variant: "destructive" },
    new: { variant: "outline" },
    processed: { variant: "default", className: "bg-emerald-600 hover:bg-emerald-600" },
    unresolved: { variant: "secondary", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  };
  const c = config[status] || { variant: "outline" as const };
  return (
    <Badge variant={c.variant} className={c.className} data-testid={`badge-status-${status}`}>
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

function usePlaceSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ place_id: string; main_text: string; secondary_text: string }>>([]);
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
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const predictions = data.predictions || [];
        setResults(
          predictions.map((p: any) => ({
            place_id: p.place_id,
            main_text: p.structured_formatting?.main_text || p.description || "",
            secondary_text: p.structured_formatting?.secondary_text || "",
          }))
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

function PostCard({
  post,
  onResolve,
  onQuickResolve,
  isResolving,
}: {
  post: IngestedPost;
  onResolve: () => void;
  onQuickResolve: (googlePlaceId: string) => void;
  isResolving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const mediaItems = (post.media as Array<{ url: string; type: string }>) || [];
  const hasMedia = mediaItems.length > 0;
  const candidates = (post.resolveCandidates as Array<{ googlePlaceId: string; name: string; address: string; score: number }>) || [];

  return (
    <Card data-testid={`card-post-${post.id}`} className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex">
          {hasMedia && (
            <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 bg-muted">
              <img
                src={mediaItems[0].url}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0 p-3 sm:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold" data-testid={`text-author-${post.id}`}>
                    @{post.authorHandle}
                  </span>
                  <StatusBadge status={post.status} />
                </div>

                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {post.postedAt && (
                    <span className="flex items-center gap-1">
                      <HugeiconsIcon icon={Calendar03Icon} className="h-3 w-3" />
                      {new Date(post.postedAt).toLocaleDateString()}
                    </span>
                  )}
                  {post.likeCount != null && post.likeCount > 0 && (
                    <span className="flex items-center gap-1">
                      <HugeiconsIcon icon={FavouriteIcon} className="h-3 w-3" />
                      {post.likeCount.toLocaleString()}
                    </span>
                  )}
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`link-post-${post.id}`}
                  >
                    <HugeiconsIcon icon={LinkSquare01Icon} className="h-3 w-3" />
                    View
                  </a>
                </div>
              </div>

              {post.status === "unresolved" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onResolve}
                  data-testid={`button-resolve-${post.id}`}
                >
                  Resolve
                </Button>
              )}
            </div>

            {post.caption && (
              <div className="mt-2">
                <p
                  className={`text-sm text-muted-foreground ${expanded ? "" : "line-clamp-2"}`}
                  onClick={() => setExpanded(!expanded)}
                  data-testid={`text-caption-${post.id}`}
                >
                  {post.caption}
                </p>
                {post.caption.length > 120 && (
                  <button
                    className="text-xs text-primary mt-0.5 hover:underline"
                    onClick={() => setExpanded(!expanded)}
                    data-testid={`button-expand-${post.id}`}
                  >
                    {expanded ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            )}

            {post.resolvedPlace && (
              <div className="mt-2 flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                <HugeiconsIcon icon={Location01Icon} className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 truncate">
                    {post.resolvedPlace.name}
                  </p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate">
                    {post.resolvedPlace.formattedAddress}
                  </p>
                </div>
                {post.resolveMethod && (
                  <Badge variant="outline" className="text-[10px] flex-shrink-0 border-emerald-300 text-emerald-700">
                    {post.resolveMethod}
                  </Badge>
                )}
              </div>
            )}

            {!post.resolvedPlace && candidates.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Candidates:</p>
                {candidates.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-muted/50"
                  >
                    <HugeiconsIcon icon={Location01Icon} className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1">{c.name}</span>
                    <span className="text-muted-foreground truncate max-w-[120px] hidden sm:inline">{c.address}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {Math.round(c.score * 100)}%
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      disabled={isResolving}
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickResolve(c.googlePlaceId);
                      }}
                      data-testid={`button-resolve-candidate-${i}`}
                    >
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {post.error && (
              <p className="text-xs text-destructive mt-2 bg-destructive/10 px-2 py-1 rounded">
                {post.error}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResolveDialog({
  post,
  open,
  onClose,
  onResolved,
  jobId,
}: {
  post: IngestedPost | null;
  open: boolean;
  onClose: () => void;
  onResolved: () => void;
  jobId: string;
}) {
  const [selectedPlaces, setSelectedPlaces] = useState<SelectedPlace[]>([]);
  const { query, results, isSearching, search, reset } = usePlaceSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSelectedPlaces([]);
      reset();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, reset]);

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!post || selectedPlaces.length === 0) return;
      return apiRequest(`/api/admin/import/posts/${post.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          googlePlaceIds: selectedPlaces.map((p) => p.placeId),
          confidence: 1.0,
        }),
      });
    },
    onSuccess: () => {
      onResolved();
      onClose();
    },
  });

  const addPlace = (place: { place_id: string; main_text: string; secondary_text: string }) => {
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve Post to Place(s)</DialogTitle>
        </DialogHeader>

        {post && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">@{post.authorHandle}</span>
                {post.postedAt && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(post.postedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              {post.caption && (
                <p className="text-sm text-muted-foreground line-clamp-4">{post.caption}</p>
              )}
              {post.media && (post.media as any[]).length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {(post.media as any[]).slice(0, 4).map((m: any, i: number) => (
                    <img
                      key={i}
                      src={m.url}
                      alt=""
                      className="h-14 w-14 rounded object-cover flex-shrink-0"
                    />
                  ))}
                </div>
              )}
            </div>

            {selectedPlaces.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Selected Places ({selectedPlaces.length})</Label>
                {selectedPlaces.map((place) => (
                  <div
                    key={place.placeId}
                    className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800"
                  >
                    <HugeiconsIcon icon={Location01Icon} className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{place.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removePlace(place.placeId)}
                      data-testid={`button-remove-place-${place.placeId}`}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Search Google Places</Label>
              <div className="relative">
                <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  placeholder="Search for a place..."
                  value={query}
                  onChange={(e) => search(e.target.value)}
                  className="pl-9"
                  data-testid="input-place-search"
                />
                {query && (
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    onClick={() => search("")}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>

              {isSearching && (
                <div className="flex items-center gap-2 py-3 px-2 text-sm text-muted-foreground">
                  <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
                  Searching...
                </div>
              )}

              {!isSearching && results.length > 0 && (
                <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                  {results.map((place) => {
                    const alreadyAdded = selectedPlaces.some((p) => p.placeId === place.place_id);
                    return (
                      <div
                        key={place.place_id}
                        className={`flex items-center gap-2 px-3 py-2.5 ${alreadyAdded ? "opacity-50" : "hover:bg-muted/50 cursor-pointer"}`}
                        data-testid={`place-result-${place.place_id}`}
                      >
                        <HugeiconsIcon icon={Location01Icon} className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{place.main_text}</p>
                          <p className="text-xs text-muted-foreground truncate">{place.secondary_text}</p>
                        </div>
                        {alreadyAdded ? (
                          <Badge variant="outline" className="text-[10px] flex-shrink-0">Added</Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-shrink-0 h-7 text-xs"
                            onClick={() => addPlace(place)}
                            data-testid={`button-add-place-${place.place_id}`}
                          >
                            <HugeiconsIcon icon={PlusSignIcon} className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!isSearching && query.length >= 2 && results.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-3">No results found</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-resolve">
            Cancel
          </Button>
          <Button
            onClick={() => resolveMutation.mutate()}
            disabled={selectedPlaces.length === 0 || resolveMutation.isPending}
            data-testid="button-submit-resolve"
          >
            {resolveMutation.isPending ? (
              <>
                <HugeiconsIcon icon={Loading03Icon} className="mr-2 h-4 w-4 animate-spin" />
                Resolving...
              </>
            ) : (
              `Resolve to ${selectedPlaces.length} Place${selectedPlaces.length !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JobDetail({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [resolveDialogPost, setResolveDialogPost] = useState<IngestedPost | null>(null);
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

  const quickResolveMutation = useMutation({
    mutationFn: async ({ postId, googlePlaceId }: { postId: string; googlePlaceId: string }) => {
      return apiRequest(`/api/admin/import/posts/${postId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ googlePlaceId, confidence: 1.0 }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/import/jobs", jobId] });
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/import/jobs", jobId] });
  };

  const job = jobQuery.data;
  const posts = postsQuery.data?.posts || [];

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} data-testid="button-back" className="gap-1">
        <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4 rotate-180" />
        Back to Jobs
      </Button>

      {job && (
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="font-semibold text-lg" data-testid="text-job-input">
                  {job.input}
                </p>
                <p className="text-sm text-muted-foreground">
                  Created: {new Date(job.createdAt).toLocaleString()}
                </p>
              </div>
              <StatusBadge status={job.status} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-2xl font-bold" data-testid="text-posts-fetched">
                  {job.postsFetched}
                </p>
                <p className="text-xs text-muted-foreground">Fetched</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-2xl font-bold" data-testid="text-posts-processed">
                  {job.postsProcessed}
                </p>
                <p className="text-xs text-muted-foreground">Processed</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-2xl font-bold" data-testid="text-reviews-created">
                  {job.reviewsCreated}
                </p>
                <p className="text-xs text-muted-foreground">Reviews</p>
              </div>
              <div className="text-center p-2 rounded-md bg-amber-50 dark:bg-amber-950/20">
                <p className="text-2xl font-bold text-amber-600" data-testid="text-posts-unresolved">
                  {job.postsUnresolved}
                </p>
                <p className="text-xs text-muted-foreground">Unresolved</p>
              </div>
              <div className="text-center p-2 rounded-md bg-red-50 dark:bg-red-950/20">
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
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <HugeiconsIcon icon={Loading03Icon} className="h-5 w-5 animate-spin" />
              <span>Loading posts...</span>
            </div>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No posts in this category
            </p>
          ) : (
            <div className="space-y-2">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onResolve={() => setResolveDialogPost(post)}
                  onQuickResolve={(googlePlaceId) =>
                    quickResolveMutation.mutate({ postId: post.id, googlePlaceId })
                  }
                  isResolving={quickResolveMutation.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ResolveDialog
        post={resolveDialogPost}
        open={!!resolveDialogPost}
        onClose={() => setResolveDialogPost(null)}
        onResolved={invalidateAll}
        jobId={jobId}
      />
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
