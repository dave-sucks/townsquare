"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface Photo {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

interface PhotoGalleryProps {
  photos: Photo[];
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="text-no-photos">
        No photos yet
      </p>
    );
  }

  const openLightbox = (index: number) => setSelectedIndex(index);
  const closeLightbox = () => setSelectedIndex(null);
  const goToPrevious = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + photos.length) % photos.length);
    }
  };
  const goToNext = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % photos.length);
    }
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            className="aspect-square overflow-hidden rounded-md hover:opacity-80 transition-opacity"
            onClick={() => openLightbox(index)}
            data-testid={`photo-thumbnail-${photo.id}`}
          >
            <img
              src={photo.url}
              alt={`Photo ${index + 1}`}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      <Dialog open={selectedIndex !== null} onOpenChange={closeLightbox}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <VisuallyHidden>
            <DialogTitle>Photo Viewer</DialogTitle>
          </VisuallyHidden>
          {selectedIndex !== null && (
            <div className="relative">
              <img
                src={photos[selectedIndex].url}
                alt={`Photo ${selectedIndex + 1}`}
                className="max-h-[80vh] w-full object-contain"
                data-testid="lightbox-image"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 bg-black/50 text-white hover:bg-black/70"
                onClick={closeLightbox}
                data-testid="button-close-lightbox"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
              </Button>
              {photos.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                    onClick={goToPrevious}
                    data-testid="button-previous-photo"
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                    onClick={goToNext}
                    data-testid="button-next-photo"
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} className="h-6 w-6" />
                  </Button>
                </>
              )}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
                {selectedIndex + 1} / {photos.length}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
