import { DatabaseImportIcon } from "@hugeicons/core-free-icons";

/**
 * The nav's Admin group, shown while admin mode is on (desktop rail and the
 * mobile menu). Internal pages join it as they ship.
 */
export const ADMIN_NAV_ITEMS = [
  { href: "/admin/import", label: "Import", icon: DatabaseImportIcon },
] as const;
