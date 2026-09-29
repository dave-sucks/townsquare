"use client";

/**
 * The place page in admin mode: the pencil menu beside Save (rename,
 * neighborhood, price, type, re-run summary, runs, merge, hide) and editable
 * tag chips under the tag line. The summary's Edit / Cancel / Save is
 * place-summary.tsx. Every write goes through /api/admin/places/[id], which
 * audits it.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Activity01Icon,
  ArrowReloadHorizontalIcon,
  Building03Icon,
  DollarCircleIcon,
  GitMergeIcon,
  Location01Icon,
  TextIcon,
  ViewIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusDot } from "@/components/shared/status-dot";
import { formatPriceLevel } from "@/lib/places/format";
import { adminFetch } from "@/components/admin/admin-fetch";
import { useAdminMode } from "@/components/admin/admin-mode";
import { AdminMenu, AdminMenuItem } from "@/components/admin/admin-menu";
import { EditFieldDialog } from "@/components/admin/edit-field-dialog";
import { PlaceSearch, type PickedPlace } from "@/components/admin/place-search";
import { EditableTagChips, type ChipTag } from "@/components/admin/tag-picker";
import { adminPlaceKey, usePlaceWrite } from "@/components/admin/place-write";

type AdminPlace = {
  id: string;
  googlePlaceId: string;
  name: string;
  neighborhood: string | null;
  priceLevel: string | null;
  primaryType: string | null;
  isHidden: boolean;
};

type AdminPlaceData = {
  place: AdminPlace;
  runs: { id: string; status: string; startedAt: string; costUsd: number | null }[];
};

type Editing = null | "name" | "neighborhood" | "type" | "merge";

const PRICES = [
  { value: "none", label: "Not set" },
  { value: "1", label: "$" },
  { value: "2", label: "$$" },
  { value: "3", label: "$$$" },
  { value: "4", label: "$$$$" },
];

/** A stored price ("2", "$$" or "PRICE_LEVEL_MODERATE") as its menu value. */
function priceValue(level: string | null): string {
  const shown = formatPriceLevel(level);
  return shown ? String(shown.length) : "none";
}

