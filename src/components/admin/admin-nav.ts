import { Activity01Icon, AiBrain01Icon, TaskDone01Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";

/**
 * The nav's Admin group, shown while admin mode is on (desktop rail and the
 * mobile menu).
 */
export const ADMIN_NAV_ITEMS = [
  { href: "/admin/review", label: "Review", icon: TaskDone01Icon },
  { href: "/admin/sources", label: "Sources", icon: UserMultipleIcon },
  { href: "/admin/runs", label: "Runs", icon: Activity01Icon },
  { href: "/admin/agents", label: "Agents", icon: AiBrain01Icon },
] as const;
