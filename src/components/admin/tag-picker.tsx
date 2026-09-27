"use client";

/**
 * Tag chips an admin can edit: each chip shows a remove control on hover,
 * and a trailing "Add tag" chip opens a taxonomy search (Popover + Command
 * over the active tags), or, `inline`, the same search under the chips (for
 * use inside a Drawer, which sits above popovers).
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { apiRequest } from "@/lib/query-client";

export type ChipTag = { slug: string; displayName: string; source?: string };

type TaxonomyResponse = {
  categories: { slug: string; displayName: string; tags: { slug: string; displayName: string }[] }[];
};

export function EditableTagChips({
  tags,
  onRemove,
  onAdd,
  disabled,
  inline = false,
  testId,
}: {
  tags: ChipTag[];
  onRemove: (slug: string) => void;
  onAdd: (slug: string, displayName: string) => void;
  disabled?: boolean;
  inline?: boolean;
  testId: string;
}) {
  const [open, setOpen] = React.useState(false);
  const { data } = useQuery<TaxonomyResponse>({ queryKey: ["tags"], queryFn: () => apiRequest("/api/tags"), staleTime: 5 * 60_000, enabled: open });
  const current = new Set(tags.map((t) => t.slug));

  const search = (
    <Command>
      <CommandInput placeholder="Search tags..." autoFocus={inline} data-testid={`input-${testId}-search`} />
      <CommandList className={inline ? "max-h-48" : "max-h-64"}>
        <CommandEmpty>No tags found.</CommandEmpty>
        {(data?.categories ?? []).map((c) => (
          <CommandGroup key={c.slug} heading={c.displayName}>
            {c.tags
              .filter((t) => !current.has(t.slug))
              .map((t) => (
                <CommandItem
                  key={t.slug}
                  value={`${t.displayName} ${t.slug.replace(/_/g, " ")}`}
                  onSelect={() => {
                    onAdd(t.slug, t.displayName);
                    setOpen(false);
                  }}
                  data-testid={`option-${testId}-${t.slug}`}
                >
                  {t.displayName}
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
  const addChip = (
    <Badge variant="outline" className="font-normal gap-1 text-muted-foreground hover:bg-accent">
      <HugeiconsIcon icon={PlusSignIcon} className="size-3" />
      Add tag
    </Badge>
  );

  return (
    <div className="flex flex-wrap gap-1.5" data-testid={testId}>
      {tags.map((t) => (
        <Badge key={t.slug} variant="secondary" className="group/chip font-normal gap-1 pr-1" data-testid={`${testId}-${t.slug}`}>
          {t.displayName}
          <button
            type="button"
            aria-label={`Remove ${t.displayName}`}
            disabled={disabled}
            onClick={() => onRemove(t.slug)}
            className="opacity-40 transition-opacity group-hover/chip:opacity-100 hover:text-destructive"
            data-testid={`button-remove-${testId}-${t.slug}`}
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
          </button>
        </Badge>
      ))}
      {inline ? (
        <>
          <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} data-testid={`button-add-${testId}`}>
            {addChip}
          </button>
          {open && <div className="basis-full rounded-lg border">{search}</div>}
        </>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <button type="button" disabled={disabled} data-testid={`button-add-${testId}`}>
                {addChip}
              </button>
            }
          />
          <PopoverContent className="w-64 p-0" align="start">
            {search}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
