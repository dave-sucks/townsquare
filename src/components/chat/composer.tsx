"use client";

/**
 * Townsquare chat composer — the trimmed counterpart of Hindsight's
 * HindsightComposer: an autosizing input with send / stop. No attachments,
 * no model picker. @creator mentions and suggestion chips land in phase 5.
 */

import type { FC } from "react";
import { AuiIf, ComposerPrimitive } from "@assistant-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp02Icon, StopIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

export const Composer: FC<{ placeholder?: string }> = ({ placeholder = "Ask about places, creators, plans…" }) => {
  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col rounded-2xl border border-input bg-background shadow-xs transition-colors focus-within:border-ring/60">
      <ComposerPrimitive.Input
        placeholder={placeholder}
        rows={1}
        autoFocus
        // 16px keeps iOS Safari from zooming the page on focus.
        className="aui-composer-input max-h-40 min-h-11 w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
        aria-label="Message"
        data-testid="input-chat-message"
      />
      <div className="aui-composer-action-wrapper flex items-center justify-end px-2 pb-2">
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <ComposerPrimitive.Send asChild>
            <Button size="icon-sm" className="rounded-full" aria-label="Send" data-testid="button-send-message">
              <HugeiconsIcon icon={ArrowUp02Icon} className="size-4" />
            </Button>
          </ComposerPrimitive.Send>
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel asChild>
            <Button size="icon-sm" className="rounded-full" aria-label="Stop" data-testid="button-stop">
              <HugeiconsIcon icon={StopIcon} className="size-3.5 fill-current" />
            </Button>
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </div>
    </ComposerPrimitive.Root>
  );
};
