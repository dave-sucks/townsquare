"use client";

import { useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Location01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  /** Controlled value from parent state */
  searchQuery?: string;
  /** Called on every keystroke — updates parent state */
  onSearchQueryChange?: (q: string) => void;
  /** Called when input is focused — switches panel to search view */
  onOpen?: () => void;
  locationLabel?: string;
  isCustomLocation?: boolean;
  onClearLocation?: () => void;
  onClearSearch?: () => void;
  className?: string;
}

export function SearchBar({
  searchQuery = "",
  onSearchQueryChange,
  onOpen,
  locationLabel = "My Location",
  isCustomLocation = false,
  onClearLocation,
  onClearSearch,
  className,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        "flex h-11 rounded-xl border bg-background shadow-lg overflow-hidden",
        className
      )}
    >
      {/* ── Search input ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-1 min-w-0 px-3">
        <HugeiconsIcon
          icon={Search01Icon}
          className="h-4 w-4 text-muted-foreground shrink-0"
        />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange?.(e.target.value)}
          onFocus={() => onOpen?.()}
          placeholder="Search places…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
          data-testid="search-bar-input"
        />
        {searchQuery && (
          <button
            onClick={() => {
              onClearSearch?.();
              inputRef.current?.focus();
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── Divider ─────────────────────────────────────────────── */}
      <div className="w-px bg-border my-2" />

      {/* ── Location context ────────────────────────────────────── */}
      <button
        onClick={() => {
          inputRef.current?.focus();
          onOpen?.();
        }}
        className={cn(
          "flex items-center gap-1.5 px-3 max-w-[38%] min-w-0 transition-colors rounded-r-xl",
          isCustomLocation
            ? "bg-background hover:bg-accent/50"
            : "bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/60"
        )}
        data-testid="search-bar-location"
      >
        <HugeiconsIcon
          icon={Location01Icon}
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            isCustomLocation ? "text-muted-foreground" : "text-blue-500"
          )}
        />
        <span
          className={cn(
            "text-xs font-medium truncate",
            isCustomLocation
              ? "text-muted-foreground"
              : "text-blue-600 dark:text-blue-400"
          )}
        >
          {locationLabel}
        </span>
        {isCustomLocation && onClearLocation && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClearLocation();
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground ml-0.5"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
          </button>
        )}
      </button>
    </div>
  );
}
