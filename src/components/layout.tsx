"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserMultiple02Icon, LeftToRightListBulletIcon, Logout02Icon, ArrowDown01Icon, Activity01Icon, Comment01Icon, Location01Icon, SparklesIcon, CheckmarkBadge01Icon, CreditCardIcon, Notification02Icon, Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { MobileNav } from "@/components/mobile-nav";
import { MobileMenuOverlay } from "@/components/mobile-menu-overlay";

interface User {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

const NAV_ITEMS = [
  { href: "/", label: "Map", icon: Location01Icon },
  { href: "/chat", label: "Chat", icon: Comment01Icon },
  { href: "/home", label: "Activity", icon: Activity01Icon },
  { href: "/people", label: "People", icon: UserMultiple02Icon },
  { href: "/lists", label: "Lists", icon: LeftToRightListBulletIcon },
] as const;

export function AppShell({
  user,
  children,
}: {
  user: User | null;
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <SidebarProvider>
      <div className="flex h-dvh w-full">
        <SidebarNav user={user} />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden min-h-[100dvh]">
          {children}
        </SidebarInset>
        <MobileMenuOverlay
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          user={user}
        />
        <MobileNav
          menuOpen={mobileMenuOpen}
          onMenuToggle={() => setMobileMenuOpen((v) => !v)}
        />
      </div>
    </SidebarProvider>
  );
}

function ThemeToggleButton() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <HugeiconsIcon icon={Sun03Icon} className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      data-testid="button-theme-toggle"
    >
      {theme === "dark" ? (
        <HugeiconsIcon icon={Sun03Icon} className="h-4 w-4" />
      ) : (
        <HugeiconsIcon icon={Moon02Icon} className="h-4 w-4" />
      )}
    </Button>
  );
}

