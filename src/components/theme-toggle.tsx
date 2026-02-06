"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { saveMapStyle, MAP_STYLE_STORAGE_KEY } from "@/lib/map-styles";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    
    const newMapStyle = newTheme === "dark" ? "aubergine" : "retro";
    saveMapStyle(newMapStyle);
    window.dispatchEvent(new CustomEvent("map-style-change", { detail: newMapStyle }));
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

export function SidebarThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    
    const newMapStyle = newTheme === "dark" ? "aubergine" : "retro";
    saveMapStyle(newMapStyle);
    window.dispatchEvent(new CustomEvent("map-style-change", { detail: newMapStyle }));
  };

  if (!mounted) {
    return (
      <SidebarMenuButton size="default" disabled>
        <HugeiconsIcon icon={Sun03Icon} className="size-4" />
        <span>Light mode</span>
      </SidebarMenuButton>
    );
  }

  return (
    <SidebarMenuButton
      size="default"
      onClick={handleToggle}
      data-testid="button-theme-toggle"
    >
      {theme === "dark" ? (
        <>
          <HugeiconsIcon icon={Sun03Icon} className="size-4" />
          <span>Light mode</span>
        </>
      ) : (
        <>
          <HugeiconsIcon icon={Moon02Icon} className="size-4" />
          <span>Dark mode</span>
        </>
      )}
    </SidebarMenuButton>
  );
}
