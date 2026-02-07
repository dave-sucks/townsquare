"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Comment01Icon,
  Location01Icon,
  Image02Icon,
  LayoutAlignRightIcon,
  Cancel01Icon,
  UserMultiple02Icon,
  LeftToRightListBulletIcon,
  SparklesIcon,
  CheckmarkBadge01Icon,
  Notification02Icon,
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
  { href: "/chat", label: "Chat", icon: Comment01Icon },
  { href: "/home", label: "Feed", icon: Image02Icon },
] as const;

const MENU_ITEMS_TOP = [
  { href: "/people", label: "People", icon: UserMultiple02Icon },
  { href: "/notifications", label: "Notifications", icon: Notification02Icon },
  { href: "/upgrade", label: "Upgrade", icon: SparklesIcon },
] as const;

const MENU_ITEMS_BOTTOM = [
  { href: "/lists", label: "Lists", icon: LeftToRightListBulletIcon },
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
          className="fixed inset-0 z-[39] bg-background/70 backdrop-blur-xl md:hidden"
          onClick={() => setMenuOpen(false)}
          data-testid="mobile-menu-backdrop"
        >
          <div
            className="absolute inset-0 flex flex-col items-end justify-end pr-4 pb-16"
            onClick={(e) => e.stopPropagation()}
          >
            {user && (
              <Link
                href={`/u/${user.username || user.id}`}
                className="flex items-center gap-3 hover-elevate rounded-xl px-3 py-2"
                data-testid="mobile-menu-account"
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-base font-medium">{userName}</span>
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/60">
                  <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-5" />
                </div>
              </Link>
            )}

            {MENU_ITEMS_TOP.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 hover-elevate rounded-xl px-3 py-2"
                data-testid={`mobile-menu-${item.label.toLowerCase()}`}
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-base font-medium">{item.label}</span>
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/60">
                  <HugeiconsIcon icon={item.icon} className="size-5" />
                </div>
              </Link>
            ))}

            {MENU_ITEMS_BOTTOM.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 hover-elevate rounded-xl px-3 py-2"
                data-testid={`mobile-menu-${item.label.toLowerCase()}`}
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-base font-medium">{item.label}</span>
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/60">
                  <HugeiconsIcon icon={item.icon} className="size-5" />
                </div>
              </Link>
            ))}

            {mounted && (
              <button
                onClick={() => {
                  setTheme(theme === "dark" ? "light" : "dark");
                }}
                className="flex items-center gap-3 hover-elevate rounded-xl px-3 py-2"
                data-testid="mobile-menu-theme"
              >
                <span className="text-base font-medium">
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </span>
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/60">
                  <HugeiconsIcon
                    icon={theme === "dark" ? Sun03Icon : Moon02Icon}
                    className="size-5"
                  />
                </div>
              </button>
            )}

            {!user && (
              <a
                href="/api/login"
                className="flex items-center gap-3 hover-elevate rounded-xl px-3 py-2"
                data-testid="mobile-menu-login"
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-base font-medium">Sign In</span>
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/60">
                  <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-5" />
                </div>
              </a>
            )}
          </div>
        </div>
      )}

      <div
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-border/40 bg-background/80 backdrop-blur-2xl pb-[env(safe-area-inset-bottom,0px)]"
        data-testid="mobile-bottom-nav"
      >
        <nav className="grid grid-cols-[1fr_auto_1fr] items-center px-2 py-1.5">
          <div />

          <div className="flex items-center gap-0.5 bg-muted/60 rounded-full p-1">
            {BOTTOM_NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-center p-2 rounded-full transition-colors",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                  data-testid={`mobile-nav-${item.label.toLowerCase()}`}
                >
                  <HugeiconsIcon icon={item.icon} className="size-6" />
                </Link>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={cn(
                "flex items-center justify-center p-2 rounded-lg transition-colors",
                menuOpen
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
              data-testid="mobile-nav-menu"
            >
              <HugeiconsIcon icon={menuOpen ? Cancel01Icon : LayoutAlignRightIcon} className="size-6" />
            </button>
          </div>
        </nav>
      </div>
    </>
  );
}
