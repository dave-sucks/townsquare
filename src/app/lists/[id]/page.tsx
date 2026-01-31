"use client";

import { use } from "react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, Lock, Globe, MapPin } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { AppShell, PageHeader, ContentContainer } from "@/components/layout";

interface Place {
  id: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
}

interface ListPlace {
  id: string;
  listId: string;
  placeId: string;
  addedAt: string;
  note: string | null;
  place: Place;
}

interface ListData {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  visibility: "PRIVATE" | "PUBLIC";
  createdAt: string;
  listPlaces: ListPlace[];
  _count: {
    listPlaces: number;
  };
}

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const { data: listData, isLoading } = useQuery<{ list: ListData }>({
    queryKey: ["lists", id],
    queryFn: () => apiRequest(`/api/lists/${id}`),
  });

  const list = listData?.list;
  const isOwner = isAuthenticated && user?.id === list?.userId;

  const updateListMutation = useMutation({
    mutationFn: async (data: { name?: string; description?: string; visibility?: "PRIVATE" | "PUBLIC" }) => {
      return apiRequest(`/api/lists/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists", id] });
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
      return apiRequest(`/api/lists/${id}`, {
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
      return apiRequest(`/api/lists/${id}/places`, {
        method: "DELETE",
        body: JSON.stringify({ placeId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists", id] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      toast.success("Place removed from list!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove place");
    },
  });

  const openEditDialog = () => {
    if (list) {
      setName(list.name);
      setDescription(list.description || "");
      setIsPublic(list.visibility === "PUBLIC");
      setEditDialogOpen(true);
    }
  };

  const handleUpdateList = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    updateListMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      visibility: isPublic ? "PUBLIC" : "PRIVATE",
    });
  };

  const content = isLoading ? (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  ) : !list ? (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <MapPin className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">List not found</p>
        <Button asChild className="mt-4">
          <Link href="/lists">Back to Lists</Link>
        </Button>
      </CardContent>
    </Card>
  ) : list.listPlaces.length === 0 ? (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <MapPin className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">No places in this list</p>
        <p className="text-sm text-muted-foreground">Add places from the map view</p>
        <Button asChild className="mt-4">
          <Link href="/">Go to Map</Link>
        </Button>
      </CardContent>
    </Card>
  ) : (
    <div className="space-y-3">
      {list.listPlaces.map((listPlace) => (
        <Card key={listPlace.id} data-testid={`list-place-${listPlace.id}`}>
          <CardHeader className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base truncate">
                  <Link href={`/places/${listPlace.place.googlePlaceId}`} className="hover:underline" data-testid={`link-list-place-${listPlace.id}`}>
                    {listPlace.place.name}
                  </Link>
                </CardTitle>
                <CardDescription className="mt-1 truncate">{listPlace.place.formattedAddress}</CardDescription>
                {listPlace.note && <p className="mt-2 text-sm text-muted-foreground">{listPlace.note}</p>}
              </div>
              {isOwner && (
                <Button size="sm" variant="ghost" onClick={() => removePlaceMutation.mutate(listPlace.placeId)} disabled={removePlaceMutation.isPending} data-testid={`button-remove-place-${listPlace.id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );

  const listTitle = list?.name || "List";
  const visibilityBadge = list && (
    <Badge variant="outline">
      {list.visibility === "PRIVATE" ? <><Lock className="mr-1 h-3 w-3" />Private</> : <><Globe className="mr-1 h-3 w-3" />Public</>}
    </Badge>
  );

  return (
    <AppShell user={user}>
      <PageHeader title={listTitle} backHref="/lists">
        {visibilityBadge}
        {isOwner && list && (
          <div className="flex gap-2">
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={openEditDialog} data-testid="button-edit-list">
                  <Pencil className="mr-1 h-4 w-4" />Edit
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
                  <Button onClick={handleUpdateList} disabled={updateListMutation.isPending} data-testid="button-submit-edit-list">Save Changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={() => deleteListMutation.mutate()} disabled={deleteListMutation.isPending} data-testid="button-delete-list">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </PageHeader>
      <ContentContainer maxWidth="md">
        {list?.description && <p className="text-muted-foreground mb-4">{list.description}</p>}
        {content}
      </ContentContainer>
    </AppShell>
  );
}
