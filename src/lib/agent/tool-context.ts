/**
 * ToolContext — per-request context threaded through every tool execution.
 * Ported from Hindsight lib/agent/tool-context.ts, shrunk to what the chat
 * needs: who's asking, which conversation, and where they're looking.
 */

export type LatLng = { lat: number; lng: number };
export type MapBounds = { north: number; south: number; east: number; west: number };

export interface ToolContext {
  userId: string;
  conversationId: string;
  /** The user's location (useUserLocation), when the browser shared it. */
  location?: LatLng;
  /** The map's visible bounds when the message was sent ("this area"). */
  mapBounds?: MapBounds;

  /**
   * Returns a stable group key for the given phase string.
   * Consecutive tool calls returning the same groupId collapse into one UI group.
   * A non-grouped tool (action tool) returns no groupId, breaking the chain.
   */
  groupId(phase: string): string;
}

/** Create a ToolContext from plain options (adds the groupId method). */
export function createToolContext(opts: Omit<ToolContext, "groupId">): ToolContext {
  return {
    ...opts,
    groupId(phase: string): string {
      return phase;
    },
  };
}
