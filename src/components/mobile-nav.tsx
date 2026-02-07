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
  Menu01Icon,
} from "@hugeicons/core-free-icons";
import { useSidebar } from "@/components/ui/sidebar";

export const MOBILE_NAV_HEIGHT = 56;

const BOTTOM_NAV_ITEMS = [
  { href: "/", label: "Map", icon: Location01Icon },
  { href: "/chat", label: "Chat", icon: Comment01Icon },
  { href: "/home", label: "Feed", icon: Image02Icon },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[99] md:hidden border-t bg-background/80 backdrop-blur-xl"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      data-testid="mobile-bottom-nav"
    >
      <div className="flex items-center justify-around" style={{ height: `${MOBILE_NAV_HEIGHT}px` }}>
        {BOTTOM_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            >
              <HugeiconsIcon icon={item.icon} className="size-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={toggleSidebar}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground transition-colors"
          data-testid="mobile-nav-menu"
        >
          <HugeiconsIcon icon={Menu01Icon} className="size-5" />
          <span className="text-[10px] font-medium">Menu</span>
        </button>
      </div>
    </nav>
  );
}
