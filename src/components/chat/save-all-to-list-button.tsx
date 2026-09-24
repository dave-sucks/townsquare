"use client";

/**
 * "Save all to list" for a place-list result. Ported from the old
 * chat-dashboard's SaveAllToListButton; posts to /api/chat/save-all-to-list
 * and refreshes the saves and lists queries.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Bookmark01Icon, CheckmarkBadge01Icon, Loading03Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import type { PlaceRow } from "@/lib/agent/place-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/query-client";

function toPlaceData(p: PlaceRow) {
  return {
    googlePlaceId: p.googlePlaceId,
    name: p.name,
    formattedAddress: p.address ?? p.neighborhood ?? "",
    lat: p.lat,
    lng: p.lng,
    types: [],
    primaryType: null,
    priceLevel: p.priceLevel ?? null,
    rating: null,
    userRatingsTotal: null,
    photoRef: p.photoRef ?? null,
    emoji: p.emoji ?? null,
  };
}

export function SaveAllToListButton({ places }: { places: PlaceRow[] }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedListName, setSavedListName] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newListName, setNewListName] = useState("");

  const { data: listsData } = useQuery<{ lists: { id: string; name: string }[] }>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("/api/lists"),
    enabled: open,
  });
  const lists = listsData?.lists ?? [];

  const save = async (listName: string, listId?: string) => {
    if (saving) return;
    setSaving(true);
    setOpen(false);
    try {
      const res = await apiRequest<{ savedCount: number; list: { id: string; name: string } }>(
        "/api/chat/save-all-to-list",
        { method: "POST", body: JSON.stringify({ listName, listId, places: places.map(toPlaceData) }) },
      );
      setSavedListName(res.list.name);
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      toast.success(`Saved ${res.savedCount} places to "${res.list.name}"`);
    } catch {
      toast.error("Couldn't save those places. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const createAndSave = () => {
    const name = newListName.trim();
    if (!name) return;
    setShowCreate(false);
    setNewListName("");
    save(name);
  };

  if (savedListName) {
    return (
      <Button variant="secondary" size="sm" disabled data-testid="button-save-all-to-list">
        <HugeiconsIcon icon={CheckmarkBadge01Icon} />
        Saved to &ldquo;{savedListName}&rdquo;
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="sm" disabled={saving} data-testid="button-save-all-to-list" />}
        >
          <HugeiconsIcon icon={saving ? Loading03Icon : Bookmark01Icon} className={saving ? "animate-spin" : undefined} />
          {saving ? "Saving…" : "Save all to list"}
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Save {places.length} places to…</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {!listsData && (
            <div className="flex justify-center px-2 py-3">
              <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {listsData && lists.length === 0 && (
            <div className="px-2 py-2 text-center text-xs text-muted-foreground">No lists yet</div>
          )}
          {lists.map((list) => (
            <DropdownMenuItem key={list.id} onClick={() => save(list.name, list.id)}>
              <HugeiconsIcon icon={Bookmark01Icon} className="text-muted-foreground" />
              <span className="truncate">{list.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setOpen(false);
              setTimeout(() => setShowCreate(true), 120);
            }}
          >
            <HugeiconsIcon icon={PlusSignIcon} />
            New list
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setNewListName(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new list</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Save {places.length} places to a new list</p>
          <Input
            placeholder="List name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createAndSave();
              }
            }}
            autoFocus
            className="text-base"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={createAndSave} disabled={!newListName.trim() || saving}>
              Create &amp; save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
