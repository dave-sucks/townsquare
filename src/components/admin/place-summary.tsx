"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAdminMode } from "@/components/admin/admin-mode";
import { usePlaceWrite } from "@/components/admin/place-write";

/**
 * The About block. Outside admin mode it renders exactly as before; in admin
 * mode it gains Edit, and editing swaps the text for a textarea with Cancel
 * and Save.
 */
export function PlaceSummary({ googlePlaceId, summary }: { googlePlaceId: string; summary: string | null | undefined }) {
  const { enabled } = useAdminMode();
  const write = usePlaceWrite(googlePlaceId);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(summary ?? "");

  if (!summary && !enabled) return null;

  const save = () =>
    write.mutate(
      { method: "POST", body: { action: "summary", summary: draft.trim() } },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success("Summary saved");
        },
      },
    );

  return (
    <div className="space-y-2" data-testid="section-about">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">About</h3>
        {enabled && !editing && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              setDraft(summary ?? "");
              setEditing(true);
            }}
            data-testid="button-edit-summary"
          >
            Edit
          </Button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-28 text-sm"
            style={{ fontSize: "16px" }}
            autoFocus
            data-testid="input-summary"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} data-testid="button-cancel-summary">
              Cancel
            </Button>
            <Button size="sm" disabled={!draft.trim() || draft.trim() === (summary ?? "").trim() || write.isPending} onClick={save} data-testid="button-save-summary">
              {write.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : summary ? (
        <p className="text-base text-muted-foreground">{summary}</p>
      ) : (
        <p className="text-sm text-muted-foreground">No summary yet.</p>
      )}
    </div>
  );
}
