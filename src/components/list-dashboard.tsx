"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, MapPin } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { PlaceMap } from "@/components/place-map";
import { PlaceDetailsSheet } from "@/components/place-details-sheet";
import { ListPlacesPanel, ListHeaderSkeleton } from "@/components/list-places-panel";
import { BottomSheet } from "@/components/bottom-sheet";
import { AppShell } from "@/components/layout";

interface UserData {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface Place {
  id: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  photoRefs: string[] | null;
  primaryType: string | null;
  types: string[] | null;
  priceLevel: string | null;
}

interface ListPlace {
  id: string;
  listId: string;
  placeId: string;
  addedAt: string;
  note: string | null;
  place: Place;
}

interface ListUser {
  id: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

interface ListData {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  visibility: "PRIVATE" | "PUBLIC";
  createdAt: string;
  updatedAt?: string;
  user?: ListUser;
  listPlaces: ListPlace[];
  _count: {
    listPlaces: number;
  };
}

interface SavedPlaceForMap {
  id: string;
  status: "WANT" | "BEEN";
  place: Place;
}

interface SavedPlace {
  id: string;
  userId: string;
  placeId: string;
  status: "WANT" | "BEEN";
  visitedAt: string | null;
  createdAt: string;
  place: Place;
}

interface ListDashboardProps {
  listId: string;
  currentUser: UserData | null;
  isAuthenticated: boolean;
}

export function ListDashboard({ listId, currentUser, isAuthenticated }: ListDashboardProps) {
  const router = useRouter();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedListPlace, setSelectedListPlace] = useState<ListPlace | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const placeRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { data: listData, isLoading } = useQuery<{ list: ListData }>({
    queryKey: ["lists", listId],
    queryFn: () => apiRequest(`/api/lists/${listId}`),
  });

  const list = listData?.list;
  const isOwner = isAuthenticated && currentUser?.id === list?.userId;

