"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/query-client";

interface ActiveFilters {
  tags: string[];
  price: string | null;
  sort: string;
}

interface FiltersPanelProps {
  onBack: () => void;
  activeFilters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
}

interface TagCategory {
  id: string;
  slug: string;
  displayName: string;
  tags: Array<{ id: string; slug: string; displayName: string }>;
}

const PRICE_OPTIONS = [
  { label: "$", value: "PRICE_LEVEL_INEXPENSIVE" },
  { label: "$$", value: "PRICE_LEVEL_MODERATE" },
  { label: "$$$", value: "PRICE_LEVEL_EXPENSIVE" },
  { label: "$$$$", value: "PRICE_LEVEL_VERY_EXPENSIVE" },
];

export function FiltersPanel({ onBack, activeFilters, onFiltersChange }: FiltersPanelProps) {
  const { data: tagsData, isLoading } = useQuery<{ categories: TagCategory[] }>({
    queryKey: ["tags"],
    queryFn: () => apiRequest("/api/tags"),
    staleTime: 5 * 60 * 1000,
  });

  const toggleTag = (slug: string) => {
    const tags = activeFilters.tags.includes(slug)
      ? activeFilters.tags.filter((t) => t !== slug)
      : [...activeFilters.tags, slug];
    onFiltersChange({ ...activeFilters, tags });
  };

  const togglePrice = (value: string) => {
    onFiltersChange({
      ...activeFilters,
      price: activeFilters.price === value ? null : value,
    });
  };

  const clearAll = () => {
    onFiltersChange({ tags: [], price: null, sort: "default" });
  };

  const activeCount = activeFilters.tags.length + (activeFilters.price ? 1 : 0);

  return (
    <div className="h-full flex flex-col bg-background" data-testid="filters-panel">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8 shrink-0"
          data-testid="button-filters-back"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
        </Button>
        <span className="font-semibold text-sm font-brand flex-1">Filters</span>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-clear-filters"
          >
            Clear all ({activeCount})
          </button>
        )}
      </div>

      {/* ── Scrollable filter content ────────────────────────────────────── */}
      <ScrollArea className="flex-1">
        <div className="px-3 py-4 space-y-6">
          {/* Price */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Price
            </p>
            <div className="flex gap-2">
              {PRICE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => togglePrice(opt.value)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                    activeFilters.price === opt.value
                      ? "bg-foreground text-background border-foreground"
                      : "border-input bg-background hover:bg-accent"
                  )}
                  data-testid={`filter-price-${opt.label}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tag categories from DB */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <Skeleton key={j} className="h-8 w-20 rounded-lg" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            tagsData?.categories.map((cat) => (
              <div key={cat.slug}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {cat.displayName}
                </p>
                <div className="flex flex-wrap gap-2">
                  {cat.tags.map((tag) => {
                    const isActive = activeFilters.tags.includes(tag.slug);
                    return (
                      <button
                        key={tag.slug}
                        onClick={() => toggleTag(tag.slug)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                          isActive
                            ? "bg-foreground text-background border-foreground"
                            : "border-input bg-background hover:bg-accent"
                        )}
                        data-testid={`filter-tag-${tag.slug}`}
                      >
                        {tag.displayName}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
