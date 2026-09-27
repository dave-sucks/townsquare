"use client";

/**
 * The one admin edit pattern: a stock shadcn DropdownMenu behind a ghost
 * icon-sm pencil, shown only in admin mode and placed next to the entity's
 * existing actions. Groups get a DropdownMenuLabel, separators split them,
 * and a destructive item comes last. An item can show the field's current
 * value on the right, muted, where a shortcut would sit.
 */

import * as React from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLinkItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAdminMode } from "@/components/admin/admin-mode";

type IconType = React.ComponentProps<typeof HugeiconsIcon>["icon"];

/** The pencil that opens an admin menu. Renders nothing outside admin mode. */
export const AdminEditButton = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button> & { label: string }>(
  function AdminEditButton({ label, className, ...props }, ref) {
    const { enabled } = useAdminMode();
    if (!enabled) return null;
    return (
      <Button ref={ref} variant="ghost" size="icon-sm" aria-label={label} className={className} {...props}>
        <HugeiconsIcon icon={PencilEdit01Icon} className="size-4" />
      </Button>
    );
  },
);

export function AdminMenu({
  label,
  testId,
  align = "end",
  children,
}: {
  /** The pencil's accessible label. */
  label: string;
  testId: string;
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}) {
  const { enabled } = useAdminMode();
  if (!enabled) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<AdminEditButton label={label} data-testid={`button-${testId}`} />} />
      <DropdownMenuContent align={align} className="w-60" data-testid={testId}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminMenuItem({
  icon,
  label,
  value,
  onClick,
  href,
  destructive,
  disabled,
  testId,
}: {
  icon: IconType;
  label: string;
  /** The field's current value, muted on the right. */
  value?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
  testId: string;
}) {
  const body = (
    <>
      <HugeiconsIcon icon={icon} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value != null && <span className="ml-auto max-w-28 shrink-0 truncate pl-3 text-xs text-muted-foreground">{value}</span>}
    </>
  );
  if (href) {
    return (
      <DropdownMenuLinkItem render={<Link href={href} />} data-testid={testId}>
        {body}
      </DropdownMenuLinkItem>
    );
  }
  return (
    <DropdownMenuItem variant={destructive ? "destructive" : "default"} onClick={onClick} disabled={disabled} data-testid={testId}>
      {body}
    </DropdownMenuItem>
  );
}
