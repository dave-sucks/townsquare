"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HugeiconsIcon } from "@hugeicons/react";
import { Bookmark01Icon, Tick01Icon, PlusSignIcon, Loading03Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { EmojiPickerPopover } from "./emoji-picker-popover";

interface Place {
  id?: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  primaryType?: string | null;
  types?: string[] | null;
  priceLevel?: string | null;
  photoRefs?: string[] | null;
}

interface SavedPlace {
  id: string;
  placeId: string;
  hasBeen: boolean;
  rating: number | null;
}

interface ListData {
  id: string;
  name: string;
  isSystem?: boolean;
  systemSlug?: string | null;
  _count?: {
    listPlaces: number;
  };
}

export interface SaveToListDropdownHandle {
  triggerSave: () => void;
}

interface SaveToListDropdownProps {
  place: Place;
  savedPlace?: SavedPlace | null;
  listsContainingPlace?: string[];
  onSaveSuccess?: () => void;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
  showLabel?: boolean;
  className?: string;
  emoji?: string | null;
  onEmojiChange?: (emoji: string | null) => void;
}

const RATING_OPTIONS = [
  { value: 1, emoji: "👎", label: "ehh" },
  { value: 3, emoji: "👍", label: "liked" },
  { value: 5, emoji: "🔥", label: "loved" },
];

export const SaveToListDropdown = forwardRef<SaveToListDropdownHandle, SaveToListDropdownProps>(function SaveToListDropdown({
  place,
  savedPlace,
  listsContainingPlace = [],
  onSaveSuccess,
  variant = "outline",
  size = "sm",
  showLabel = true,
  className,
  emoji: externalEmoji,
  onEmojiChange,
}, ref) {
  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [optimisticLists, setOptimisticLists] = useState<string[]>(listsContainingPlace);
  const [optimisticSave, setOptimisticSave] = useState<SavedPlace | null>(null);
  const [optimisticUnsaved, setOptimisticUnsaved] = useState(false);
  const [localEmoji, setLocalEmoji] = useState<string | null>(externalEmoji ?? null);
  const isMobile = useIsMobile();

  useEffect(() => {
    setOptimisticLists(listsContainingPlace);
  }, [listsContainingPlace]);

  useEffect(() => {
    if (savedPlace && !savedPlace.id.startsWith("temp-")) {
      setOptimisticSave(null);
      setOptimisticUnsaved(false);
    }
  }, [savedPlace?.id, savedPlace?.hasBeen, savedPlace?.rating]);

  useEffect(() => {
    setLocalEmoji(externalEmoji ?? null);
  }, [externalEmoji]);

  const [pendingListIds, setPendingListIds] = useState<Set<string>>(new Set());

  const effectiveSavedPlace = optimisticUnsaved ? null : (optimisticSave || savedPlace);
  const isSaved = !!effectiveSavedPlace;
  const hasBeen = effectiveSavedPlace?.hasBeen ?? false;
  const currentRating = effectiveSavedPlace?.rating ?? null;

  const invalidatePlaceData = () => {
    queryClient.invalidateQueries({ queryKey: ["saved-places"] });
    queryClient.invalidateQueries({ queryKey: ["place-detail"] });
    queryClient.invalidateQueries({ queryKey: ["collections"] });
    queryClient.invalidateQueries({ queryKey: ["list"] });
    queryClient.invalidateQueries({ queryKey: ["user"] });
  };

  const invalidateListMembership = () => {
    queryClient.invalidateQueries({ queryKey: ["lists"] });
    queryClient.invalidateQueries({ queryKey: ["list"] });
    queryClient.invalidateQueries({ queryKey: ["saved-places"] });
  };

  const patchCachedPlaceData = (updates: { hasBeen?: boolean; rating?: number | null }) => {
    queryClient.setQueryData<{ savedPlaces: any[] }>(["saved-places"], (old) => {
      if (!old?.savedPlaces) return old;
      return {
        ...old,
        savedPlaces: old.savedPlaces.map((sp: any) =>
          sp.place?.googlePlaceId === place.googlePlaceId
            ? { ...sp, hasBeen: updates.hasBeen ?? sp.hasBeen, rating: updates.rating !== undefined ? updates.rating : sp.rating }
            : sp
        ),
      };
    });

    const patchCurrentUserPlaceData = (old: any) => {
      if (!old?.currentUserPlaceData) return old;
      const placeId = effectiveSavedPlace?.placeId || place.id;
      if (!placeId || !old.currentUserPlaceData[placeId]) return old;
      return {
        ...old,
        currentUserPlaceData: {
          ...old.currentUserPlaceData,
          [placeId]: {
            ...old.currentUserPlaceData[placeId],
            hasBeen: updates.hasBeen ?? old.currentUserPlaceData[placeId].hasBeen,
            rating: updates.rating !== undefined ? updates.rating : old.currentUserPlaceData[placeId].rating,
          },
        },
      };
    };

    queryClient.getQueriesData({ queryKey: ["collections"] }).forEach(([key]) => {
      queryClient.setQueryData(key, patchCurrentUserPlaceData);
    });
    queryClient.getQueriesData({ queryKey: ["list"] }).forEach(([key]) => {
      queryClient.setQueryData(key, patchCurrentUserPlaceData);
    });
    queryClient.getQueriesData({ queryKey: ["user"] }).forEach(([key]) => {
      queryClient.setQueryData(key, patchCurrentUserPlaceData);
    });
  };

  const { data: listsData, isLoading: listsLoading } = useQuery<{ lists: ListData[] }>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("/api/lists"),
    enabled: open,
  });

  const lists = listsData?.lists || [];

  const { data: savedPlacesData } = useQuery<{ savedPlaces: any[] }>({
    queryKey: ["saved-places"],
    queryFn: () => apiRequest("/api/saved-places"),
    enabled: false,
  });

  useEffect(() => {
    if (!open || listsContainingPlace.length > 0) return;
    const cached = savedPlacesData?.savedPlaces;
    if (!cached) return;
    const match = cached.find((sp: any) => sp.place?.googlePlaceId === place.googlePlaceId);
    if (match?.lists) {
      setOptimisticLists(match.lists.map((l: any) => l.id));
    }
  }, [open, savedPlacesData, place.googlePlaceId, listsContainingPlace.length]);

  const openAfterSaveRef = useRef(false);

  const savePlaceMutation = useMutation({
    mutationFn: async (vars: { hasBeen?: boolean; rating?: number }) => {
      const payload: Record<string, any> = {
        googlePlaceId: place.googlePlaceId,
        name: place.name,
        formattedAddress: place.formattedAddress,
        hasBeen: vars.hasBeen ?? false,
        rating: vars.rating,
      };
      if (place.lat && place.lng) {
        payload.lat = place.lat;
        payload.lng = place.lng;
      }
      if (place.primaryType) payload.primaryType = place.primaryType;
      if (place.types) payload.types = place.types;
      if (place.priceLevel) payload.priceLevel = place.priceLevel;
      if (place.photoRefs) payload.photoRefs = place.photoRefs;
      return apiRequest("/api/saved-places", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onMutate: async (vars: { hasBeen?: boolean; rating?: number }) => {
      const { hasBeen: hb, rating: r } = vars;
      const tempId = `temp-${Date.now()}`;
      setOptimisticSave({
        id: tempId,
        placeId: place.id || tempId,
        hasBeen: hb ?? false,
        rating: r ?? null,
      });
      if (openAfterSaveRef.current) {
        openAfterSaveRef.current = false;
        setTimeout(() => setOpen(true), 50);
      }
    },
    onSuccess: (data: any) => {
      const sp = data?.savedPlace;
      if (sp) {
        setOptimisticSave({ id: sp.id, placeId: sp.placeId, hasBeen: sp.hasBeen, rating: sp.rating });
      }
      invalidatePlaceData();
      onSaveSuccess?.();
    },
    onError: (error: Error) => {
      openAfterSaveRef.current = false;
      setOptimisticSave(null);
      toast.error(error.message || "Failed to save place");
    },
  });

  const updateSavedPlaceMutation = useMutation({
    mutationFn: async ({ id, hasBeen, rating }: { id: string; hasBeen?: boolean; rating?: number }) => {
      return apiRequest(`/api/saved-places/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ hasBeen, rating }),
      });
    },
    onMutate: async ({ hasBeen: hb, rating: r }) => {
      const newHasBeen = hb ?? effectiveSavedPlace?.hasBeen ?? false;
      const newRating = hb === false ? null : (r ?? effectiveSavedPlace?.rating ?? null);
      setOptimisticSave({
        id: effectiveSavedPlace?.id || "",
        placeId: effectiveSavedPlace?.placeId || "",
        hasBeen: newHasBeen,
        rating: newRating,
      });
      patchCachedPlaceData({ hasBeen: newHasBeen, rating: newRating });
    },
    onSuccess: (data: any) => {
      const sp = data?.savedPlace;
      if (sp) {
        setOptimisticSave({ id: sp.id, placeId: sp.placeId, hasBeen: sp.hasBeen, rating: sp.rating });
      }
      invalidatePlaceData();
      onSaveSuccess?.();
    },
    onError: (error: Error) => {
      setOptimisticSave(null);
      toast.error(error.message || "Failed to update");
    },
  });

  const addToListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const placeId = place.id || effectiveSavedPlace?.placeId;
      if (!placeId) {
        throw new Error("Place must be saved first");
      }
      return apiRequest(`/api/lists/${listId}/places`, {
        method: "POST",
        body: JSON.stringify({ placeId }),
      });
    },
    onMutate: async (listId: string) => {
      setOptimisticLists(prev => [...prev, listId]);
      setPendingListIds(prev => new Set(prev).add(listId));
    },
    onSuccess: (_data: any, listId: string) => {
      setPendingListIds(prev => { const next = new Set(prev); next.delete(listId); return next; });
      invalidateListMembership();
      onSaveSuccess?.();
    },
    onError: (error: Error, listId: string) => {
      setPendingListIds(prev => { const next = new Set(prev); next.delete(listId); return next; });
      setOptimisticLists(prev => prev.filter(id => id !== listId));
      toast.error(error.message || "Failed to add to list");
    },
  });

  const removeFromListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const placeId = place.id || effectiveSavedPlace?.placeId;
      return apiRequest(`/api/lists/${listId}/places`, {
        method: "DELETE",
        body: JSON.stringify({ placeId }),
      });
    },
    onMutate: async (listId: string) => {
      setOptimisticLists(prev => prev.filter(id => id !== listId));
      setPendingListIds(prev => new Set(prev).add(listId));
    },
    onSuccess: (_data: any, listId: string) => {
      setPendingListIds(prev => { const next = new Set(prev); next.delete(listId); return next; });
      invalidateListMembership();
      onSaveSuccess?.();
    },
    onError: (error: Error, listId: string) => {
      setPendingListIds(prev => { const next = new Set(prev); next.delete(listId); return next; });
      setOptimisticLists(prev => [...prev, listId]);
      toast.error(error.message || "Failed to remove from list");
    },
  });

  const createListMutation = useMutation({
    mutationFn: async (name: string) => {
      const result = await apiRequest("/api/lists", {
        method: "POST",
        body: JSON.stringify({ name }),
      }) as { list: { id: string } };
      return result.list.id;
    },
    onSuccess: async (listId: string) => {
      await queryClient.invalidateQueries({ queryKey: ["lists"] });
      addToListMutation.mutate(listId);
      setShowCreateDialog(false);
      setNewListName("");
    },
    onSettled: () => {
      invalidateListMembership();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create list");
    },
  });

  const handleButtonClick = () => {
    if (!isSaved) {
      openAfterSaveRef.current = true;
      savePlaceMutation.mutate({ hasBeen: false });
    }
  };

  useImperativeHandle(ref, () => ({
    triggerSave: handleButtonClick,
  }));

  const handleRatingSelect = (rating: number) => {
    if (!isSaved) {
      savePlaceMutation.mutate({ hasBeen: true, rating });
    } else {
      const id = effectiveSavedPlace?.id;
      if (!id || id.startsWith("temp-")) return;
      const newHasBeen = currentRating === rating && hasBeen ? false : true;
      const newRating = currentRating === rating && hasBeen ? undefined : rating;
      updateSavedPlaceMutation.mutate({ id, hasBeen: newHasBeen, rating: newRating });
    }
  };

  const handleListToggle = (listId: string) => {
    if (effectiveSavedPlace?.id?.startsWith("temp-")) return;
    const isInList = optimisticLists.includes(listId);
    if (isInList) {
      removeFromListMutation.mutate(listId);
    } else {
      addToListMutation.mutate(listId);
    }
  };

  const handleCreateList = () => {
    if (!newListName.trim()) {
      toast.error("List name is required");
      return;
    }
    createListMutation.mutate(newListName.trim());
  };

  const isSaving = savePlaceMutation.isPending && !isSaved;
  const isPending = isSaving || updateSavedPlaceMutation.isPending;

  const unsavePlaceMutation = useMutation({
    mutationFn: async (idToDelete: string) => {
      return apiRequest(`/api/saved-places/${idToDelete}`, {
        method: "DELETE",
      });
    },
    onMutate: () => {
      setOptimisticUnsaved(true);
      setOptimisticSave(null);
      setOpen(false);
    },
    onSuccess: () => {
      invalidatePlaceData();
      invalidateListMembership();
      toast.success("Removed from saved places");
      onSaveSuccess?.();
    },
    onError: (error: Error) => {
      setOptimisticUnsaved(false);
      toast.error(error.message || "Failed to remove");
    },
  });

  const handleUnsave = () => {
    const idToDelete = effectiveSavedPlace?.id;
    if (!idToDelete) return;
    unsavePlaceMutation.mutate(idToDelete);
  };

  const updateEmojiMutation = useMutation({
    mutationFn: async (emoji: string | null) => {
      const targetId = effectiveSavedPlace?.id;
      if (!targetId || targetId.startsWith("temp-")) return;
      return apiRequest(`/api/saved-places/${targetId}`, {
        method: "PATCH",
        body: JSON.stringify({ emoji }),
      });
    },
    onSuccess: () => {
      invalidatePlaceData();
    },
  });

  const handleEmojiSelect = (emoji: string | null) => {
    setLocalEmoji(emoji);
    if (onEmojiChange) {
      onEmojiChange(emoji);
    } else {
      updateEmojiMutation.mutate(emoji);
    }
  };

  const triggerButton = (
    <Button
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={(e) => {
        if (!isSaved) {
          e.preventDefault();
          e.stopPropagation();
          handleButtonClick();
        }
      }}
      disabled={isPending}
      data-testid="button-save-to-list"
    >
      {isPending ? (
        <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
      ) : isSaved ? (
        <HugeiconsIcon icon={Bookmark01Icon} className="h-4 w-4 fill-current" />
      ) : (
        <HugeiconsIcon icon={Bookmark01Icon} className="h-4 w-4" />
      )}
      {showLabel && (
        <span className="ml-1">{isSaved ? "Saved" : "Save"}</span>
      )}
    </Button>
  );

  const panelContent = (
    <div data-testid="save-panel">
      <div className="flex items-start gap-3 p-4 pb-3">
        <EmojiPickerPopover
          emoji={localEmoji}
          onEmojiSelect={handleEmojiSelect}
          disabled={!isSaved || updateEmojiMutation.isPending}
          variant="area"
          testId="save-panel-emoji-picker"
          portalContainer={isMobile ? "drawer" : "drawer"}
        />
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-lg leading-tight truncate" data-testid="text-save-panel-name">
              {place.name}
            </p>
            {isSaved && (
              <Badge variant="secondary" className="shrink-0 text-xs" data-testid="badge-saved">
                Saved
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {place.formattedAddress}
          </p>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Been here?</p>
          <ToggleGroup
            type="single"
            value={hasBeen && currentRating ? String(currentRating) : ""}
            onValueChange={(value) => {
              if (value) {
                handleRatingSelect(Number(value));
              } else if (hasBeen && effectiveSavedPlace?.id && !effectiveSavedPlace.id.startsWith("temp-")) {
                updateSavedPlaceMutation.mutate({ id: effectiveSavedPlace.id, hasBeen: false, rating: undefined });
              }
            }}
            variant="outline"
            className="w-full"
          >
            {RATING_OPTIONS.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={String(option.value)}
                disabled={savePlaceMutation.isPending || updateSavedPlaceMutation.isPending}
                data-testid={`rating-button-${option.value}`}
                className="flex-1 gap-1.5 py-3"
              >
                <span className="text-xl">{option.emoji}</span>
                <span className="text-sm">{option.label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Lists</p>
          {listsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : lists.length === 0 ? (
            <p className="text-sm text-muted-foreground py-1">No lists yet</p>
          ) : (
            <div className="space-y-0.5">
              {lists.map((list) => {
                const isInList = optimisticLists.includes(list.id);
                return (
                  <button
                    key={list.id}
                    className="flex items-center gap-3 w-full text-left py-3 px-2 rounded-md hover-elevate transition-colors"
                    onClick={() => {
                      if (isSaved) {
                        handleListToggle(list.id);
                      }
                    }}
                    disabled={!isSaved || pendingListIds.has(list.id)}
                    data-testid={`list-checkbox-${list.id}`}
                  >
                    <span className="flex-1 text-base font-medium truncate">{list.name}</span>
                    {isInList && <HugeiconsIcon icon={Tick01Icon} className="h-5 w-5 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          <button
            className="flex items-center gap-3 w-full text-left py-3 px-2 rounded-md hover-elevate text-muted-foreground transition-colors"
            onClick={() => {
              if (isSaved) {
                setOpen(false);
                setTimeout(() => setShowCreateDialog(true), 150);
              }
            }}
            disabled={!isSaved}
            data-testid="button-add-new-list"
          >
            <HugeiconsIcon icon={PlusSignIcon} className="h-5 w-5" />
            <span className="text-base font-medium">Create new list</span>
          </button>
        </div>

        <div className="border-t pt-2">
          <button
            className="flex items-center gap-3 w-full text-left py-3 px-2 rounded-md hover-elevate text-muted-foreground hover:text-destructive transition-colors"
            onClick={handleUnsave}
            disabled={unsavePlaceMutation.isPending || !isSaved}
            data-testid="button-unsave"
          >
            <HugeiconsIcon icon={Delete02Icon} className="h-5 w-5" />
            <span className="text-base font-medium">Remove from saved</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isMobile ? (
        <>
          <div onClick={(e) => {
            if (isSaved) {
              e.preventDefault();
              e.stopPropagation();
              setOpen(true);
            }
          }}>
            {triggerButton}
          </div>
          <Drawer open={open} onOpenChange={(o) => {
            if (!isSaved) return;
            setOpen(o);
          }}>
            <DrawerContent data-testid="save-drawer">
              <DrawerTitle className="sr-only">Save Place</DrawerTitle>
              {panelContent}
            </DrawerContent>
          </Drawer>
        </>
      ) : (
        <Popover open={open} onOpenChange={(o) => {
          if (!isSaved) return;
          setOpen(o);
        }}>
          <PopoverTrigger asChild>
            {triggerButton}
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="top"
            className="w-80 p-0 z-[200]"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => {
              const target = e.target as HTMLElement;
              if (target?.closest?.("[data-testid='emoji-picker-container']") ||
                  target?.closest?.("[data-radix-popper-content-wrapper]")) {
                e.preventDefault();
              }
            }}
            onInteractOutside={(e) => {
              const target = e.target as HTMLElement;
              if (target?.closest?.("[data-testid='emoji-picker-container']") ||
                  target?.closest?.("[data-radix-popper-content-wrapper]")) {
                e.preventDefault();
              }
            }}
          >
            {panelContent}
          </PopoverContent>
        </Popover>
      )}

      <Dialog open={showCreateDialog} onOpenChange={(o) => { setShowCreateDialog(o); if (!o) setNewListName(""); }}>
        <DialogContent className="z-[300]">
          <DialogHeader>
            <DialogTitle>Create new list</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="List name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateList();
              }
            }}
            autoFocus
            style={{ fontSize: "16px" }}
            data-testid="input-new-list-name-dialog"
          />
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="ghost"
              className="flex-1 py-3 text-base"
              onClick={() => {
                setShowCreateDialog(false);
                setNewListName("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 py-3 text-base"
              onClick={handleCreateList}
              disabled={createListMutation.isPending || !newListName.trim()}
              data-testid="button-create-list-dialog"
            >
              {createListMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
