"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

function PageSkeleton() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

const LandingPage = dynamic(
  () => import("@/components/landing-page").then((m) => ({ default: m.LandingPage })),
  { loading: PageSkeleton },
);

const ChatShell = dynamic(
  () => import("@/components/chat/chat-shell").then((m) => ({ default: m.ChatShell })),
  { loading: PageSkeleton },
);

export default function Chat() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <PageSkeleton />;

  if (!isAuthenticated || !user) {
    return <LandingPage />;
  }

  // ChatShell reads ?c= via useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ChatShell user={user} />
    </Suspense>
  );
}
