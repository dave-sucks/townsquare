"use client";

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
import { Plus, List as ListIcon, Lock, Globe } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { AppShell, PageHeader, ContentContainer } from "@/components/layout";

interface ListData {
  id: string;
  name: string;
  description: string | null;
  visibility: "PRIVATE" | "PUBLIC";
  createdAt: string;
  _count: {
    listPlaces: number;
  };
}

export default function ListsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: listsData, isLoading } = useQuery<{ lists: ListData[] }>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("/api/lists"),
    enabled: isAuthenticated,
  });

  const lists = listsData?.lists || [];

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
    <div className="space-y-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
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
    <div className="space-y-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  ) : lists.length === 0 ? (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <ListIcon className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">No lists yet</p>
        <p className="text-sm text-muted-foreground">Create your first list to organize places</p>
      </CardContent>
    </Card>
  ) : (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lists.map((list) => (
        <Link key={list.id} href={`/lists/${list.id}`} data-testid={`list-card-${list.id}`}>
          <Card className="cursor-pointer transition-colors hover-elevate">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{list.name}</CardTitle>
                  {list.description && (
                    <CardDescription className="mt-1 line-clamp-2">{list.description}</CardDescription>
                  )}
                </div>
                <Badge variant="outline">
                  {list.visibility === "PRIVATE" ? (
                    <><Lock className="mr-1 h-3 w-3" />Private</>
                  ) : (
                    <><Globe className="mr-1 h-3 w-3" />Public</>
                  )}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {list._count.listPlaces} {list._count.listPlaces === 1 ? "place" : "places"}
              </p>
            </CardHeader>
          </Card>
        </Link>
      ))}
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
