"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Image as ImageIcon } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface Photo {
  id: string;
  url: string;
  width?: number | null;
  height?: number | null;
}

interface PlacePhotoGridProps {
  photos: Photo[];
  maxDisplay?: number;
}

export function PlacePhotoGrid({ photos, maxDisplay = 5 }: PlacePhotoGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-muted rounded-lg h-48"
        data-testid="photo-grid-empty"
      >
        <div className="text-center text-muted-foreground">
          <ImageIcon className="mx-auto h-8 w-8 mb-2" />
          <p className="text-sm">No photos available</p>
        </div>
      </div>
    );
  }

  const displayPhotos = photos.slice(0, maxDisplay);
  const remainingCount = photos.length - maxDisplay;

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
      <div className="grid grid-cols-4 grid-rows-2 gap-1 h-64 rounded-lg" data-testid="photo-grid">
        {displayPhotos.length >= 1 && (
          <button
            type="button"
            className="col-span-2 row-span-2 relative overflow-hidden rounded-l-lg"
            onClick={() => openLightbox(0)}
            data-testid="photo-grid-main"
          >
            <img
              src={displayPhotos[0].url}
              alt="Main photo"
              className="h-full w-full object-cover"
            />
          </button>
        )}
        {displayPhotos.slice(1, 5).map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            className="relative overflow-hidden"
            onClick={() => openLightbox(index + 1)}
            data-testid={`photo-grid-${index + 1}`}
          >
            <img
              src={photo.url}
              alt={`Photo ${index + 2}`}
              className="h-full w-full object-cover"
            />
            {index === 3 && remainingCount > 0 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  +{remainingCount} more
                </span>
              </div>
            )}
          </button>
        ))}
        {displayPhotos.length === 1 && (
          <>
            <div className="col-span-2 row-span-2 bg-muted" />
          </>
        )}
        {displayPhotos.length === 2 && (
          <>
            <div className="bg-muted" />
            <div className="bg-muted" />
            <div className="bg-muted" />
          </>
        )}
        {displayPhotos.length === 3 && (
          <>
            <div className="bg-muted" />
            <div className="bg-muted" />
          </>
        )}
        {displayPhotos.length === 4 && (
          <div className="bg-muted" />
        )}
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
                className="absolute right-2 top-2 bg-black/50 text-white"
                onClick={closeLightbox}
                data-testid="button-close-lightbox"
              >
                <X className="h-4 w-4" />
              </Button>
              {photos.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white"
                    onClick={goToPrevious}
                    data-testid="button-previous-photo"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white"
                    onClick={goToNext}
                    data-testid="button-next-photo"
                  >
                    <ChevronRight className="h-6 w-6" />
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
