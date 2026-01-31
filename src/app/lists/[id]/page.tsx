"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, List as ListViewIcon, Heart, Plus, Share2, Pencil, Trash2, Lock, Globe, MapPin, ExternalLink } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";

interface Place {
  id: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  photoRefs?: string[] | null;
  primaryType?: string | null;
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

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

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

  const photos: string[] = [];
  list?.listPlaces.forEach((lp) => {
    if (lp.place.photoRefs && Array.isArray(lp.place.photoRefs)) {
      lp.place.photoRefs.slice(0, 2).forEach((ref) => {
        if (photos.length < 5) {
          photos.push(`/api/places/photo?ref=${encodeURIComponent(ref as string)}`);
        }
      });
    }
  });

  const userName = list?.user?.firstName && list?.user?.lastName
    ? `${list.user.firstName} ${list.user.lastName}`
    : list?.user?.username || "Unknown";

  const userInitials = list?.user?.firstName && list?.user?.lastName
    ? `${list.user.firstName[0]}${list.user.lastName[0]}`
    : list?.user?.username?.[0] || "?";

  const firstPlaceLocation = list?.listPlaces[0]?.place?.formattedAddress?.split(",").slice(-2).join(",").trim();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="aspect-[3/1] w-full rounded-lg mb-6" />
          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-48 flex-1 min-w-[300px]" />
            <Skeleton className="h-48 flex-1 min-w-[300px]" />
          </div>
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MapPin className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">List not found</p>
              <Button asChild className="mt-4">
                <Link href="/lists">Back to Lists</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="icon" asChild data-testid="button-back-to-lists">
              <Link href="/lists">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" data-testid="button-list-view">
              <ListViewIcon className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="icon" data-testid="button-like-list">
              <Heart className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" data-testid="button-add-to-trip">
              <Plus className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" data-testid="button-share-list">
              <Share2 className="h-5 w-5" />
            </Button>
            {isOwner && (
              <>
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={openEditDialog} data-testid="button-edit-list">
                      <Pencil className="h-5 w-5" />
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
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label htmlFor="visibility">Public</Label>
                        <Switch id="visibility" checked={isPublic} onCheckedChange={setIsPublic} data-testid="switch-list-visibility" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleUpdateList} disabled={updateListMutation.isPending} data-testid="button-submit-edit-list">Save Changes</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button variant="ghost" size="icon" onClick={() => deleteListMutation.mutate()} disabled={deleteListMutation.isPending} data-testid="button-delete-list">
                  <Trash2 className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="relative mb-6 rounded-lg overflow-hidden">
          <div className="aspect-[3/1] bg-muted relative">
            {photos.length > 0 ? (
              <div className="absolute inset-0 grid grid-cols-4 gap-1">
                <div className="col-span-2 relative">
                  <Image
                    src={photos[0]}
                    alt={list.name}
                    fill
                    className="object-cover"
                    sizes="50vw"
                    unoptimized
                  />
                </div>
                <div className="col-span-2 grid grid-cols-2 gap-1">
                  {photos.slice(1, 5).map((photo, idx) => (
                    <div key={idx} className="relative">
                      <Image
                        src={photo}
                        alt={`${list.name} photo ${idx + 2}`}
                        fill
                        className="object-cover"
                        sizes="25vw"
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <MapPin className="h-16 w-16 text-muted-foreground/30" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2" data-testid="text-list-title">
                {list.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-white/90">
                <Link href={list.user ? `/u/${list.user.username || list.user.id}` : "#"} className="flex flex-wrap items-center gap-2">
                  <Avatar className="h-6 w-6 border border-white/20">
                    <AvatarImage src={list.user?.profileImageUrl || undefined} alt={userName} />
                    <AvatarFallback className="text-xs bg-background/20">{userInitials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{userName}</span>
                </Link>
                <span className="text-white/60">|</span>
                <span className="text-sm">{list._count.listPlaces} places</span>
              </div>
              {firstPlaceLocation && (
                <div className="flex flex-wrap items-center gap-1 mt-2 text-white/80">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm">{firstPlaceLocation}</span>
                </div>
              )}
            </div>
            {list.visibility === "PRIVATE" && (
              <Badge variant="secondary" className="absolute top-4 right-4 bg-background/80">
                <Lock className="h-3 w-3 mr-1" />
                Private
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr,400px]">
          <div className="space-y-6">
            {list.description && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Overview</h2>
                <p className={`text-muted-foreground ${!showFullDescription && list.description.length > 200 ? "line-clamp-3" : ""}`}>
                  {list.description}
                </p>
                {list.description.length > 200 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setShowFullDescription(!showFullDescription)}
                    data-testid="button-toggle-description"
                  >
                    {showFullDescription ? "Show less" : "Read more"}
                  </Button>
                )}
              </div>
            )}

            <div>
              <h2 className="text-lg font-semibold mb-4">Places</h2>
              {list.listPlaces.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <MapPin className="mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="text-lg font-medium">No places in this list</p>
                    <p className="text-sm text-muted-foreground">Add places from the map view</p>
                    <Button asChild className="mt-4">
                      <Link href="/map">Go to Map</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {list.listPlaces.map((listPlace, index) => {
                    const placePhoto = listPlace.place.photoRefs?.[0]
                      ? `/api/places/photo?ref=${encodeURIComponent(listPlace.place.photoRefs[0] as string)}`
                      : null;

                    return (
                      <Card key={listPlace.id} className="overflow-hidden" data-testid={`list-place-${listPlace.id}`}>
                        <div className="flex flex-wrap">
                          <div className="relative w-24 h-24 shrink-0 bg-muted">
                            {placePhoto ? (
                              <Image
                                src={placePhoto}
                                alt={listPlace.place.name}
                                fill
                                className="object-cover"
                                sizes="96px"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <MapPin className="h-6 w-6 text-muted-foreground/50" />
                              </div>
                            )}
                            <div className="absolute top-1 left-1 bg-background/80 rounded-full h-5 w-5 flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <Link
                                  href={`/places/${listPlace.place.googlePlaceId}`}
                                  className="font-medium hover:underline line-clamp-1"
                                  data-testid={`link-list-place-${listPlace.id}`}
                                >
                                  {listPlace.place.name}
                                </Link>
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {listPlace.place.formattedAddress}
                                </p>
                                {listPlace.note && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                                    {listPlace.note}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  asChild
                                  data-testid={`button-open-place-${listPlace.id}`}
                                >
                                  <Link href={`/places/${listPlace.place.googlePlaceId}`}>
                                    <ExternalLink className="h-4 w-4" />
                                  </Link>
                                </Button>
                                {isOwner && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removePlaceMutation.mutate(listPlace.placeId)}
                                    disabled={removePlaceMutation.isPending}
                                    data-testid={`button-remove-place-${listPlace.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="lg:sticky lg:top-6 h-fit">
            <Card className="overflow-hidden">
              <div className="aspect-[4/3] bg-muted relative">
                {list.listPlaces.length > 0 ? (
                  <iframe
                    title="Map"
                    className="absolute inset-0 w-full h-full"
                    src={`https://www.google.com/maps/embed/v1/view?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&center=${list.listPlaces[0].place.lat},${list.listPlaces[0].place.lng}&zoom=12`}
                    allowFullScreen
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <MapPin className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <Button className="w-full" asChild>
                  <Link href={`/map?list=${list.id}`} data-testid="button-view-on-map">
                    View on Map
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
