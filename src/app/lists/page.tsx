"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, List as ListIcon, Search } from "lucide-react";
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

function ListsGrid({ lists }: { lists: ListData[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <ListIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="font-medium">No lists yet</p>
      <p className="text-sm text-muted-foreground mt-1">
        Create your first list to organize places
      </p>
    </div>
  );
}

export default function ListsPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: listsData, isLoading } = useQuery<{ lists: ListData[]; discoverLists: ListData[] }>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("/api/lists"),
    enabled: isAuthenticated,
  });

  const allLists = listsData?.lists || [];
  const discoverLists = listsData?.discoverLists || [];

  const filteredLists = debouncedSearch
    ? allLists.filter((list) =>
        list.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : allLists;

  const filteredDiscoverLists = debouncedSearch
    ? discoverLists.filter((list) =>
        list.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : discoverLists;

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

  if (!isAuthenticated && !authLoading) {
    return (
      <AppShell user={user}>
        <PageHeader title="Lists" />
        <ContentContainer>
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ListIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium">Sign in to view your lists</p>
            <Button asChild className="mt-4">
              <a href="/api/login">Sign In</a>
            </Button>
          </div>
        </ContentContainer>
      </AppShell>
    );
  }

  return (
    <AppShell user={user}>
      <PageHeader title="Lists">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-create-list">
              <Plus className="mr-1.5 h-4 w-4" />
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

      <ContentContainer maxWidth="lg">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search lists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-lists"
            />
          </div>
        </div>

        {authLoading || isLoading ? (
          <LoadingSkeleton />
        ) : filteredLists.length === 0 && filteredDiscoverLists.length === 0 ? (
          debouncedSearch ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="font-medium">No lists found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try a different search term
              </p>
            </div>
          ) : (
            <EmptyState />
          )
        ) : (
          <div className="space-y-8">
            {filteredLists.length > 0 && (
              <section>
                <h2 className="text-sm font-medium text-muted-foreground mb-4" data-testid="text-my-lists-header">
                  My Lists
                </h2>
                <ListsGrid lists={filteredLists} />
              </section>
            )}

            {filteredDiscoverLists.length > 0 && (
              <section>
                <h2 className="text-sm font-medium text-muted-foreground mb-4" data-testid="text-discover-lists-header">
                  Discover
                </h2>
                <ListsGrid lists={filteredDiscoverLists} />
              </section>
            )}
          </div>
        )}
      </ContentContainer>
    </AppShell>
  );
}
