"use client";

import { use } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ProfileDashboard } from "@/components/profile-dashboard";

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { isAuthenticated, user: currentUser } = useAuth();

  return (
    <ProfileDashboard 
      username={username}
      currentUser={currentUser}
      isAuthenticated={isAuthenticated}
    />
  );
}
