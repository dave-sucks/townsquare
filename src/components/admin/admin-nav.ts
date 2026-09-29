import { UserShield01Icon } from "@hugeicons/core-free-icons";

/**
 * The nav's one Admin link, shown to admins (whatever Edit mode is set to).
 * The Admin page has the tabs: Review, Creators, Agents.
 */
export const ADMIN_NAV_ITEMS = [{ href: "/admin", label: "Admin", icon: UserShield01Icon }] as const;
