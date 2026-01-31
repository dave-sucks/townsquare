"use client";

import { use } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ListPage } from "@/components/pages/list-page";

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isAuthenticated } = useAuth();

  return (
    <ListPage
      listId={id}
      currentUser={user}
      isAuthenticated={isAuthenticated}
    />
  );
}
