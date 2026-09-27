"use client";

/**
 * Pick a Google place: the import page's place search (Google autocomplete
 * through /api/places/search), as an input with a results popover, or with
 * the results listed under it (`inline`, for use inside a Drawer, which sits
 * above popovers).
 */

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Loading03Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent } from "@/components/ui/popover";

export type PickedPlace = { googlePlaceId: string; name: string; address: string };

type Prediction = { place_id: string; description?: string; structured_formatting?: { main_text?: string; secondary_text?: string } };

export function PlaceSearch({
  onPick,
  placeholder = "Search for a place...",
  autoFocus = false,
  inline = false,
  initialQuery = "",
  testId = "place-search",
}: {
  onPick: (place: PickedPlace) => void;
  placeholder?: string;
  autoFocus?: boolean;
  inline?: boolean;
  /** Search for this right away (e.g. the name the post used). */
  initialQuery?: string;
  testId?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PickedPlace[]>([]);
  const [searching, setSearching] = React.useState(false);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (q: string) => {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { predictions?: Prediction[] };
        setResults(
          (data.predictions ?? []).map((p) => ({
            googlePlaceId: p.place_id,
            name: p.structured_formatting?.main_text || p.description || "",
            address: p.structured_formatting?.secondary_text || "",
          })),
        );
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  React.useEffect(() => {
    if (initialQuery) search(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const open = query.trim().length >= 2;

  const resultList = searching ? (
    <div className="flex items-center gap-2 py-3 px-3 text-sm text-muted-foreground">
      <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
      Searching...
    </div>
  ) : results.length === 0 ? (
    <p className="text-sm text-muted-foreground text-center py-3">No results</p>
  ) : (
    <div className="divide-y">
      {results.map((p) => (
        <button
          key={p.googlePlaceId}
          type="button"
          className="flex w-full flex-col items-start px-3 py-2.5 text-left hover:bg-accent"
          onClick={() => {
            onPick(p);
            search("");
          }}
          data-testid={`${testId}-result-${p.googlePlaceId}`}
        >
          <span className="text-sm font-medium truncate max-w-full">{p.name}</span>
          <span className="text-xs text-muted-foreground truncate max-w-full">{p.address}</span>
        </button>
      ))}
    </div>
  );

  const input = (
    <div ref={anchorRef} className="relative">
      <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(e) => search(e.target.value)}
        className="pl-9"
        autoFocus={autoFocus}
        style={{ fontSize: "16px" }}
        data-testid={`input-${testId}`}
      />
      {query && (
        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => search("")} aria-label="Clear">
          <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );

  if (inline) {
    return (
      <div className="space-y-1">
        {input}
        {open && <div className="rounded-lg border max-h-60 overflow-y-auto">{resultList}</div>}
      </div>
    );
  }
  return (
    <Popover open={open}>
      {input}
      <PopoverContent className="p-0 w-(--anchor-width) max-h-60 overflow-y-auto" align="start" sideOffset={4} anchor={anchorRef} initialFocus={false}>
        {resultList}
      </PopoverContent>
    </Popover>
  );
}
