"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Comment01Icon,
  Location01Icon,
  Activity01Icon,
  Menu01Icon,
  Cancel01Icon,
  UserMultiple02Icon,
  LeftToRightListBulletIcon,
  SparklesIcon,
  CheckmarkBadge01Icon,
  Notification02Icon,
  Logout02Icon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { useTheme } from "next-themes";

interface User {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

const BOTTOM_NAV_ITEMS = [
  { href: "/", label: "Map", icon: Location01Icon },
  { href: "/home", label: "Feed", icon: Activity01Icon },
  { href: "/chat", label: "Chat", icon: Comment01Icon },
] as const;

const MENU_ITEMS = [
  { href: "/people", label: "People", icon: UserMultiple02Icon },
  { href: "/lists", label: "Lists", icon: LeftToRightListBulletIcon },
  { href: "/notifications", label: "Notifications", icon: Notification02Icon },
  { href: "/upgrade", label: "Upgrade", icon: SparklesIcon },
] as const;

export function MobileNav({ user }: { user: User | null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  React.useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const userName = user?.username || user?.firstName || user?.email?.split("@")[0] || "User";

  return (
    <>
      {menuOpen && (
        <div
          className="fixed inset-0 z-[98] bg-background/80 backdrop-blur-md md:hidden"
          onClick={() => setMenuOpen(false)}
          data-testid="mobile-menu-backdrop"
        >
          <div
            className="absolute inset-0 flex flex-col items-end justify-end p-6 pb-24 gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            {user && (
              <Link
                href={`/u/${user.username || user.id}`}
                className="flex items-center gap-4 hover-elevate rounded-xl px-4 py-3"
                data-testid="mobile-menu-account"
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-lg font-medium">{userName}</span>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                  <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-6" />
                </div>
              </Link>
            )}

            {MENU_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-4 hover-elevate rounded-xl px-4 py-3"
                data-testid={`mobile-menu-${item.label.toLowerCase()}`}
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-lg font-medium">{item.label}</span>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                  <HugeiconsIcon icon={item.icon} className="size-6" />
                </div>
              </Link>
            ))}

            {mounted && (
              <button
                onClick={() => {
                  setTheme(theme === "dark" ? "light" : "dark");
                }}
                className="flex items-center gap-4 hover-elevate rounded-xl px-4 py-3"
                data-testid="mobile-menu-theme"
              >
                <span className="text-lg font-medium">
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </span>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                  <HugeiconsIcon
                    icon={theme === "dark" ? Sun03Icon : Moon02Icon}
                    className="size-6"
                  />
                </div>
              </button>
            )}

            {user && (
              <a
                href="/api/logout"
                className="flex items-center gap-4 hover-elevate rounded-xl px-4 py-3"
                data-testid="mobile-menu-logout"
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-lg font-medium">Log out</span>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                  <HugeiconsIcon icon={Logout02Icon} className="size-6" />
                </div>
              </a>
            )}

            {!user && (
              <a
                href="/api/login"
                className="flex items-center gap-4 hover-elevate rounded-xl px-4 py-3"
                data-testid="mobile-menu-login"
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-lg font-medium">Sign In</span>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                  <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-6" />
                </div>
              </a>
            )}
          </div>
        </div>
      )}

      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[99] flex items-center gap-3 md:hidden" data-testid="mobile-bottom-nav">
        <nav className="flex items-center gap-1 bg-background/90 backdrop-blur-lg border rounded-full px-2 py-1.5 shadow-lg">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-center w-11 h-11 rounded-full transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover-elevate"
                )}
                data-testid={`mobile-nav-${item.label.toLowerCase()}`}
              >
                <HugeiconsIcon icon={item.icon} className="size-5" />
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={cn(
            "flex items-center justify-center w-11 h-11 rounded-full shadow-lg border transition-colors",
            menuOpen
              ? "bg-primary text-primary-foreground"
              : "bg-background/90 backdrop-blur-lg text-muted-foreground hover-elevate"
          )}
          data-testid="mobile-nav-menu"
        >
          <HugeiconsIcon icon={menuOpen ? Cancel01Icon : Menu01Icon} className="size-5" />
        </button>
      </div>
    </>
  );
}
