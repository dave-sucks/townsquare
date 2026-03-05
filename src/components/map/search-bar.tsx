"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, PinLocation03Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";

const MAX_LABEL = 14;

interface SearchBarProps {
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
  locationLabel?: string;
  isCustomLocation?: boolean;
  onClearLocation?: () => void;
  onClearSearch?: () => void;
  isSearchOpen?: boolean;
  className?: string;
}

export function SearchBar({
  searchQuery = "",
  onSearchQueryChange,
  onOpen,
  onClose,
  locationLabel = "Nearby",
  isCustomLocation = false,
  onClearLocation: _onClearLocation,
  onClearSearch: _onClearSearch,
  isSearchOpen = false,
  className,
}: SearchBarProps) {
  const displayLabel = isCustomLocation
    ? locationLabel.length > MAX_LABEL
      ? locationLabel.slice(0, MAX_LABEL) + "…"
      : locationLabel
    : "Nearby";

  return (
    <div className={cn(className)}>
      <InputGroup className="h-11 shadow-md bg-background">
        <InputGroupAddon align="inline-start">
          <HugeiconsIcon icon={Search01Icon} className="size-4 text-muted-foreground" />
        </InputGroupAddon>

        <InputGroupInput
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange?.(e.target.value)}
          onFocus={() => onOpen?.()}
          placeholder="Search places…"
        />

        <InputGroupAddon align="inline-end">
          {isSearchOpen ? (
            /* X button to close the search panel */
            <InputGroupButton
              size="icon-xs"
              variant="ghost"
              onClick={onClose}
              aria-label="Close search"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3.5 text-muted-foreground" />
            </InputGroupButton>
          ) : (
            /* Location badge — no X, just icon + label */
            <button
              type="button"
              onClick={() => onOpen?.()}
              className={cn(
                "flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium transition-colors",
                isCustomLocation
                  ? "bg-muted text-muted-foreground hover:bg-muted/80"
                  : "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-950/70"
              )}
            >
              <HugeiconsIcon
                icon={PinLocation03Icon}
                className={cn(
                  "size-3 shrink-0",
                  isCustomLocation ? "text-muted-foreground" : "text-blue-500"
                )}
              />
              <span>{displayLabel}</span>
            </button>
          )}
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
