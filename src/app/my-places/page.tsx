"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { DiscoverPage } from "@/components/pages/discover-page";
import { Skeleton } from "@/components/ui/skeleton";
import { redirect } from "next/navigation";

export default function MyPlacesPage() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    redirect("/");
    return null;
  }

  return <DiscoverPage user={user} />;
}