  const updateListMutation = useMutation({
    mutationFn: async (data: { name?: string; description?: string; visibility?: "PRIVATE" | "PUBLIC" }) => {
      return apiRequest(`/api/lists/${listId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setEditDialogOpen(false);
      toast.success("List updated!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update list");
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/lists/${listId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      toast.success("List deleted!");
      router.push("/lists");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete list");
    },
  });

  const removePlaceMutation = useMutation({
    mutationFn: async (placeId: string) => {
      return apiRequest(`/api/lists/${listId}/places`, {
        method: "DELETE",
        body: JSON.stringify({ placeId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      toast.success("Place removed from list!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove place");
    },
  });

  const openEditDialog = useCallback(() => {
    if (list) {
      setName(list.name);
      setDescription(list.description || "");
      setIsPublic(list.visibility === "PUBLIC");
      setEditDialogOpen(true);
    }
  }, [list]);

  const handleUpdateList = useCallback(() => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    updateListMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      visibility: isPublic ? "PUBLIC" : "PRIVATE",
    });
  }, [name, description, isPublic, updateListMutation]);

  const handlePlaceSelect = useCallback((placeId: string) => {
    setSelectedPlaceId(placeId);
    const listPlace = list?.listPlaces.find(lp => lp.placeId === placeId);
    if (listPlace) {
      setSelectedListPlace(listPlace);
      setSheetOpen(true);
    }
  }, [list]);

  const handleMarkerClick = useCallback((placeId: string) => {
    setSelectedPlaceId(placeId);
    const listPlace = list?.listPlaces.find(lp => lp.placeId === placeId);
    if (listPlace) {
      setSelectedListPlace(listPlace);
      setSheetOpen(true);
    }
    const rowEl = placeRowRefs.current.get(placeId);
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [list]);

  const placesForMap: SavedPlaceForMap[] = list?.listPlaces.map(lp => ({
    id: lp.placeId,
    status: "WANT" as const,
    place: lp.place as Place,
  })) || [];

  if (isLoading) {
    return (
      <AppShell user={currentUser}>
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0 bg-muted flex items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
          <div className="absolute top-0 left-0 bottom-0 z-10 w-[25rem] p-3 hidden md:block">
            <div className="h-full bg-background rounded-lg border shadow-lg overflow-hidden">
              <ListHeaderSkeleton />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!list) {
    return (
      <AppShell user={currentUser}>
        <div className="flex flex-col items-center justify-center flex-1 p-8">
          <MapPin className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">List not found</p>
          <Button asChild className="mt-4" data-testid="button-back-to-lists">
            <Link href="/lists">Back to Lists</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const sidebarContent = (
    <div className="h-full flex flex-col">
      <ListPlacesPanel
        list={list}
        isOwner={isOwner}
        selectedPlaceId={selectedPlaceId}
        onPlaceSelect={handlePlaceSelect}
        onRemovePlace={isOwner ? (placeId) => removePlaceMutation.mutate(placeId) : undefined}
        isRemovingPlace={removePlaceMutation.isPending}
        placeRowRefs={placeRowRefs}
      />
    </div>
  );

  return (
    <AppShell user={currentUser}>
      <div className="relative flex-1 overflow-hidden">
        <PlaceMap
          places={placesForMap}
          selectedPlaceId={selectedPlaceId}
          onMarkerClick={handleMarkerClick}
          showSettings={true}
        />

        {/* Desktop Sidebar */}
        <div className="absolute top-0 left-0 bottom-0 z-10 w-[25rem] p-3 hidden md:block">
          <div className="h-full bg-background rounded-lg border shadow-lg overflow-hidden flex flex-col">
            {sidebarContent}
            {isOwner && (
              <div className="p-3 border-t flex gap-2">
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1" onClick={openEditDialog} data-testid="button-edit-list">
                      <Pencil className="mr-1.5 h-4 w-4" />
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit List</DialogTitle>
                      <DialogDescription>Update your list details</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-name">Name</Label>
                        <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-edit-list-name" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-description">Description</Label>
                        <Textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-edit-list-description" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="visibility">Public</Label>
                        <Switch id="visibility" checked={isPublic} onCheckedChange={setIsPublic} data-testid="switch-list-visibility" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleUpdateList} disabled={updateListMutation.isPending} data-testid="button-submit-edit-list">
                        Save Changes
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => deleteListMutation.mutate()} 
                  disabled={deleteListMutation.isPending}
                  data-testid="button-delete-list"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Bottom Sheet */}
        <div className="md:hidden">
          <BottomSheet>
            {sidebarContent}
            {isOwner && (
              <div className="p-3 border-t flex gap-2">
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1" onClick={openEditDialog} data-testid="button-edit-list-mobile">
                      <Pencil className="mr-1.5 h-4 w-4" />
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit List</DialogTitle>
                      <DialogDescription>Update your list details</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-name-mobile">Name</Label>
                        <Input id="edit-name-mobile" value={name} onChange={(e) => setName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-description-mobile">Description</Label>
                        <Textarea id="edit-description-mobile" value={description} onChange={(e) => setDescription(e.target.value)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="visibility-mobile">Public</Label>
                        <Switch id="visibility-mobile" checked={isPublic} onCheckedChange={setIsPublic} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleUpdateList} disabled={updateListMutation.isPending}>
                        Save Changes
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => deleteListMutation.mutate()} 
                  disabled={deleteListMutation.isPending}
                  data-testid="button-delete-list-mobile"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </BottomSheet>
        </div>
      </div>

      {selectedListPlace && (
        <PlaceDetailsSheet
          savedPlace={{
            id: selectedListPlace.id,
            userId: list?.userId || "",
            placeId: selectedListPlace.placeId,
            status: "WANT",
            visitedAt: null,
            createdAt: selectedListPlace.addedAt,
            place: {
              id: selectedListPlace.place.id,
              googlePlaceId: selectedListPlace.place.googlePlaceId,
              name: selectedListPlace.place.name,
              formattedAddress: selectedListPlace.place.formattedAddress,
              lat: selectedListPlace.place.lat,
              lng: selectedListPlace.place.lng,
              primaryType: selectedListPlace.place.primaryType,
              types: selectedListPlace.place.types,
              priceLevel: selectedListPlace.place.priceLevel,
              photoRefs: selectedListPlace.place.photoRefs,
            },
          }}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onToggleStatus={() => {}}
          onDelete={() => {
            if (isOwner) {
              removePlaceMutation.mutate(selectedListPlace.placeId);
              setSheetOpen(false);
            }
          }}
          onAddToList={() => {}}
          isUpdating={false}
          isDeleting={removePlaceMutation.isPending}
        />
      )}
    </AppShell>
  );
}
