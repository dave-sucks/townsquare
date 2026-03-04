"use client";

import { useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Location01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";

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
    // Outer div is relative so we can float the search icon over the Input
    // without adding a wrapper div INSIDE ButtonGroup (which causes double borders)
    <div className={cn("relative", className)}>
      <HugeiconsIcon
        icon={Search01Icon}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-4 w-4 text-muted-foreground pointer-events-none"
      />

      <ButtonGroup className="w-full shadow-md">
        {/* Direct Input child — ButtonGroup strips its right radius + right border */}
        <Input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange?.(e.target.value)}
          onFocus={() => onOpen?.()}
          placeholder="Search places…"
          className="h-11 pl-9"
          data-testid="search-bar-input"
        />

        {/* Direct button child — ButtonGroup strips its left radius + left border */}
        <button
          onClick={() => {
            inputRef.current?.focus();
            onOpen?.();
          }}
          className={cn(
            "flex h-11 shrink-0 items-center gap-1.5 border rounded-md px-3 text-xs font-medium transition-colors",
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
          <span className="truncate max-w-[100px]">{locationLabel}</span>
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
    </div>
  );
}
