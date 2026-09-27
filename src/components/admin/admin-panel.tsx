"use client";

/**
 * The one admin edit pattern: a clone of SaveToListDropdown's panel.
 * Popover w-80 p-0 on desktop, Drawer on mobile; a px-4 pt-4 pb-3 header;
 * uppercase eyebrows; py-3 px-4 hover:bg-accent rows; a destructive last row
 * with border-t. The trigger is a ghost icon-sm pencil, shown only in admin
 * mode.
 */

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAdminMode } from "@/components/admin/admin-mode";
import { cn } from "@/lib/utils";

type IconType = React.ComponentProps<typeof HugeiconsIcon>["icon"];

/** The pencil that opens an admin panel. Renders nothing outside admin mode. */
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

export function AdminPanel({
  title,
  subtitle,
  label,
  open,
  onOpenChange,
  children,
  testId,
  align = "end",
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** The pencil's accessible label. */
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  testId: string;
  align?: "start" | "center" | "end";
}) {
  const isMobile = useIsMobile();
  const { enabled } = useAdminMode();
  if (!enabled) return null;

  const content = (
    <div data-testid={testId} className="flex flex-col">
      <div className="px-4 pt-4 pb-3 text-left">
        <p className="font-semibold text-lg leading-tight truncate">{title}</p>
        {subtitle && <p className="text-sm text-muted-foreground truncate mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <AdminEditButton label={label} onClick={() => onOpenChange(true)} data-testid={`button-${testId}`} />
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent data-testid={`${testId}-drawer`}>
            <DrawerTitle className="sr-only">{label}</DrawerTitle>
            <div className="overflow-y-auto max-h-[80vh]">{content}</div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={<AdminEditButton label={label} data-testid={`button-${testId}`} />} />
      <PopoverContent align={align} className="w-80 p-0 z-[200] max-h-[80vh] overflow-y-auto" initialFocus={false}>
        {content}
      </PopoverContent>
    </Popover>
  );
}

export function AdminPanelSection({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("border-t", className)}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 pt-3 pb-2">{label}</p>
      {children}
    </div>
  );
}

export function AdminPanelRow({
  icon,
  label,
  detail,
  onClick,
  disabled,
  pending,
  destructive,
  testId,
  href,
}: {
  icon: IconType;
  label: string;
  /** The current value, on the right. */
  detail?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  pending?: boolean;
  /** The last, destructive row: border-t, red on hover. */
  destructive?: boolean;
  testId: string;
  href?: string;
}) {
  const className = cn(
    "flex items-center gap-3 w-full text-left py-3 px-4 hover:bg-accent transition-colors disabled:opacity-50",
    destructive && "text-muted-foreground hover:text-destructive border-t",
  );
  const body = (
    <>
      <HugeiconsIcon icon={pending ? Loading03Icon : icon} className={cn("h-5 w-5 shrink-0", pending && "animate-spin")} />
      <span className="flex-1 min-w-0 text-base font-medium truncate">{label}</span>
      {detail != null && <span className="shrink-0 max-w-[45%] truncate text-sm text-muted-foreground">{detail}</span>}
    </>
  );
  if (href) {
    return (
      <a href={href} className={className} data-testid={testId}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled || pending} data-testid={testId}>
      {body}
    </button>
  );
}
