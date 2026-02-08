"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { LandingMap } from "@/components/landing-map";
import { PersonCard } from "@/components/person-card";
import { apiRequest } from "@/lib/query-client";
import { Skeleton } from "@/components/ui/skeleton";

const AVATAR_EMOJIS = [
  "\u{1F354}", "\u{1F355}", "\u{1F363}", "\u{1F32E}",
  "\u{1F370}", "\u{1F35C}", "\u{2615}", "\u{1F366}",
  "\u{1F96F}", "\u{1F969}", "\u{1F377}", "\u{1F950}",
  "\u{1F36A}", "\u{1F37F}", "\u{1F9C1}", "\u{1F95D}",
];

interface OnboardingUser {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  savedPlacesCount: number;
  listsCount: number;
}

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedEmoji, setSelectedEmoji] = useState<string>(AVATAR_EMOJIS[0]);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [usersInitialized, setUsersInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const handleMapReady = useCallback(() => setMapReady(true), []);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (mapReady) setShowContent(true);
  }, [mapReady]);

  const { data: onboardingUsersData, isLoading: usersLoading } = useQuery<{
    users: OnboardingUser[];
  }>({
    queryKey: ["onboarding-users"],
    queryFn: () => apiRequest("/api/onboarding/users"),
    enabled: step === 2,
  });

  const onboardingUsers = onboardingUsersData?.users || [];

  useEffect(() => {
    if (onboardingUsers.length > 0 && !usersInitialized) {
      setSelectedUsers(new Set(onboardingUsers.map((u) => u.id)));
      setUsersInitialized(true);
    }
  }, [onboardingUsers, usersInitialized]);

  const toggleUser = useCallback((userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  const handleSubmitProfile = useCallback(async () => {
    if (!username.trim()) {
      setError("Pick a username");
      return;
    }
    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(username.trim())) {
      setError("Lowercase letters, numbers, and underscores only");
      return;
    }
    if (!selectedEmoji) {
      setError("Pick an emoji avatar");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          avatarEmoji: selectedEmoji,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      setStep(2);
    } catch {
      setError("Something went wrong. Try again.");
      setIsSubmitting(false);
    }
  }, [username, selectedEmoji, queryClient]);

  const handleSubmitFollows = useCallback(async () => {
    setIsSubmitting(true);

    try {
      const userIds = Array.from(selectedUsers);
      if (userIds.length > 0) {
        await fetch("/api/onboarding/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds }),
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      await queryClient.invalidateQueries({ queryKey: ["user"] });
      await queryClient.invalidateQueries({ queryKey: ["follows"] });
      onComplete();
    } catch {
      onComplete();
    }
  }, [selectedUsers, queryClient, onComplete]);

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0 bg-[#212121]" />
      <LandingMap onReady={handleMapReady} showSearch={false} />

      <div
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 p-4 transition-opacity duration-700 ${
          showContent ? "opacity-100" : "opacity-0"
        }`}
      >
        {step === 1 && (
          <>
            <div
              className="w-[280px] sm:w-[300px] aspect-[3/4] bg-black/20 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/10 flex flex-col items-center overflow-hidden"
              data-testid="onboarding-card"
            >
              <div className="pt-5 pb-2 flex flex-col items-center">
                <div
                  className="w-28 h-28 rounded-2xl bg-white/10 flex items-center justify-center"
                  data-testid="avatar-display"
                >
                  <span className="text-[64px] leading-none">{selectedEmoji}</span>
                </div>
              </div>

              <div className="w-full" data-testid="emoji-picker">
                <div
                  ref={scrollRef}
                  className="flex gap-1 overflow-x-auto px-4 scrollbar-none"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {AVATAR_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setSelectedEmoji(emoji);
                        setError(null);
                      }}
                      className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all box-border ${
                        selectedEmoji === emoji
                          ? "bg-white/15 border-2 border-white"
                          : "border-2 border-transparent hover:bg-white/10"
                      }`}
                      data-testid={`emoji-option-${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1" />

              <div className="w-full px-4 pb-5 flex flex-col gap-2">
                <Input
                  placeholder="Create Username"
                  value={username}
                  onChange={(e) => {
                    const filtered = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                    setUsername(filtered);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmitProfile();
                  }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  inputMode="email"
                  className="text-center text-base bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/30"
                  maxLength={20}
                  data-testid="input-username"
                />
                {error && (
                  <p className="text-xs text-red-400 text-center" data-testid="text-error">
                    {error}
                  </p>
                )}
              </div>
            </div>

            <Button
              onClick={handleSubmitProfile}
              disabled={isSubmitting}
              size="lg"
              className="w-[280px] sm:w-[300px] bg-white text-black"
              variant="secondary"
              data-testid="button-complete-onboarding"
            >
              {isSubmitting ? "Setting up..." : "Next"}
            </Button>
          </>
        )}

        {step === 2 && (
          <div
            className="w-[320px] sm:w-[340px] max-h-[80vh] bg-black/20 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/10 flex flex-col overflow-hidden"
            data-testid="onboarding-follow-card"
          >
            <div className="px-5 pt-5 pb-3 shrink-0">
              <h2 className="text-lg font-semibold text-white text-center">
                Start following
              </h2>
              <p className="text-xs text-white/50 text-center mt-1">
                See their favorite spots on your map
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-3" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {usersLoading ? (
                <div className="grid grid-cols-2 gap-2 pb-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-white/10 p-3 flex flex-col items-center gap-2">
                      <Skeleton className="h-12 w-12 rounded-full bg-white/10" />
                      <Skeleton className="h-3 w-16 bg-white/10" />
                      <Skeleton className="h-2 w-12 bg-white/10" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pb-3" data-testid="onboarding-users-grid">
                  {onboardingUsers.map((u) => (
                    <PersonCard
                      key={u.id}
                      id={u.id}
                      username={u.username}
                      firstName={u.firstName}
                      lastName={u.lastName}
                      profileImageUrl={u.profileImageUrl}
                      isFollowing={selectedUsers.has(u.id)}
                      savedPlacesCount={u.savedPlacesCount}
                      listsCount={u.listsCount}
                      onFollow={() => toggleUser(u.id)}
                      variant="onboarding"
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0 p-4">
              <Button
                onClick={handleSubmitFollows}
                disabled={isSubmitting}
                size="lg"
                variant="secondary"
                className="w-full bg-white text-black"
                data-testid="button-complete-follows"
              >
                {isSubmitting
                  ? "Setting up..."
                  : selectedUsers.size > 0
                    ? `Follow ${selectedUsers.size} & continue`
                    : "Skip"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
