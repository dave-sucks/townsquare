"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon, Upload04Icon, Cancel01Icon, Loading03Icon } from "@hugeicons/core-free-icons";

const reviewSchema = z.object({
  rating: z.number().int().min(0).max(10),
  note: z.string().optional(),
  visitedAt: z.string().optional(),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface Review {
  id: string;
  userId: string | null;
  placeId: string;
  rating: number;
  note: string | null;
  visitedAt: string | null;
  createdAt: string;
  updatedAt: string;
  photos?: Photo[];
}

interface Photo {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeId: string;
  placeName: string;
  existingReview?: Review | null;
  onSuccess?: () => void;
}

export function ReviewDialog({
  open,
  onOpenChange,
  placeId,
  placeName,
  existingReview,
  onSuccess,
}: ReviewDialogProps) {
  const isEditing = !!existingReview;
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: existingReview?.rating ?? 5,
      note: existingReview?.note ?? "",
      visitedAt: existingReview?.visitedAt
        ? new Date(existingReview.visitedAt).toISOString().split("T")[0]
        : "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ReviewFormData) => {
      const review = await apiRequest<Review>("/api/reviews", {
        method: "POST",
        body: JSON.stringify({
          placeId,
          rating: data.rating,
          note: data.note || null,
          visitedAt: data.visitedAt ? new Date(data.visitedAt).toISOString() : null,
        }),
      });

      for (const url of uploadedPhotos) {
        await apiRequest("/api/photos", {
          method: "POST",
          body: JSON.stringify({
            placeId,
            reviewId: review.id,
            url,
          }),
        });
      }

      return review;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["place-detail"] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "my-reviews" });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      toast.success("Review created!");
      setUploadedPhotos([]);
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create review");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ReviewFormData) => {
      const review = await apiRequest<Review>(`/api/reviews/${existingReview!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          rating: data.rating,
          note: data.note || null,
          visitedAt: data.visitedAt ? new Date(data.visitedAt).toISOString() : null,
        }),
      });

      for (const url of uploadedPhotos) {
        await apiRequest("/api/photos", {
          method: "POST",
          body: JSON.stringify({
            placeId,
            reviewId: review.id,
            url,
          }),
        });
      }

      return review;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["place-detail"] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "my-reviews" });
      toast.success("Review updated!");
      setUploadedPhotos([]);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update review");
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const urlResponse = await apiRequest<{ uploadURL: string; objectPath: string }>(
        "/api/uploads/request-url",
        {
          method: "POST",
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type,
          }),
        }
      );

      await fetch(urlResponse.uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      setUploadedPhotos((prev) => [...prev, urlResponse.objectPath]);
      toast.success("Photo uploaded!");
    } catch (error) {
      toast.error("Failed to upload photo");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const removeUploadedPhoto = (url: string) => {
    setUploadedPhotos((prev) => prev.filter((p) => p !== url));
  };

  const onSubmit = (data: ReviewFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const rating = form.watch("rating");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="dialog-review-title">
            {isEditing ? "Edit Review" : "Add Review"}
          </DialogTitle>
          <DialogDescription>{placeName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rating">Rating: {rating}/10</Label>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={StarIcon} className="h-4 w-4 text-yellow-500" />
              <Slider
                id="rating"
                min={0}
                max={10}
                step={1}
                value={[rating]}
                onValueChange={([value]) => form.setValue("rating", value)}
                className="flex-1"
                data-testid="slider-rating"
              />
              <span className="w-8 text-center font-medium">{rating}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visitedAt">Date Visited (optional)</Label>
            <Input
              id="visitedAt"
              type="date"
              {...form.register("visitedAt")}
              data-testid="input-visited-at"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              placeholder="Share your experience..."
              rows={3}
              {...form.register("note")}
              data-testid="textarea-note"
            />
          </div>

          <div className="space-y-2">
            <Label>Photos (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {uploadedPhotos.map((url) => (
                <div key={url} className="relative">
                  <img
                    src={url}
                    alt="Uploaded"
                    className="h-16 w-16 rounded-md object-cover"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute -right-2 -top-2 h-5 w-5"
                    onClick={() => removeUploadedPhoto(url)}
                    data-testid={`button-remove-photo-${url}`}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {existingReview?.photos?.map((photo) => (
                <div key={photo.id} className="relative">
                  <img
                    src={photo.url}
                    alt="Existing"
                    className="h-16 w-16 rounded-md object-cover"
                  />
                </div>
              ))}
            </div>
            <div>
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
                id="photo-upload"
                data-testid="input-photo-upload"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("photo-upload")?.click()}
                disabled={isUploading}
                data-testid="button-upload-photo"
              >
                {isUploading ? (
                  <HugeiconsIcon icon={Loading03Icon} className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <HugeiconsIcon icon={Upload04Icon} className="mr-2 h-4 w-4" />
                )}
                {isUploading ? "Uploading..." : "Upload Photo"}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-review">
              {isPending ? (
                <HugeiconsIcon icon={Loading03Icon} className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isEditing ? "Update Review" : "Submit Review"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
