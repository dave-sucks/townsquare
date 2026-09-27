"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { queryClient } from "@/lib/query-client";
import { AdminModeProvider } from "@/components/admin/admin-mode";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
        forcedTheme={undefined}
        storageKey="twnsq-theme"
      >
        <AdminModeProvider>{children}</AdminModeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
