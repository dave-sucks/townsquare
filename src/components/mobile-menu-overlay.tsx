"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Location01Icon,
  Comment01Icon,
  Activity01Icon,
  UserMultiple02Icon,
  LeftToRightListBulletIcon,
  Notification02Icon,
  Moon02Icon,
  Sun03Icon,
  Logout02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { useTheme } from "next-themes";
import { MOBILE_NAV_HEIGHT } from "@/components/mobile-nav";
import { AnimatePresence, motion } from "framer-motion";

const MENU_ITEMS = [
  { href: "/", label: "Map", icon: Location01Icon },
  { href: "/chat", label: "Chat", icon: Comment01Icon },
  { href: "/home", label: "Activity", icon: Activity01Icon },
  { href: "/people", label: "People", icon: UserMultiple02Icon },
  { href: "/lists", label: "Lists", icon: LeftToRightListBulletIcon },
  { href: "/notifications", label: "Notifications", icon: Notification02Icon },
] as const;

interface MobileMenuOverlayProps {
  open: boolean;
  onClose: () => void;
  user: {
    id: string;
    username: string | null;
    firstName: string | null;
    profileImageUrl: string | null;
  } | null;
}

export function MobileMenuOverlay({ open, onClose, user }: MobileMenuOverlayProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const prevPathname = React.useRef(pathname);
  React.useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] md:hidden bg-background/95 backdrop-blur-xl flex flex-col"
          style={{
            paddingBottom: `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
          }}
          data-testid="mobile-menu-overlay"
        >
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            {MENU_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                  data-testid={`mobile-menu-${item.label.toLowerCase()}`}
                  onClick={onClose}
                >
                  <span className="text-xl font-medium">{item.label}</span>
                  <HugeiconsIcon icon={item.icon} className="size-5" />
                </Link>
              );
            })}

            <div className="w-16 border-t my-1" />

            {user && (
              <Link
                href="/upgrade"
                className="flex items-center gap-3 text-muted-foreground transition-colors"
                data-testid="mobile-menu-upgrade"
                onClick={onClose}
              >
                <span className="text-xl font-medium">Upgrade</span>
                <HugeiconsIcon icon={SparklesIcon} className="size-5" />
              </Link>
            )}

            {mounted && (
              <button
                onClick={handleThemeToggle}
                className="flex items-center gap-3 text-muted-foreground transition-colors"
                data-testid="mobile-menu-theme"
              >
                <span className="text-xl font-medium">
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </span>
                <HugeiconsIcon
                  icon={theme === "dark" ? Sun03Icon : Moon02Icon}
                  className="size-5"
                />
              </button>
            )}

            {user ? (
              <a
                href="/api/logout"
                className="flex items-center gap-3 text-muted-foreground transition-colors"
                data-testid="mobile-menu-logout"
              >
                <span className="text-xl font-medium">Log out</span>
                <HugeiconsIcon icon={Logout02Icon} className="size-5" />
              </a>
            ) : (
              <a
                href="/api/login"
                className="flex items-center gap-3 text-muted-foreground transition-colors"
                data-testid="mobile-menu-login"
              >
                <span className="text-xl font-medium">Sign In</span>
              </a>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
