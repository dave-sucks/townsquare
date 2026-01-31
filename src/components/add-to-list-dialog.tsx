"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, List as ListIcon, Plus } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const listItemVariants = cva(
  "flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors",
  {
    variants: {
      selected: {
        true: "border-primary bg-primary/10",
        false: "hover-elevate",
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

interface ListData {
  id: string;
  name: string;
  description: string | null;
  _count: {
    listPlaces: number;
  };
}

interface AddToListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeId: string;
  placeName: string;
}

export function AddToListDialog({ open, onOpenChange, placeId, placeName }: AddToListDialogProps) {
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState("");

  const { data: listsData, isLoading } = useQuery<{ lists: ListData[] }>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("/api/lists"),
    enabled: open,
  });

  const lists = listsData?.lists || [];

  const addToListMutation = useMutation({
    mutationFn: async (listId: string) => {
      return apiRequest(`/api/lists/${listId}/places`, {
        method: "POST",
        body: JSON.stringify({ placeId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      onOpenChange(false);
      setSelectedListId(null);
      toast.success("Added to list!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add to list");
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
      setShowCreateForm(false);
      setNewListName("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create list");
    },
  });

  const handleAdd = () => {
    if (selectedListId) {
      addToListMutation.mutate(selectedListId);
    }
  };

  const handleCreateAndAdd = () => {
    if (!newListName.trim()) {
      toast.error("List name is required");
      return;
    }
    createListMutation.mutate(newListName.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to List</DialogTitle>
          <DialogDescription>
            Add "{placeName}" to one of your lists
          </DialogDescription>
        </DialogHeader>

        {showCreateForm ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-list-name">List Name</Label>
              <Input
                id="new-list-name"
                placeholder="e.g., Best Coffee Shops"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                data-testid="input-new-list-name"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewListName("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateAndAdd}
                disabled={createListMutation.isPending || addToListMutation.isPending}
                data-testid="button-create-and-add"
              >
                Create & Add
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-60">
              {isLoading ? (
                <div className="space-y-2 p-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : lists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <ListIcon className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No lists yet</p>
                </div>
              ) : (
                <div className="space-y-2 p-1">
                  {lists.map((list) => (
                    <div
                      key={list.id}
                      className={cn(listItemVariants({ selected: selectedListId === list.id }))}
                      onClick={() => setSelectedListId(list.id)}
                      data-testid={`select-list-${list.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{list.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {list._count.listPlaces} places
                        </p>
                      </div>
                      {selectedListId === list.id && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowCreateForm(true)}
              data-testid="button-show-create-list"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New List
            </Button>

            <DialogFooter>
              <Button
                onClick={handleAdd}
                disabled={!selectedListId || addToListMutation.isPending}
                data-testid="button-add-to-selected-list"
              >
                Add to List
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
