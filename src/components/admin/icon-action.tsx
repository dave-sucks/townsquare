"use client";

/** A quiet icon button with a tooltip: the admin dialogs' secondary actions. */

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function IconAction({
  label,
  icon,
  onClick,
  disabled,
  danger,
  testId,
}: {
  label: string;
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"];
  onClick: () => void;
  disabled?: boolean;
  /** The armed state of a two-click action. */
  danger?: boolean;
  testId: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={danger ? "destructive" : "ghost"}
            size="icon-sm"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={cn(!danger && "text-muted-foreground")}
            data-testid={testId}
          />
        }
      >
        <HugeiconsIcon icon={icon} className="size-4" />
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
