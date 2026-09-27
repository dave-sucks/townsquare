import { cn } from "@/lib/utils";

/**
 * The one status indicator. Five hues only: emerald done, blue running,
 * amber needs review, red failed, stone queued.
 */
const DOT_COLOR: Record<string, string> = {
  completed: "bg-emerald-500",
  processed: "bg-emerald-500",
  running: "bg-blue-500",
  unresolved: "bg-amber-500",
  needs_review: "bg-amber-500",
  failed: "bg-red-500",
  pending: "bg-stone-400",
  queued: "bg-stone-400",
  new: "bg-stone-400",
};

export function StatusDot({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn("inline-block w-2 h-2 rounded-full flex-shrink-0", DOT_COLOR[status] ?? "bg-stone-400", className)}
      data-testid={`dot-status-${status}`}
    />
  );
}
