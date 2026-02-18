"use client";

import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

const DiscoverPage = dynamic(
  () => import("@/components/pages/discover-page").then(m => ({ default: m.DiscoverPage })),
  {
    loading: () => (
      <div className="flex h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    ),
  }
);

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
