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
import { Users, List, LogOut, ChevronDown, Activity, MessageCircle, MapPin, Sparkles, BadgeCheck, CreditCard, Bell, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

interface User {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

const NAV_ITEMS = [
  { href: "/", label: "Map", icon: MapPin },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/home", label: "Activity", icon: Activity },
  { href: "/people", label: "People", icon: Users },
  { href: "/lists", label: "Lists", icon: List },
] as const;

export function AppShell({
  user,
  children,
}: {
  user: User | null;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <SidebarNav user={user} />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          {children}
        </SidebarInset>
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
        <Sun className="h-4 w-4" />
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
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
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
            <SidebarMenuButton asChild className="w-fit px-1.5">
              <Link href="/">
                <div className="size-5 shrink-0 rounded-md overflow-hidden bg-brand-light flex items-center justify-center">
                  <img 
                    src="/user-logo.svg" 
                    alt="TWN" 
                    className="size-full object-contain"
                  />
                </div>
                <span className="truncate font-bold font-brand uppercase">TWN</span>
              </Link>
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
                      className={cn(!isActive && "opacity-60")}
                    >
                      <Link href={item.href} data-testid={`nav-${item.label.toLowerCase()}`}>
                        <item.icon className="size-4" />
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
                      <AvatarFallback className="rounded-md bg-brand text-brand-foreground">
                        {userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-semibold">{userName}</span>
                      <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                    </div>
                    <ChevronDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden opacity-50" />
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
                        <AvatarFallback className="rounded-md bg-brand text-brand-foreground">
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
                        <Sparkles className="size-4" />
                        Upgrade to Pro
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href={`/u/${user.username || user.id}`} className="flex items-center gap-2 w-full" data-testid="link-my-profile">
                        <BadgeCheck className="size-4" />
                        Account
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/billing" className="flex items-center gap-2 w-full">
                        <CreditCard className="size-4" />
                        Billing
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/notifications" className="flex items-center gap-2 w-full">
                        <Bell className="size-4" />
                        Notifications
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/api/logout" className="flex items-center gap-2 w-full" data-testid="button-logout">
                      <LogOut className="size-4" />
                      Log out
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton asChild size="lg">
                <a href="/api/login" data-testid="button-login">
                  <Avatar className="h-8 w-8 rounded-md">
                    <AvatarFallback className="rounded-md bg-brand text-brand-foreground">?</AvatarFallback>
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
      {showTrigger && <SidebarTrigger data-testid="button-sidebar-toggle" />}
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
