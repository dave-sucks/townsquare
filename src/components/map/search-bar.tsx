"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Location01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  onOpen: () => void;
  searchQuery?: string;
  locationLabel?: string;
  isCustomLocation?: boolean;
  onClearLocation?: () => void;
  onClearSearch?: () => void;
  className?: string;
}

export function SearchBar({
  onOpen,
  searchQuery,
  locationLabel = "Your Location",
  isCustomLocation = false,
  onClearLocation,
  onClearSearch,
  className,
}: SearchBarProps) {
  const hasSearch = !!searchQuery?.trim();

  return (
    <div
      className={cn(
        "flex h-11 rounded-xl border bg-background shadow-lg overflow-hidden cursor-pointer",
        className
      )}
    >
      {/* ── Search side (~70%) ─────────────────────────────────── */}
      <button
        onClick={onOpen}
        className="flex items-center gap-2 flex-1 min-w-0 px-3 hover:bg-accent/50 transition-colors text-left"
        data-testid="search-bar-search"
      >
        <HugeiconsIcon
          icon={Search01Icon}
          className="h-4 w-4 text-muted-foreground shrink-0"
        />
        {hasSearch ? (
          <span className="flex-1 text-sm truncate">{searchQuery}</span>
        ) : (
          <span className="flex-1 text-sm text-muted-foreground">Search places…</span>
        )}
        {hasSearch && onClearSearch && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClearSearch();
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
          </button>
        )}
      </button>

      {/* ── Divider ─────────────────────────────────────────────── */}
      <div className="w-px bg-border my-2" />

      {/* ── Location side (~30%) ────────────────────────────────── */}
      <button
        onClick={onOpen}
        className={cn(
          "flex items-center gap-1.5 px-3 min-w-0 max-w-[36%] hover:bg-accent/50 transition-colors rounded-r-xl",
          !isCustomLocation && "bg-blue-50 dark:bg-blue-950/40"
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
            isCustomLocation ? "text-muted-foreground" : "text-blue-600 dark:text-blue-400"
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
