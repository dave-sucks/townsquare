"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { LandingPage } from "@/components/landing-page";
import { Onboarding } from "@/components/onboarding";
import { ExplorePage } from "@/components/pages/explore-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingComplete(true);
  }, []);

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
    return <LandingPage />;
  }

  const needsOnboarding = !user.username && !onboardingComplete;

  if (needsOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return <ExplorePage user={user} />;
}