function SidebarNav({ user }: { user: User | null }) {
  const pathname = usePathname();
  const userName = user?.username || user?.firstName || user?.email?.split("@")[0] || "User";
  const userEmail = user?.email || "";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
            >
              <Button size="icon-sm" variant="ghost" asChild className="size-8 p-0!">
                <span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 500 500"
                    fill="none"
                    className="size-7!"
                  >
                    <rect width="500" height="500" fill="none"></rect>
                    <path d="M346.651 213.776C350.446 222.023 353.166 229.742 356.939 236.786C360.151 243.522 364.088 249.888 368.681 255.769C377.535 266.567 387.844 273.062 400.008 275.572C426.991 280.866 458.866 269.035 474.486 244.569C477.648 263.171 465.8 282.28 450.728 293.078C436.639 303.275 419.388 308.133 402.052 306.787C401.799 308.58 401.483 310.626 401.146 313.009C383.965 429.809 353.482 490.593 307.905 499.029C304.43 499.683 300.9 500.009 297.364 500C243.608 500 195.481 426.815 181.715 403.847C157.577 394.314 133.524 377.715 110.904 354.516C106.958 350.631 105.42 344.915 106.884 339.573C108.347 334.232 112.583 330.099 117.958 328.771C123.333 327.442 129.005 329.126 132.786 333.172C144.17 344.793 166.158 364.617 193.12 375.353C195.705 375.603 198.185 376.503 200.329 377.969C218.374 383.811 238.275 385.182 258.534 377.378C327.384 350.803 357.34 310.457 368.977 294.364C350.046 280.529 338.514 256.338 343.342 226.663C344.054 222.277 345.162 217.963 346.651 213.776ZM364.381 346.606C361.936 348.99 359.301 351.436 356.539 353.903C330.862 376.36 301.357 394.014 269.433 406.02C255.235 411.489 240.069 413.993 224.868 413.38C245.949 441.346 276.895 473.636 302.382 468.933C317.855 466.106 345.029 445.628 364.381 346.606ZM241.858 0C292.136 0 331.494 64.7279 331.494 147.319C331.494 229.911 292.136 294.618 241.858 294.618C216.73 294.618 194.301 278.42 178.174 251.888C161.625 279.179 138.9 294.618 114.615 294.597C64.3586 294.597 25.0001 229.89 25 147.299C25 64.7072 64.3585 0 114.615 0C139.006 0.000167085 161.625 15.4178 178.194 42.709C194.321 16.1769 216.73 0.00014687 241.858 0ZM114.51 26.1533C104.033 26.1533 94.0188 31.3202 85.207 40.3682C101.313 41.4649 115.331 61.9865 123.152 92.3994L85.9873 109.146L128.148 119.101C129.281 128.803 129.844 138.564 129.835 148.332C129.835 205.488 110.989 252.247 87.1045 256.106C95.4103 264.015 104.749 268.486 114.51 268.486C130.257 268.486 145.836 256.316 157.81 234.867C147.333 210.107 141.83 180.96 141.83 150.125C141.83 118.362 147.965 87.4431 159.18 62.2607C147.058 39.2297 130.974 26.1535 114.51 26.1533ZM241.858 26.1318C230.728 26.132 220.167 31.9744 210.934 42.0557H211.207C227.481 42.0557 241.732 62.0493 249.933 92.209L209.984 110.2L254.781 120.745C256.105 130.48 256.88 140.282 257.101 150.104C257.101 205.931 239.224 251.867 216.035 257.562C223.982 264.521 232.731 268.465 241.858 268.465C276.304 268.465 305.396 212.975 305.396 147.299C305.396 81.622 276.304 26.1318 241.858 26.1318Z" fill="#0004EC"></path>
                  </svg>
                </span>
              </Button>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  Town Square
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link href={item.href} data-testid={`nav-${item.label.toLowerCase()}`}>
                        <HugeiconsIcon icon={item.icon} className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeToggleButton />
          </SidebarMenuItem>
          <SidebarMenuItem>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    data-testid="button-user-menu"
                  >
                    <Avatar className="h-8 w-8 rounded-md">
                      <AvatarImage src={user.profileImageUrl || ""} alt={userName} />
                      <AvatarFallback className="rounded-md">
                        {userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-semibold">{userName}</span>
                      <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                    </div>
                    <HugeiconsIcon icon={ArrowDown01Icon} className="ml-auto size-4 group-data-[collapsible=icon]:hidden opacity-50" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-md">
                        <AvatarImage src={user.profileImageUrl || ""} alt={userName} />
                        <AvatarFallback className="rounded-md">
                          {userName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{userName}</span>
                        <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/upgrade" className="flex items-center gap-2 w-full">
                        <HugeiconsIcon icon={SparklesIcon} className="size-4" />
                        Upgrade to Pro
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href={`/u/${user.username || user.id}`} className="flex items-center gap-2 w-full" data-testid="link-my-profile">
                        <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-4" />
                        Account
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/billing" className="flex items-center gap-2 w-full">
                        <HugeiconsIcon icon={CreditCardIcon} className="size-4" />
                        Billing
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/notifications" className="flex items-center gap-2 w-full">
                        <HugeiconsIcon icon={Notification02Icon} className="size-4" />
                        Notifications
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/api/logout" className="flex items-center gap-2 w-full" data-testid="button-logout">
                      <HugeiconsIcon icon={Logout02Icon} className="size-4" />
                      Log out
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton asChild size="lg">
                <a href="/api/login" data-testid="button-login">
                  <Avatar className="h-8 w-8 rounded-md">
                    <AvatarFallback className="rounded-md">?</AvatarFallback>
                  </Avatar>
                  <span className="group-data-[collapsible=icon]:hidden">Sign In</span>
                </a>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

const pageHeaderVariants = cva(
  "flex items-center gap-2 border-b bg-background px-4 shrink-0",
  {
    variants: {
      size: {
        default: "h-12",
        sm: "h-10",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

interface PageHeaderProps extends VariantProps<typeof pageHeaderVariants> {
  title?: string;
  children?: React.ReactNode;
  showTrigger?: boolean;
  backHref?: string;
  className?: string;
}

export function PageHeader({ title, children, size, showTrigger = true, backHref, className }: PageHeaderProps) {
  return (
    <header className={cn(pageHeaderVariants({ size }), className)}>
      {showTrigger && <SidebarTrigger className="hidden md:flex" data-testid="button-sidebar-toggle" />}
      {title && <h1 className="font-semibold text-sm font-brand">{title}</h1>}
      <div className="ml-auto flex items-center gap-2">
        {children}
      </div>
    </header>
  );
}

const contentContainerVariants = cva("flex-1 overflow-auto", {
  variants: {
    variant: {
      default: "p-4",
      flush: "",
      padded: "p-6",
    },
    maxWidth: {
      default: "",
      sm: "max-w-xl mx-auto",
      md: "max-w-2xl mx-auto",
      "3xl": "max-w-3xl mx-auto",
      lg: "max-w-4xl mx-auto",
    },
  },
  defaultVariants: {
    variant: "default",
    maxWidth: "default",
  },
});

interface ContentContainerProps extends VariantProps<typeof contentContainerVariants> {
  children: React.ReactNode;
  className?: string;
}

export function ContentContainer({ children, variant, maxWidth, className }: ContentContainerProps) {
  return (
    <div className={cn(contentContainerVariants({ variant, maxWidth }), className)}>
      {children}
    </div>
  );
}

interface SplitViewProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftSize?: number;
  minLeftSize?: number;
  minRightSize?: number;
}

export function SplitView({
  left,
  right,
  defaultLeftSize = 40,
  minLeftSize = 25,
  minRightSize = 30,
}: SplitViewProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <div style={{ width: `${defaultLeftSize}%`, minWidth: `${minLeftSize}%` }} className="flex-shrink-0">
        <ScrollArea className="h-full">{left}</ScrollArea>
      </div>
      <div style={{ width: `${100 - defaultLeftSize}%`, minWidth: `${minRightSize}%` }} className="flex-1">
        {right}
      </div>
    </div>
  );
}