function formatType(type: string | null): string {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function useAdminPlace(googlePlaceId: string) {
  const { enabled } = useAdminMode();
  return useQuery<AdminPlaceData>({
    queryKey: adminPlaceKey(googlePlaceId),
    queryFn: () => adminFetch(`/api/admin/places/${googlePlaceId}`),
    enabled,
  });
}

export function PlaceAdminMenu({ googlePlaceId }: { googlePlaceId: string }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Editing>(null);
  const { data } = useAdminPlace(googlePlaceId);
  const write = usePlaceWrite(googlePlaceId);
  const place = data?.place;
  const lastRun = data?.runs[0];

  // A dialog opens once the menu has closed and handed focus back.
  const openEditor = (which: Editing) => setTimeout(() => setEditing(which), 100);

  const patch = (fields: Record<string, unknown>) => write.mutate({ method: "PATCH", body: fields }, { onSuccess: () => setEditing(null) });

  const refresh = () =>
    write.mutate(
      { method: "POST", body: { action: "refresh" } },
      { onSuccess: () => toast.success("Re-running Aggregate and Summarize. The summary updates in a minute or so.") },
    );

  const setHidden = (isHidden: boolean) =>
    write.mutate(
      { method: "PATCH", body: { isHidden } },
      {
        onSuccess: () =>
          toast.success(isHidden ? "Place hidden from the map, search and chat" : "Place visible again", {
            action: { label: "Undo", onClick: () => write.mutate({ method: "PATCH", body: { isHidden: !isHidden } }) },
          }),
      },
    );

  const merge = (into: PickedPlace) =>
    write.mutate(
      { method: "POST", body: { action: "merge", intoGooglePlaceId: into.googlePlaceId } },
      {
        onSuccess: () => {
          setEditing(null);
          toast.success(`Merged into ${into.name}`);
          router.replace(`/places/${into.googlePlaceId}`);
        },
      },
    );

  return (
    <>
      <AdminMenu label="Edit place" testId="place-admin">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Place</DropdownMenuLabel>
          <AdminMenuItem icon={TextIcon} label="Rename" value={place?.name} onClick={() => openEditor("name")} disabled={!place} testId="button-place-admin-name" />
          <AdminMenuItem
            icon={Location01Icon}
            label="Neighborhood"
            value={place?.neighborhood || "Not set"}
            onClick={() => openEditor("neighborhood")}
            disabled={!place}
            testId="button-place-admin-neighborhood"
          />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!place} data-testid="button-place-admin-price">
              <HugeiconsIcon icon={DollarCircleIcon} />
              <span className="flex-1">Price</span>
              <span className="text-xs text-muted-foreground">{formatPriceLevel(place?.priceLevel) ?? "Not set"}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={priceValue(place?.priceLevel ?? null)} onValueChange={(v: string) => patch({ priceLevel: v === "none" ? null : v })}>
                {PRICES.map((p) => (
                  <DropdownMenuRadioItem key={p.value} value={p.value} closeOnClick data-testid={`button-price-${p.value}`}>
                    {p.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <AdminMenuItem
            icon={Building03Icon}
            label="Type"
            value={formatType(place?.primaryType ?? null) || "Not set"}
            onClick={() => openEditor("type")}
            disabled={!place}
            testId="button-place-admin-type"
          />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Engine</DropdownMenuLabel>
          <AdminMenuItem icon={ArrowReloadHorizontalIcon} label="Re-run summary" onClick={refresh} testId="button-place-admin-refresh" />
          <AdminMenuItem
            icon={Activity01Icon}
            label="History"
            value={
              lastRun ? (
                <span className="inline-flex items-center gap-1.5">
                  <StatusDot status={lastRun.status} />
                  {formatDistanceToNowStrict(new Date(lastRun.startedAt), { addSuffix: true })}
                </span>
              ) : undefined
            }
            href={`/admin/runs?place=${googlePlaceId}`}
            testId="link-place-admin-runs"
          />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <AdminMenuItem icon={GitMergeIcon} label="Merge into another place" onClick={() => openEditor("merge")} disabled={!place} testId="button-place-admin-merge" />
        <AdminMenuItem
          icon={place?.isHidden ? ViewIcon : ViewOffSlashIcon}
          label={place?.isHidden ? "Unhide place" : "Hide place"}
          destructive={!place?.isHidden}
          onClick={() => setHidden(!place?.isHidden)}
          disabled={!place}
          testId="button-place-admin-hide"
        />
      </AdminMenu>

      {place && (
        <>
          <EditFieldDialog
            open={editing === "name"}
            onOpenChange={(o) => !o && setEditing(null)}
            title="Rename place"
            initialValue={place.name}
            saving={write.isPending}
            onSave={(v) => v.trim() && patch({ name: v.trim() })}
            testId="place-name"
          />
          <EditFieldDialog
            open={editing === "neighborhood"}
            onOpenChange={(o) => !o && setEditing(null)}
            title="Neighborhood"
            initialValue={place.neighborhood ?? ""}
            placeholder="e.g. Greenpoint"
            saving={write.isPending}
            onSave={(v) => patch({ neighborhood: v.trim() || null })}
            testId="place-neighborhood"
          />
          <EditFieldDialog
            open={editing === "type"}
            onOpenChange={(o) => !o && setEditing(null)}
            title="Type"
            initialValue={place.primaryType ?? ""}
            placeholder="e.g. bakery, wine_bar"
            saving={write.isPending}
            onSave={(v) => patch({ primaryType: v.trim().toLowerCase().replace(/\s+/g, "_") || null })}
            testId="place-type"
          />
          <MergeDialog
            open={editing === "merge"}
            onOpenChange={(o) => !o && setEditing(null)}
            fromName={place.name}
            fromGooglePlaceId={place.googlePlaceId}
            saving={write.isPending}
            onMerge={merge}
          />
        </>
      )}
    </>
  );
}

/** Merge this place into another: pick it, then confirm. */
function MergeDialog({
  open,
  onOpenChange,
  fromName,
  fromGooglePlaceId,
  saving,
  onMerge,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromName: string;
  fromGooglePlaceId: string;
  saving: boolean;
  onMerge: (into: PickedPlace) => void;
}) {
  const [into, setInto] = React.useState<PickedPlace | null>(null);
  React.useEffect(() => {
    if (open) setInto(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-place-merge">
        <DialogHeader>
          <DialogTitle>Merge into another place</DialogTitle>
          <DialogDescription>
            {into
              ? `${fromName}'s mentions, saves, list entries and photos move to ${into.name}. ${fromName} is hidden and its page points to ${into.name}.`
              : `Find the place ${fromName} is a duplicate of.`}
          </DialogDescription>
        </DialogHeader>
        {into ? (
          <div className="rounded-lg border px-3 py-2.5" data-testid="text-merge-target">
            <p className="text-sm font-medium truncate">{into.name}</p>
            <p className="text-xs text-muted-foreground truncate">{into.address}</p>
          </div>
        ) : (
          <PlaceSearch autoFocus testId="merge-search" onPick={(p) => (p.googlePlaceId === fromGooglePlaceId ? toast.error("That's this place") : setInto(p))} />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => (into ? setInto(null) : onOpenChange(false))}>
            {into ? "Back" : "Cancel"}
          </Button>
          <Button variant="destructive" disabled={!into || saving} onClick={() => into && onMerge(into)} data-testid="button-confirm-merge">
            {saving ? "Merging..." : "Merge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** In admin mode, the place's tags as removable chips plus "Add tag". */
export function PlaceTagsAdmin({ googlePlaceId, tags }: { googlePlaceId: string; tags: ChipTag[] }) {
  const { enabled } = useAdminMode();
  const write = usePlaceWrite(googlePlaceId);
  if (!enabled) return null;
  return (
    <EditableTagChips
      tags={tags}
      disabled={write.isPending}
      onRemove={(slug) => write.mutate({ method: "POST", body: { action: "tag", slug, show: false } })}
      onAdd={(slug) => write.mutate({ method: "POST", body: { action: "tag", slug, show: true } })}
      testId="place-tags-admin"
    />
  );
}
