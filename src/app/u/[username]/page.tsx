"use client";

import { use } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ProfilePage } from "@/components/pages/profile-page";

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { isAuthenticated, user: currentUser } = useAuth();

  return (
    <ProfilePage 
      username={username}
      currentUser={currentUser}
      isAuthenticated={isAuthenticated}
    />
  );
}
