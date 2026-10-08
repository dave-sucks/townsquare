"use client";

/**
 * A creator's admin controls, on History when it's filtered to them: the
 * source query and the settings menu (sync now, pause, home city, notes for
 * the engine, trust weight, sync history, re-process).
 */

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Clock01Icon,
  Location01Icon,
  Note01Icon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  RepeatIcon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useAdminMode } from "@/components/admin/admin-mode";
import { AdminMenu, AdminMenuItem } from "@/components/admin/admin-menu";
import { adminFetch } from "@/components/admin/admin-fetch";
import { EditFieldDialog } from "@/components/admin/edit-field-dialog";
import { lastSyncLabel, type SourceSummary } from "@/components/admin/source-meta";
import { ReprocessDialog } from "@/components/admin/reprocess";
import { queryClient } from "@/lib/query-client";

type Sync = { id: string; status: string; createdAt: string; completedAt: string | null; postsFetched: number; since: string | null; error: string | null };
type SourceData = { source: SourceSummary | null; syncs: Sync[] };

const TRUST = [
  { value: "0.5", label: "Low", detail: "0.5×" },
  { value: "1", label: "Normal", detail: "1×" },
  { value: "1.5", label: "High", detail: "1.5×" },
  { value: "2", label: "Top", detail: "2×" },
];

/** A creator's source by user id or handle (null when the engine doesn't follow them). Admins only. */
export function useCreatorSource(sourceKey: string) {
  const { isAdmin } = useAdminMode();
  return useQuery<SourceData | null>({
    queryKey: ["admin-source", sourceKey],
    queryFn: async () => {
      try {
        return await adminFetch<SourceData>(`/api/admin/sources/${sourceKey}`);
      } catch {
        return null;
      }
    },
    enabled: isAdmin,
    // While a sync runs, keep the strip current.
    refetchInterval: (q) => (["pending", "queued", "running"].includes(q.state.data?.source?.lastSync?.status ?? "") ? 10_000 : false),
  });
}

function useSourceWrite(sourceKey: string, sourceId: string | undefined) {
  return useMutation({
    mutationFn: ({ method, body }: { method: "PATCH" | "POST"; body?: Record<string, unknown> }) =>
      adminFetch<{ ok: boolean; queued?: boolean }>(`/api/admin/sources/${sourceId}`, { method, json: body ?? {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-source", sourceKey] });
      queryClient.invalidateQueries({ queryKey: ["admin-sources"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** A creator's settings menu: sync, pause, home city, notes for the engine, trust, sync history, re-process. */
export function SourceAdminMenu({ sourceKey, onAdminPage = false }: { sourceKey: string; onAdminPage?: boolean }) {
  const { data } = useCreatorSource(sourceKey);
  const source = data?.source;
  const write = useSourceWrite(sourceKey, source?.id);
  const [editing, setEditing] = React.useState<null | "homeCity" | "notes" | "history" | "reprocess">(null);
  if (!source) return null;

  const openEditor = (which: "homeCity" | "notes" | "history" | "reprocess") => setTimeout(() => setEditing(which), 100);
  const patch = (body: Record<string, unknown>, done?: string) =>
    write.mutate(
      { method: "PATCH", body },
      {
        onSuccess: () => {
          setEditing(null);
          if (done) toast.success(done);
        },
      },
    );
  const syncing = ["pending", "queued", "running"].includes(source.lastSync?.status ?? "");

  return (
    <>
      <AdminMenu label="Creator settings" testId="source-admin" onAdminPage={onAdminPage}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sync</DropdownMenuLabel>
          <AdminMenuItem
            icon={RefreshIcon}
            label={syncing ? "Syncing now" : "Sync now"}
            value={syncing ? undefined : lastSyncLabel(source).replace(/^Synced /, "")}
            disabled={syncing || source.status === "paused"}
            onClick={() =>
              write.mutate({ method: "POST" }, { onSuccess: (r) => toast.success(r.queued ? `Syncing @${source.handle}` : "The runner isn't reachable; try again") })
            }
            testId="button-source-sync"
          />
          <AdminMenuItem
            icon={source.status === "paused" ? PlayIcon : PauseIcon}
            label={source.status === "paused" ? "Resume syncing" : "Pause syncing"}
            onClick={() => patch({ status: source.status === "paused" ? "active" : "paused" }, source.status === "paused" ? "Syncing resumed" : "Syncing paused")}
            testId="button-source-pause"
          />
          <AdminMenuItem icon={Clock01Icon} label="Sync history" onClick={() => openEditor("history")} testId="button-source-history" />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Read agent</DropdownMenuLabel>
          <AdminMenuItem icon={Location01Icon} label="Home city" value={source.homeCity ?? "Not set"} onClick={() => openEditor("homeCity")} testId="button-source-home-city" />
          <AdminMenuItem icon={Note01Icon} label="Notes" value={source.notes ? "Set" : "None"} onClick={() => openEditor("notes")} testId="button-source-notes" />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger data-testid="button-source-trust">
              <HugeiconsIcon icon={StarIcon} />
              <span className="flex-1">Trust weight</span>
              <span className="text-xs text-muted-foreground">{source.trustWeight}×</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={String(source.trustWeight)} onValueChange={(v: string) => patch({ trustWeight: Number(v) })}>
                {TRUST.map((t) => (
                  <DropdownMenuRadioItem key={t.value} value={t.value} closeOnClick data-testid={`button-trust-${t.value}`}>
                    {t.label}
                    <span className="ml-auto pl-3 text-xs text-muted-foreground">{t.detail}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <AdminMenuItem icon={RepeatIcon} label="Re-process all posts" onClick={() => openEditor("reprocess")} testId="button-source-reprocess" />
      </AdminMenu>

      <ReprocessDialog source={source.id} label={`@${source.handle}'s posts`} open={editing === "reprocess"} onOpenChange={(o) => !o && setEditing(null)} />

      <EditFieldDialog
        open={editing === "homeCity"}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Home city"
        initialValue={source.homeCity ?? ""}
        placeholder="e.g. New York, NY"
        saving={write.isPending}
        onSave={(v) => patch({ homeCity: v.trim() || null })}
        testId="source-home-city"
      />
      <EditFieldDialog
        open={editing === "notes"}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Notes for the Read agent"
        initialValue={source.notes ?? ""}
        placeholder="e.g. Posts roundups as carousels; the places are in the alt text."
        multiline
        saving={write.isPending}
        onSave={(v) => patch({ notes: v.trim() || null })}
        testId="source-notes"
      />
      <Dialog open={editing === "history"} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent data-testid="dialog-sync-history">
          <DialogHeader>
            <DialogTitle>Sync history</DialogTitle>
            <DialogDescription>@{source.handle}&apos;s last {data?.syncs.length ?? 0} syncs.</DialogDescription>
          </DialogHeader>
          <div className="-mx-2 max-h-80 overflow-y-auto">
            {(data?.syncs ?? []).map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm" data-testid={`row-sync-${s.id}`}>
                <StatusDot status={s.status} />
                <span className="flex-1 truncate">{formatDistanceToNowStrict(new Date(s.createdAt), { addSuffix: true })}</span>
                <span className="text-xs text-muted-foreground">{s.error ? <span className="text-destructive">{s.error.slice(0, 60)}</span> : `${s.postsFetched} posts`}</span>
              </div>
            ))}
            {(data?.syncs.length ?? 0) === 0 && <p className="px-2 text-sm text-muted-foreground">No syncs yet.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
