"use client";

/** The admin place route's one write hook, shared by the place page's admin controls. */

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest, queryClient } from "@/lib/query-client";

export function adminPlaceKey(googlePlaceId: string) {
  return ["admin-place", googlePlaceId];
}

/** POST or PATCH /api/admin/places/[id], then refresh the page and the panel. */
export function usePlaceWrite(googlePlaceId: string) {
  return useMutation({
    mutationFn: ({ method, body }: { method: "PATCH" | "POST"; body: Record<string, unknown> }) =>
      apiRequest<{ ok: boolean; intoGooglePlaceId?: string }>(`/api/admin/places/${googlePlaceId}`, {
        method,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["place-detail", googlePlaceId] });
      queryClient.invalidateQueries({ queryKey: adminPlaceKey(googlePlaceId) });
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't save"),
  });
}
