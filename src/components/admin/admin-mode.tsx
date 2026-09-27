"use client";

import * as React from "react";
import { useAuth } from "@/hooks/use-auth";

/**
 * Admin mode turns the product pages into the internal tool: when it's on,
 * admins see edit controls on posts, places and creators. The switch lives
 * in the nav's user menu; its state is per browser (localStorage).
 */

const STORAGE_KEY = "twnsq-admin-mode";

// localStorage as an external store, so every consumer (and other tabs)
// updates together, and server renders read "off".
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStored(on: boolean) {
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the switch just won't persist.
  }
  listeners.forEach((l) => l());
}

type AdminModeState = {
  /** The viewer is an admin (their email is in ADMIN_EMAILS). */
  isAdmin: boolean;
  /** Admin controls are showing. Always false for non-admins. */
  enabled: boolean;
  setEnabled: (on: boolean) => void;
};

const AdminModeContext = React.createContext<AdminModeState>({
  isAdmin: false,
  enabled: false,
  setEnabled: () => {},
});

export function AdminModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);
  const stored = React.useSyncExternalStore(subscribe, readStored, () => false);

  const value = React.useMemo<AdminModeState>(
    () => ({ isAdmin, enabled: isAdmin && stored, setEnabled: writeStored }),
    [isAdmin, stored],
  );

  return <AdminModeContext.Provider value={value}>{children}</AdminModeContext.Provider>;
}

export function useAdminMode(): AdminModeState {
  return React.useContext(AdminModeContext);
}
