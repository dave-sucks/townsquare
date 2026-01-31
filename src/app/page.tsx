"use client";

import { useAuth } from "@/hooks/use-auth";
import { LandingPage } from "@/components/landing-page";
import { MainApp } from "@/components/main-app";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <LandingPage />;
  }

  return <MainApp user={user} />;
}
