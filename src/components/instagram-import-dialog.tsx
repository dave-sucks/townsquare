"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import {
  Instagram,
  Loader2,
  MapPin,
  User,
  Image,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface PreviewData {
  instagram_user: {
    username: string;
    profile_pic_url?: string;
    is_verified?: boolean;
    exists_in_db: boolean;
  };
  location: {
    name: string;
    city?: string;
    state?: string;
    address?: string;
    matched_place_id?: string | null;
    confidence: number;
    source: string;
  } | null;
  caption?: string;
  media_type: "image" | "carousel" | "video";
  media_urls: string[];
  thumbnail_url?: string;
  timestamp?: string;
  already_imported: boolean;
}

interface ImportResult {
  import_id: string;
  user: {
    id: string;
    username: string;
    created: boolean;
  };
  place: {
    id: string;
    name: string;
    created: boolean;
  };
  review: {
    id: string;
    rating: number | null;
    note: string;
    instagram_embed_html: string;
    photos: Array<{
      id: string;
      url: string;
      carousel_position: number;
    }>;
  };
}

interface InstagramImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: ImportResult) => void;
}

export function InstagramImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: InstagramImportDialogProps) {
  const [url, setUrl] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const previewQuery = useQuery({
    queryKey: ["instagram-preview", url],
    queryFn: async () => {
      const response = await fetch(
        `/api/instagram/preview?url=${encodeURIComponent(url)}`
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to fetch preview");
      }
      return data.data as PreviewData;
    },
    enabled: showPreview && url.length > 0,
    retry: false,
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest<{ success: boolean; data: ImportResult }>(
        "/api/instagram/import",
        {
          method: "POST",
          body: JSON.stringify({ url }),
        }
      );
      return response;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });

      toast.success(
        `Imported post from @${response.data.user.username} at ${response.data.place.name}`
      );

      setUrl("");
      setShowPreview(false);
      onOpenChange(false);
      onSuccess?.(response.data);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to import Instagram post");
    },
  });

  const handlePreview = () => {
    if (!url.trim()) {
      toast.error("Please enter an Instagram URL");
      return;
    }
    setShowPreview(true);
  };

  const handleImport = () => {
    importMutation.mutate();
  };

  const handleReset = () => {
    setUrl("");
    setShowPreview(false);
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const isValidUrl = url.includes("instagram.com/");
  const isPreviewing = previewQuery.isLoading;
  const hasPreview = previewQuery.data && !previewQuery.isError;
  const isImporting = importMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2"
            data-testid="dialog-instagram-import-title"
          >
            <Instagram className="h-5 w-5" />
            Import from Instagram
          </DialogTitle>
          <DialogDescription>
            Paste an Instagram post URL to import it as a review
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instagram-url">Instagram Post URL</Label>
            <div className="flex gap-2">
              <Input
                id="instagram-url"
                type="url"
                placeholder="https://www.instagram.com/p/..."
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setShowPreview(false);
                }}
                disabled={isImporting}
                data-testid="input-instagram-url"
              />
              {!hasPreview && (
                <Button
                  type="button"
                  onClick={handlePreview}
                  disabled={!isValidUrl || isPreviewing}
                  data-testid="button-preview"
                >
                  {isPreviewing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Preview"
                  )}
                </Button>
              )}
            </div>
          </div>

          {previewQuery.isError && (
            <Card className="border-destructive bg-destructive/10 p-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {previewQuery.error?.message || "Failed to load preview"}
                </span>
              </div>
            </Card>
          )}

          {hasPreview && previewQuery.data && (
            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-medium"
                      data-testid="preview-username"
                    >
                      @{previewQuery.data.instagram_user.username}
                    </span>
                    {previewQuery.data.instagram_user.is_verified && (
                      <Badge variant="secondary">Verified</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {previewQuery.data.instagram_user.exists_in_db
                      ? "User exists in database"
                      : "New user will be created"}
                  </span>
                </div>
                {previewQuery.data.instagram_user.exists_in_db ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Badge variant="outline">New</Badge>
                )}
              </div>

              <Separator />

              {previewQuery.data.location ? (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <span
                      className="font-medium"
                      data-testid="preview-location"
                    >
                      {previewQuery.data.location.name}
                    </span>
                    {(previewQuery.data.location.city ||
                      previewQuery.data.location.state) && (
                      <p className="text-sm text-muted-foreground">
                        {[
                          previewQuery.data.location.city,
                          previewQuery.data.location.state,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {previewQuery.data.location.source.replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(previewQuery.data.location.confidence * 100)}
                        % confidence
                      </span>
                    </div>
                  </div>
                  {previewQuery.data.location.matched_place_id ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Badge variant="outline">New</Badge>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 text-amber-600">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm">
                    No location detected - you may need to specify one
                  </span>
                </div>
              )}

              <Separator />

              <div className="flex items-start gap-3">
                <Image className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm" data-testid="preview-media-count">
                      {previewQuery.data.media_urls.length} image
                      {previewQuery.data.media_urls.length !== 1 ? "s" : ""}
                    </span>
                    {previewQuery.data.media_type === "carousel" && (
                      <Badge variant="secondary">Carousel</Badge>
                    )}
                  </div>
                </div>
              </div>

              {previewQuery.data.thumbnail_url && (
                <div className="flex gap-2 overflow-x-auto py-2">
                  {previewQuery.data.media_urls.slice(0, 4).map((imgUrl, i) => (
                    <img
                      key={i}
                      src={imgUrl || previewQuery.data?.thumbnail_url}
                      alt={`Preview ${i + 1}`}
                      className="h-20 w-20 rounded-md object-cover flex-shrink-0"
                      data-testid={`preview-image-${i}`}
                    />
                  ))}
                  {previewQuery.data.media_urls.length > 4 && (
                    <div className="h-20 w-20 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-sm text-muted-foreground">
                        +{previewQuery.data.media_urls.length - 4}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {previewQuery.data.caption && (
                <>
                  <Separator />
                  <div className="text-sm text-muted-foreground line-clamp-3">
                    {previewQuery.data.caption}
                  </div>
                </>
              )}
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isImporting}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          {hasPreview && (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={handleReset}
                disabled={isImporting}
                data-testid="button-reset"
              >
                Reset
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={isImporting || !previewQuery.data?.location}
                data-testid="button-import"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Import"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
