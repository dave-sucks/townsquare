"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, List as ListIcon } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { AppShell, PageHeader, ContentContainer } from "@/components/layout";
import { ListCard } from "@/components/list-card";

interface ListPlace {
  id: string;
  place: {
    id: string;
    name: string;
    formattedAddress: string;
    photoRefs?: string[] | null;
  };
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
  name: string;
  description: string | null;
  visibility: "PRIVATE" | "PUBLIC";
  createdAt: string;
  user?: ListUser;
  listPlaces?: ListPlace[];
  _count: {
    listPlaces: number;
  };
}

export default function ListsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: listsData, isLoading } = useQuery<{ lists: ListData[]; discoverLists: ListData[] }>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("/api/lists"),
    enabled: isAuthenticated,
  });

  const lists = listsData?.lists || [];
  const discoverLists = listsData?.discoverLists || [];

  const createListMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      return apiRequest("/api/lists", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setDialogOpen(false);
      setName("");
      setDescription("");
      toast.success("List created!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create list");
    },
  });

  const handleCreateList = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    createListMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  const { user } = useAuth();

  const content = authLoading ? (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[4/3] w-full rounded-md" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  ) : !isAuthenticated ? (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <ListIcon className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Sign in to view your lists</p>
        <Button asChild className="mt-4">
          <a href="/api/login">Sign In</a>
        </Button>
      </CardContent>
    </Card>
  ) : isLoading ? (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[4/3] w-full rounded-md" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  ) : (
    <div className="space-y-8">
      {/* My Lists Section */}
      <section>
        <h2 className="mb-4 text-lg font-semibold" data-testid="text-my-lists-header">My Lists</h2>
        {lists.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <ListIcon className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">No lists yet</p>
              <p className="text-sm text-muted-foreground">Create your first list to organize places</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {lists.map((list) => (
              <ListCard
                key={list.id}
                id={list.id}
                name={list.name}
                description={list.description}
                visibility={list.visibility}
                placeCount={list._count.listPlaces}
                places={list.listPlaces?.map((lp) => ({
                  id: lp.place.id,
                  name: lp.place.name,
                  formattedAddress: lp.place.formattedAddress,
                  photoRefs: lp.place.photoRefs as string[] | null,
                }))}
                user={list.user}
              />
            ))}
          </div>
        )}
      </section>

      {/* Discover Lists Section */}
      {discoverLists.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold" data-testid="text-discover-lists-header">Discover</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {discoverLists.map((list) => (
              <ListCard
                key={list.id}
                id={list.id}
                name={list.name}
                description={list.description}
                visibility={list.visibility}
                placeCount={list._count.listPlaces}
                places={list.listPlaces?.map((lp) => ({
                  id: lp.place.id,
                  name: lp.place.name,
                  formattedAddress: lp.place.formattedAddress,
                  photoRefs: lp.place.photoRefs as string[] | null,
                }))}
                user={list.user}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );

  return (
    <AppShell user={user}>
      <PageHeader title="Lists">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-create-list">
              <Plus className="mr-1 h-4 w-4" />
              New List
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a New List</DialogTitle>
              <DialogDescription>Create a list to organize your saved places</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Best Coffee Shops"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="input-list-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Add a description for your list"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="input-list-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateList} disabled={createListMutation.isPending} data-testid="button-submit-create-list">
                Create List
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>
      <ContentContainer>{content}</ContentContainer>
    </AppShell>
  );
}
