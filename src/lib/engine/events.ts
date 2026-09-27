/**
 * Sending engine events from API routes. An admin's write has already
 * landed when these go out; if Inngest isn't reachable (no event key in an
 * environment yet), the write still stands and the error is logged.
 */

import { inngest, placeChanged, postReprocess, sourceSync } from "./inngest";

async function send(label: string, events: Parameters<typeof inngest.send>[0]) {
  try {
    await inngest.send(events);
    return true;
  } catch (err) {
    console.error(`[engine/events] ${label}:`, err instanceof Error ? err.message : err);
    return false;
  }
}

export const refreshPlaces = (placeIds: string[], opts: { force?: boolean } = {}) =>
  placeIds.length === 0
    ? Promise.resolve(true)
    : send("place.changed", placeIds.map((placeId) => placeChanged.create({ placeId, ...(opts.force ? { force: true } : {}) })));

export const reprocessPost = (postId: string, opts: { requestedBy: string; fromStage?: string }) =>
  send("post.reprocess", postReprocess.create({ postId, requestedBy: opts.requestedBy, ...(opts.fromStage ? { fromStage: opts.fromStage } : {}) }));

export const syncSourceNow = (sourceId: string) => send("source.sync", sourceSync.create({ sourceId }));
