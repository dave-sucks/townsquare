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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { MapPin, Home, Users, List, LogOut, MoreHorizontal, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  { href: "/home", label: "Home", icon: Home },
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
  const userName = user?.firstName || user?.email?.split("@")[0] || "User";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-1">
          <MapPin className="h-5 w-5 text-primary shrink-0" />
          <span className="font-semibold group-data-[collapsible=icon]:hidden">Beli</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="p-2">
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
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                className="w-full"
                data-testid="button-user-menu"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.profileImageUrl || undefined} alt={userName} />
                  <AvatarFallback className="text-xs">{userName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="truncate">{userName}</span>
                <MoreHorizontal className="ml-auto h-4 w-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuItem asChild>
                <Link href={`/u/${user.username || user.id}`} data-testid="link-my-profile">
                  My Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/api/logout" data-testid="button-logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <SidebarMenuButton asChild>
            <a href="/api/login" data-testid="button-login">Sign In</a>
          </SidebarMenuButton>
        )}
      </SidebarFooter>
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

export function PageHeader({ title, children, size, showTrigger = true, backHref }: PageHeaderProps) {
  return (
    <header className={pageHeaderVariants({ size })}>
      {showTrigger && <SidebarTrigger data-testid="button-sidebar-toggle" />}
      {backHref && (
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link href={backHref} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      )}
      {title && <h1 className="font-semibold text-sm">{title}</h1>}
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
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
    <ResizablePanelGroup direction="horizontal" className="flex-1">
      <ResizablePanel defaultSize={defaultLeftSize} minSize={minLeftSize}>
        <ScrollArea className="h-full">{left}</ScrollArea>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={100 - defaultLeftSize} minSize={minRightSize}>
        {right}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
