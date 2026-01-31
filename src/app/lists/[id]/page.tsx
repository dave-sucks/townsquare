"use client";

import { use } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ListDashboard } from "@/components/list-dashboard";

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isAuthenticated } = useAuth();

  return (
    <ListDashboard
      listId={id}
      currentUser={user}
      isAuthenticated={isAuthenticated}
    />
  );
}
