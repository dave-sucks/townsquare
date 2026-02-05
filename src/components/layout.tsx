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
  useSidebar,
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
import { Users, List, LogOut, ChevronsUpDown, Activity, MessageCircle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarThemeToggle } from "@/components/theme-toggle";

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

function SidebarNav({ user }: { user: User | null }) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const userName = user?.firstName || user?.email?.split("@")[0] || "User";
  const userEmail = user?.email || "";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <Link href="/" className="block">
          {!isCollapsed && (
            <img 
              src="/twn-logo.svg" 
              alt="TWN" 
              className="h-5 w-auto"
            />
          )}
          {isCollapsed && (
            <span className="text-primary font-bold text-sm">T</span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
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

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarThemeToggle />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="group-data-[collapsible=icon]:p-0">
        <SidebarMenu>
          <SidebarMenuItem>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    data-testid="button-user-menu"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user.profileImageUrl || ""} alt={userName} />
                      <AvatarFallback className="rounded-lg">
                        {userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-medium">{userName}</span>
                      <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
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
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src={user.profileImageUrl || ""} alt={userName} />
                        <AvatarFallback className="rounded-lg">
                          {userName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{userName}</span>
                        <span className="truncate text-xs">{userEmail}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href={`/u/${user.username || user.id}`} className="flex items-center gap-2 w-full" data-testid="link-my-profile">
                        <Users className="size-4" />
                        My Profile
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
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">?</AvatarFallback>
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
