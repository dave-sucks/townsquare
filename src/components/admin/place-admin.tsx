"use client";

/**
 * The place page in admin mode: the pencil panel beside Save (edit name, move
 * the pin, neighborhood, price, primary type, merge, re-run summary, view
 * runs, hide) and editable tag chips under the tag line. The summary's
 * Edit / Cancel / Save is place-summary.tsx. Every write goes through
 * /api/admin/places/[id], which audits it.
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
  MapPinIcon,
  PinLocation01Icon,
  TextIcon,
  Tick02Icon,
  ViewOffSlashIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Map, useMap } from "@/components/ui/map";
import { applyMapStyle, getStoredMapStyle } from "@/lib/map-styles";
import { formatPriceLevel } from "@/lib/places/format";
import { apiRequest } from "@/lib/query-client";
import { useAdminMode } from "@/components/admin/admin-mode";
import { AdminPanel, AdminPanelRow, AdminPanelSection } from "@/components/admin/admin-panel";
import { EditFieldDialog } from "@/components/admin/edit-field-dialog";
import { PlaceSearch, type PickedPlace } from "@/components/admin/place-search";
import { EditableTagChips, type ChipTag } from "@/components/admin/tag-picker";
import { adminPlaceKey, usePlaceWrite } from "@/components/admin/place-write";

type AdminPlace = {
  id: string;
  googlePlaceId: string;
  name: string;
  lat: number;
  lng: number;
  neighborhood: string | null;
  locality: string | null;
  priceLevel: string | null;
  primaryType: string | null;
  isHidden: boolean;
  mergedIntoId: string | null;
  aiSummaryUpdatedAt: string | null;
};

type AdminPlaceData = {
  place: AdminPlace;
  runs: { id: string; status: string; startedAt: string; costUsd: number | null }[];
  suppressedTags: { slug: string; displayName: string }[];
};

type Editing = null | "name" | "pin" | "neighborhood" | "price" | "type" | "merge";

const PRICE_OPTIONS: { value: string | null; label: string }[] = [
  { value: null, label: "Not set" },
  { value: "1", label: "$" },
  { value: "2", label: "$$" },
  { value: "3", label: "$$$" },
  { value: "4", label: "$$$$" },
];

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
    queryFn: () => apiRequest(`/api/admin/places/${googlePlaceId}`),
    enabled,
  });
}

export function PlaceAdminPanel({ googlePlaceId }: { googlePlaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Editing>(null);
  const { data } = useAdminPlace(googlePlaceId);
  const write = usePlaceWrite(googlePlaceId);
  const place = data?.place;
  const lastRun = data?.runs[0];

  // The panel closes before its dialog opens, as SaveToListDropdown does.
  const openEditor = (which: Editing) => {
    setOpen(false);
    setTimeout(() => setEditing(which), 150);
  };

  const patch = (fields: Record<string, unknown>, done?: string) =>
    write.mutate(
      { method: "PATCH", body: fields },
      {
        onSuccess: () => {
          setEditing(null);
          if (done) toast.success(done);
        },
      },
    );

  const refresh = () =>
    write.mutate(
      { method: "POST", body: { action: "refresh" } },
      { onSuccess: () => toast.success("Re-running Aggregate and Summarize. The summary updates in a minute or so.") },
    );

  const setHidden = (isHidden: boolean) =>
    write.mutate(
      { method: "PATCH", body: { isHidden } },
      {
        onSuccess: () => {
          setOpen(false);
          toast.success(isHidden ? "Place hidden from the map, search and chat" : "Place visible again", {
            action: { label: "Undo", onClick: () => write.mutate({ method: "PATCH", body: { isHidden: !isHidden } }) },
          });
        },
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
      <AdminPanel
        title={place?.name ?? "Place"}
        subtitle={
          place?.isHidden
            ? "Hidden"
            : lastRun
              ? `Last run ${formatDistanceToNowStrict(new Date(lastRun.startedAt), { addSuffix: true })} · ${lastRun.status}`
              : "No engine runs yet"
        }
        label="Edit place"
        open={open}
        onOpenChange={setOpen}
        testId="place-admin"
      >
        <AdminPanelSection label="Details">
          <AdminPanelRow icon={TextIcon} label="Name" detail={place?.name} onClick={() => openEditor("name")} disabled={!place} testId="button-place-admin-name" />
          <AdminPanelRow
            icon={PinLocation01Icon}
            label="Move the pin"
            detail={place ? `${place.lat.toFixed(3)}, ${place.lng.toFixed(3)}` : undefined}
            onClick={() => openEditor("pin")}
            disabled={!place}
            testId="button-place-admin-pin"
          />
          <AdminPanelRow
            icon={Location01Icon}
            label="Neighborhood"
            detail={place?.neighborhood || "Not set"}
            onClick={() => openEditor("neighborhood")}
            disabled={!place}
            testId="button-place-admin-neighborhood"
          />
          <AdminPanelRow
            icon={DollarCircleIcon}
            label="Price"
            detail={formatPriceLevel(place?.priceLevel) ?? "Not set"}
            onClick={() => openEditor("price")}
            disabled={!place}
            testId="button-place-admin-price"
          />
          <AdminPanelRow
            icon={Building03Icon}
            label="Primary type"
            detail={formatType(place?.primaryType ?? null) || "Not set"}
            onClick={() => openEditor("type")}
            disabled={!place}
            testId="button-place-admin-type"
          />
        </AdminPanelSection>
        <AdminPanelSection label="Engine">
          <AdminPanelRow icon={ArrowReloadHorizontalIcon} label="Re-run summary" onClick={refresh} pending={write.isPending && write.variables?.body.action === "refresh"} testId="button-place-admin-refresh" />
          <AdminPanelRow icon={Activity01Icon} label="View runs" href={`/admin/runs?place=${googlePlaceId}`} testId="link-place-admin-runs" />
          <AdminPanelRow icon={GitMergeIcon} label="Merge into another place" onClick={() => openEditor("merge")} disabled={!place} testId="button-place-admin-merge" />
        </AdminPanelSection>
        <AdminPanelRow
          icon={place?.isHidden ? ViewIcon : ViewOffSlashIcon}
          label={place?.isHidden ? "Unhide place" : "Hide place"}
          onClick={() => setHidden(!place?.isHidden)}
          disabled={!place}
          pending={write.isPending && write.variables?.body.isHidden !== undefined}
          destructive
          testId="button-place-admin-hide"
        />
      </AdminPanel>

      {place && (
        <>
          <EditFieldDialog
            open={editing === "name"}
            onOpenChange={(o) => !o && setEditing(null)}
            title="Place name"
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
            title="Primary type"
            initialValue={place.primaryType ?? ""}
            placeholder="e.g. bakery, wine_bar"
            saving={write.isPending}
            onSave={(v) => patch({ primaryType: v.trim().toLowerCase().replace(/\s+/g, "_") || null })}
            testId="place-type"
          />
          <PriceDialog
            open={editing === "price"}
            onOpenChange={(o) => !o && setEditing(null)}
            value={place.priceLevel}
            saving={write.isPending}
            onPick={(priceLevel) => patch({ priceLevel })}
          />
          <PinDialog
            open={editing === "pin"}
            onOpenChange={(o) => !o && setEditing(null)}
            lat={place.lat}
            lng={place.lng}
            saving={write.isPending}
            onSave={(lat, lng) => patch({ lat, lng }, "Pin moved")}
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

/** Choose a price level: the SaveToListDropdown list rows, a check on the current one. */
function PriceDialog({
  open,
  onOpenChange,
  value,
  saving,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string | null;
  saving: boolean;
  onPick: (priceLevel: string | null) => void;
}) {
  const current = formatPriceLevel(value);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-3">
          <DialogTitle>Price</DialogTitle>
        </DialogHeader>
        <div className="border-t pb-2">
          {PRICE_OPTIONS.map((o) => {
            const selected = (o.value ? "$".repeat(Number(o.value)) : null) === current;
            return (
              <button
                key={o.label}
                type="button"
                disabled={saving}
                onClick={() => onPick(o.value)}
                className="flex items-center gap-3 w-full text-left py-3 px-4 hover:bg-accent transition-colors disabled:opacity-50"
                data-testid={`button-price-${o.value ?? "none"}`}
              >
                <span className="flex-1 text-base font-medium">{o.label}</span>
                {selected && <HugeiconsIcon icon={Tick02Icon} className="h-5 w-5" />}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Styles the map like the user's other maps, but with every label (the
 * streets and businesses a pin is placed by), and reports where its center is.
 */
function PinMapSync({ onCenter }: { onCenter: (lat: number, lng: number) => void }) {
  const { map, isLoaded } = useMap();
  React.useEffect(() => {
    if (!map || !isLoaded) return;
    applyMapStyle(map, getStoredMapStyle());
    const listener = map.addListener("idle", () => {
      const c = map.getCenter();
      if (c) onCenter(c.lat(), c.lng());
    });
    return () => listener.remove();
  }, [map, isLoaded, onCenter]);
  return null;
}

/** Move the pin: drag the map under a fixed center pin, then save its center. */
function PinDialog({
  open,
  onOpenChange,
  lat,
  lng,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lat: number;
  lng: number;
  saving: boolean;
  onSave: (lat: number, lng: number) => void;
}) {
  const [center, setCenter] = React.useState({ lat, lng });
  React.useEffect(() => {
    if (open) setCenter({ lat, lng });
  }, [open, lat, lng]);
  const onCenter = React.useCallback((la: number, ln: number) => setCenter({ lat: la, lng: ln }), []);
  const moved = Math.abs(center.lat - lat) > 1e-6 || Math.abs(center.lng - lng) > 1e-6;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-place-pin">
        <DialogHeader>
          <DialogTitle>Move the pin</DialogTitle>
          <DialogDescription>Drag the map until the pin sits on the entrance.</DialogDescription>
        </DialogHeader>
        <div className="relative isolate h-72 w-full overflow-hidden rounded-xl border bg-muted">
          {open && (
            <Map center={[lng, lat]} zoom={17} className="h-full w-full">
              <PinMapSync onCenter={onCenter} />
            </Map>
          )}
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-brand text-white shadow-md">
              <HugeiconsIcon icon={MapPinIcon} className="size-4" />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums" data-testid="text-pin-coords">
          {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
        </p>
        <DialogFooter className="flex-row gap-2">
          <Button variant="ghost" className="flex-1 py-3 text-base" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 py-3 text-base" disabled={!moved || saving} onClick={() => onSave(center.lat, center.lng)} data-testid="button-save-place-pin">
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <DialogFooter className="flex-row gap-2">
          <Button variant="ghost" className="flex-1 py-3 text-base" onClick={() => (into ? setInto(null) : onOpenChange(false))}>
            {into ? "Back" : "Cancel"}
          </Button>
          <Button variant="destructive" className="flex-1 py-3 text-base" disabled={!into || saving} onClick={() => into && onMerge(into)} data-testid="button-confirm-merge">
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
