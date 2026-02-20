"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HugeiconsIcon } from "@hugeicons/react";
import { Bookmark01Icon, Tick01Icon, PlusSignIcon, Loading03Icon, InformationCircleIcon, Delete02Icon } from "@hugeicons/core-free-icons";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

interface SaveToListDropdownProps {
  place: Place;
  savedPlace?: SavedPlace | null;
  listsContainingPlace?: string[];
  onSaveSuccess?: () => void;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
  showLabel?: boolean;
  className?: string;
}

const RATING_OPTIONS = [
  { value: 1, emoji: "👎", label: "ehh" },
  { value: 3, emoji: "👍", label: "liked" },
  { value: 5, emoji: "🔥", label: "loved" },
];

export function SaveToListDropdown({
  place,
  savedPlace,
  listsContainingPlace = [],
  onSaveSuccess,
  variant = "outline",
  size = "sm",
  showLabel = true,
  className,
}: SaveToListDropdownProps) {
  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [optimisticLists, setOptimisticLists] = useState<string[]>(listsContainingPlace);
  const [optimisticSave, setOptimisticSave] = useState<SavedPlace | null>(null);
  const [optimisticUnsaved, setOptimisticUnsaved] = useState(false);

  useEffect(() => {
    setOptimisticLists(listsContainingPlace);
  }, [listsContainingPlace]);

  useEffect(() => {
    if (savedPlace && !savedPlace.id.startsWith("temp-")) {
      setOptimisticSave(null);
      setOptimisticUnsaved(false);
    }
  }, [savedPlace?.id, savedPlace?.hasBeen, savedPlace?.rating]);

  const effectiveSavedPlace = optimisticUnsaved ? null : (optimisticSave || savedPlace);
  const isSaved = !!effectiveSavedPlace;
  const hasBeen = effectiveSavedPlace?.hasBeen ?? false;
  const currentRating = effectiveSavedPlace?.rating ?? null;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["saved-places"] });
    queryClient.invalidateQueries({ queryKey: ["place-detail"] });
    queryClient.invalidateQueries({ queryKey: ["lists"] });
    queryClient.invalidateQueries({ queryKey: ["collections"] });
    queryClient.invalidateQueries({ queryKey: ["list"] });
    queryClient.invalidateQueries({ queryKey: ["user"] });
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

  const openAfterSaveRef = useRef(false);

  const savePlaceMutation = useMutation({
    mutationFn: async (vars: { hasBeen?: boolean; rating?: number }) => {
      return apiRequest("/api/saved-places", {
        method: "POST",
        body: JSON.stringify({
          googlePlaceId: place.googlePlaceId,
          name: place.name,
          formattedAddress: place.formattedAddress,
          lat: place.lat,
          lng: place.lng,
          primaryType: place.primaryType,
          types: place.types,
          priceLevel: place.priceLevel,
          photoRefs: place.photoRefs,
          hasBeen: vars.hasBeen ?? false,
          rating: vars.rating,
        }),
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
      invalidateAll();
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
      invalidateAll();
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
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Added to list!");
      onSaveSuccess?.();
    },
    onError: (error: Error, listId: string) => {
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
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Removed from list");
      onSaveSuccess?.();
    },
    onError: (error: Error, listId: string) => {
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
      invalidateAll();
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

  return (
    <>
      <DropdownMenu open={open} onOpenChange={(o) => {
        if (!isSaved) {
          return;
        }
        setOpen(o);
      }}>
        <DropdownMenuTrigger asChild>
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
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56 z-[200]">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="flex items-center gap-1">
                Been here?
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HugeiconsIcon icon={InformationCircleIcon} className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    Rate places you've been to help drive recommendations
                  </TooltipContent>
                </Tooltip>
              </span>
            </DropdownMenuLabel>
            <div className="px-2 pb-1">
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
                    className="flex-1 gap-1"
                  >
                    <span className="text-base">{option.emoji}</span>
                    <span className="text-xs">{option.label}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          
          <DropdownMenuGroup>
            <DropdownMenuLabel>Lists</DropdownMenuLabel>
            
            {listsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-1.5 py-1">
                <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : lists.length === 0 ? (
              <div className="text-sm text-muted-foreground px-1.5 py-1">No lists yet</div>
            ) : (
              lists.map((list) => {
                const isInList = optimisticLists.includes(list.id);
                return (
                  <DropdownMenuItem
                    key={list.id}
                    onClick={(e) => {
                      e.preventDefault();
                      if (isSaved) {
                        handleListToggle(list.id);
                      }
                    }}
                    disabled={!isSaved || addToListMutation.isPending || removeFromListMutation.isPending}
                    data-testid={`list-checkbox-${list.id}`}
                  >
                    <span className="flex-1 truncate">{list.name}</span>
                    {isInList && <HugeiconsIcon icon={Tick01Icon} className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                );
              })
            )}

            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                if (isSaved) {
                  setOpen(false);
                  setTimeout(() => setShowCreateDialog(true), 150);
                }
              }}
              disabled={!isSaved}
              data-testid="button-add-new-list"
            >
              <HugeiconsIcon icon={PlusSignIcon} className="h-4 w-4" />
              Create new list
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              handleUnsave();
            }}
            disabled={unsavePlaceMutation.isPending || !isSaved}
            data-testid="button-unsave"
            className="hover:text-destructive focus:text-destructive"
          >
            <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
            <span>Remove from saved</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
}
