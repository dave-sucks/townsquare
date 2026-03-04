"use client";

import { useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Location01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";

interface SearchBarProps {
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
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
    <ButtonGroup className={cn("w-full shadow-md", className)}>
      {/* ── Search input ─────────────────────────────────────────────── */}
      <div className="relative flex flex-1 items-center border rounded-lg bg-background">
        <HugeiconsIcon
          icon={Search01Icon}
          className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange?.(e.target.value)}
          onFocus={() => onOpen?.()}
          placeholder="Search places…"
          className="flex-1 h-11 bg-transparent pl-9 pr-8 text-sm outline-none placeholder:text-muted-foreground min-w-0"
          data-testid="search-bar-input"
        />
        {searchQuery && (
          <button
            onClick={() => {
              onClearSearch?.();
              inputRef.current?.focus();
            }}
            className="absolute right-3 text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <ButtonGroupSeparator />

      {/* ── Location button ───────────────────────────────────────────── */}
      <button
        onClick={() => {
          inputRef.current?.focus();
          onOpen?.();
        }}
        className={cn(
          "flex h-11 shrink-0 items-center gap-1.5 border rounded-lg px-3 text-xs font-medium transition-colors max-w-[38%]",
          isCustomLocation
            ? "bg-background text-muted-foreground hover:bg-accent"
            : "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/60"
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
        <span className="truncate">{locationLabel}</span>
        {isCustomLocation && onClearLocation && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClearLocation();
            }}
            className="ml-0.5 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
          </button>
        )}
      </button>
    </ButtonGroup>
  );
}
