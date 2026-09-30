"use client";

/**
 * ChatMapProvider — shared state between the chat's place lists, the chat
 * panel and the map (docs/AGENT_CHAT_REBUILD.md §8).
 *
 *   resultSets    toolCallId → a list the agent made, registered by each
 *                 PlaceListRenderer (its card in the chat)
 *   activeSetId   the list the map shows: the newest, or whichever the user
 *                 last hovered or opened
 *   stack         what the panel shows over the chat, the way the app's list
 *                 pages go list → place: [] is the chat, then a list, then a
 *                 place. Back pops one.
 *   selectedKey   the selected place (googlePlaceId), from a row or a marker
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
import type { CreatorHeader, PlaceRow } from "@/lib/agent/place-row";

export type ResultSet = {
  places: PlaceRow[];
  /** The list's name, e.g. "Burgers in West Village". */
  title: string;
  /** What the agent did, e.g. "Searched Townsquare for burgers". */
  label: string;
  total: number;
  creator?: CreatorHeader;
};

export type PanelView = { kind: "list"; setId: string } | { kind: "place"; setId: string; key: string };

type ChatMapValue = {
  resultSets: Map<string, ResultSet>;
  activeSetId: string | null;
  activePlaces: PlaceRow[];
  stack: PanelView[];
  selectedKey: string | null;
  registerResultSet: (id: string, set: ResultSet) => void;
  activateSet: (id: string) => void;
  setSelected: (key: string | null) => void;
  /** Open a list over the chat. */
  openList: (setId: string) => void;
  /** Open a place's detail over its list (over the chat when it's a lone place). */
  openPlace: (setId: string, key: string) => void;
  back: () => void;
  /** The big map's pan function (ChatShell registers PlaceMap's handle). */
  setPanHandler: (fn: ((lat: number, lng: number) => void) | null) => void;
  panTo: (lat: number, lng: number) => void;
};

const ChatMapContext = createContext<ChatMapValue | null>(null);

export function ChatMapProvider({ children, resetKey }: { children: ReactNode; resetKey?: string }) {
  const [resultSets, setResultSets] = useState<Map<string, ResultSet>>(() => new Map());
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [stack, setStack] = useState<PanelView[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const panRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const setsRef = useRef(resultSets);
  useEffect(() => {
    setsRef.current = resultSets;
  }, [resultSets]);

  // A different conversation starts with an empty map, back on the chat.
  useEffect(() => {
    setResultSets(new Map());
    setActiveSetId(null);
    setStack([]);
    setSelectedKey(null);
  }, [resetKey]);

  const registerResultSet = useCallback((id: string, set: ResultSet) => {
    setResultSets((prev) => {
      const existing = prev.get(id);
      if (
        existing &&
        existing.title === set.title &&
        existing.places.length === set.places.length &&
        existing.places.every((p, i) => p.googlePlaceId === set.places[i].googlePlaceId)
      ) {
        return prev;
      }
      const next = new Map(prev);
      next.set(id, set);
      return next;
    });
    // Newest list wins: renderers mount in thread order, so the last one
    // registered is the latest answer.
    if (set.places.length > 0) setActiveSetId(id);
  }, []);

  const activateSet = useCallback((id: string) => setActiveSetId(id), []);
  const setSelected = useCallback((key: string | null) => setSelectedKey(key), []);

  const openList = useCallback((setId: string) => {
    setActiveSetId(setId);
    setSelectedKey(null);
    setStack([{ kind: "list", setId }]);
  }, []);

  const openPlace = useCallback((setId: string, key: string) => {
    setActiveSetId(setId);
    setSelectedKey(key);
    const lone = (setsRef.current.get(setId)?.places.length ?? 0) <= 1;
    setStack(lone ? [{ kind: "place", setId, key }] : [{ kind: "list", setId }, { kind: "place", setId, key }]);
  }, []);

  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);

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
      activePlaces: (activeSetId && resultSets.get(activeSetId)?.places) || [],
      stack,
      selectedKey,
      registerResultSet,
      activateSet,
      setSelected,
      openList,
      openPlace,
      back,
      setPanHandler,
      panTo,
    }),
    [resultSets, activeSetId, stack, selectedKey, registerResultSet, activateSet, setSelected, openList, openPlace, back, setPanHandler, panTo],
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
  stack: [],
  selectedKey: null,
  registerResultSet: () => {},
  activateSet: () => {},
  setSelected: () => {},
  openList: () => {},
  openPlace: () => {},
  back: () => {},
  setPanHandler: () => {},
  panTo: () => {},
};
