"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { LeftToRightListBulletIcon, ArrowRight01Icon, PinLocation01Icon } from "@hugeicons/core-free-icons";

interface ListChipProps {
  id?: string;
  name: string;
  href: string;
  count?: number;
  icon?: "list" | "pin";
}

export function ListChip({ id, name, href, count, icon = "list" }: ListChipProps) {
  const iconComponent = icon === "pin" ? PinLocation01Icon : LeftToRightListBulletIcon;

  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover-elevate shrink-0"
      data-testid={id ? `list-chip-${id}` : "link-all-saved-places"}
    >
      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
        <HugeiconsIcon icon={iconComponent} className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium whitespace-nowrap">{name}</p>
        {count !== undefined && (
          <p className="text-xs text-muted-foreground">{count} places</p>
        )}
      </div>
      <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </Link>
  );
}
