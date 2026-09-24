"use client";

/**
 * ChatMapProvider — shared state between place-list tool results and the map
 * (docs/AGENT_CHAT_REBUILD.md §8).
 *
 *   resultSets    toolCallId → PlaceRow[], registered by each PlaceListRenderer
 *   activeSetId   the set the map shows: the newest registered, or whichever
 *                 older list the user last hovered/touched
 *   selectedKey   the selected place (googlePlaceId), from a row or a marker
 *
 * Clicking a row selects it and pans the map (via the registered pan
 * function); clicking a marker selects it and scrolls its row into view (via
 * the registered row elements).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PlaceRow } from "@/lib/agent/place-row";

type SelectSource = "map" | "list" | "carousel";

type ChatMapValue = {
  resultSets: Map<string, PlaceRow[]>;
  activeSetId: string | null;
  activePlaces: PlaceRow[];
  selectedKey: string | null;
  selectSource: SelectSource | null;
  registerResultSet: (id: string, places: PlaceRow[]) => void;
  activateSet: (id: string) => void;
  setSelected: (key: string | null, source: SelectSource) => void;
  /** Row elements, keyed `${setId}:${googlePlaceId}`, for scroll-into-view. */
  registerRow: (setId: string, key: string, el: HTMLElement | null) => void;
  /** The big map's pan function (ChatShell registers PlaceMap's handle). */
  setPanHandler: (fn: ((lat: number, lng: number) => void) | null) => void;
  panTo: (lat: number, lng: number) => void;
};

const ChatMapContext = createContext<ChatMapValue | null>(null);

export function ChatMapProvider({ children, resetKey }: { children: ReactNode; resetKey?: string }) {
  const [resultSets, setResultSets] = useState<Map<string, PlaceRow[]>>(() => new Map());
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectSource, setSelectSource] = useState<SelectSource | null>(null);
  const rows = useRef(new Map<string, HTMLElement>());
  const panRef = useRef<((lat: number, lng: number) => void) | null>(null);

  // A different conversation starts with an empty map.
  useEffect(() => {
    setResultSets(new Map());
    setActiveSetId(null);
    setSelectedKey(null);
    rows.current.clear();
  }, [resetKey]);

  const registerResultSet = useCallback((id: string, places: PlaceRow[]) => {
    setResultSets((prev) => {
      const existing = prev.get(id);
      if (existing && existing.length === places.length && existing.every((p, i) => p.googlePlaceId === places[i].googlePlaceId)) {
        return prev;
      }
      const next = new Map(prev);
      next.set(id, places);
      return next;
    });
    // Newest set wins: renderers mount in thread order, so the last one
    // registered is the latest answer.
    if (places.length > 0) setActiveSetId(id);
  }, []);

  const activateSet = useCallback((id: string) => {
    setActiveSetId((cur) => (cur === id ? cur : id));
  }, []);

  const setSelected = useCallback((key: string | null, source: SelectSource) => {
    setSelectedKey(key);
    setSelectSource(source);
    if (key && source === "map") {
      // Scroll the matching row (in the active set) into view.
      for (const [k, el] of rows.current) {
        if (k.endsWith(`:${key}`)) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          break;
        }
      }
    }
  }, []);

  const registerRow = useCallback((setId: string, key: string, el: HTMLElement | null) => {
    const k = `${setId}:${key}`;
    if (el) rows.current.set(k, el);
    else rows.current.delete(k);
  }, []);

  const setPanHandler = useCallback((fn: ((lat: number, lng: number) => void) | null) => {
    panRef.current = fn;
  }, []);

  const panTo = useCallback((lat: number, lng: number) => {
    panRef.current?.(lat, lng);
  }, []);

  const value = useMemo<ChatMapValue>(
    () => ({
      resultSets,
      activeSetId,
      activePlaces: (activeSetId && resultSets.get(activeSetId)) || [],
      selectedKey,
      selectSource,
      registerResultSet,
      activateSet,
      setSelected,
      registerRow,
      setPanHandler,
      panTo,
    }),
    [resultSets, activeSetId, selectedKey, selectSource, registerResultSet, activateSet, setSelected, registerRow, setPanHandler, panTo],
  );

  return <ChatMapContext.Provider value={value}>{children}</ChatMapContext.Provider>;
}

/** The chat ↔ map bridge. Outside a provider it's inert (lists still render). */
export function useChatMap(): ChatMapValue {
  const ctx = useContext(ChatMapContext);
  return ctx ?? INERT;
}

const INERT: ChatMapValue = {
  resultSets: new Map(),
  activeSetId: null,
  activePlaces: [],
  selectedKey: null,
  selectSource: null,
  registerResultSet: () => {},
  activateSet: () => {},
  setSelected: () => {},
  registerRow: () => {},
  setPanHandler: () => {},
  panTo: () => {},
};
