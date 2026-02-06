"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { LandingMap } from "@/components/landing-map";

const AVATAR_EMOJIS = [
  "\u{1F354}", "\u{1F355}", "\u{1F363}", "\u{1F32E}",
  "\u{1F370}", "\u{1F35C}", "\u{2615}", "\u{1F366}",
  "\u{1F96F}", "\u{1F969}", "\u{1F377}", "\u{1F950}",
  "\u{1F36A}", "\u{1F37F}", "\u{1F9C1}", "\u{1F95D}",
];

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [selectedEmoji, setSelectedEmoji] = useState<string>(AVATAR_EMOJIS[0]);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (mapReady) setShowContent(true);
  }, [mapReady]);

  const handleSubmit = useCallback(async () => {
    if (!username.trim()) {
      setError("Pick a username");
      return;
    }
    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      setError("Letters, numbers, and underscores only");
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

      await queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      onComplete();
    } catch {
      setError("Something went wrong. Try again.");
      setIsSubmitting(false);
    }
  }, [username, selectedEmoji, queryClient, onComplete]);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div className="absolute inset-0 bg-[#212121]" />
      <LandingMap onReady={() => setMapReady(true)} />

      <div
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 p-4 transition-opacity duration-700 ${
          showContent ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="w-full max-w-sm bg-black/20 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/10 p-6 flex flex-col items-center gap-5"
          data-testid="onboarding-card"
        >
          <div
            className="w-24 h-24 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shadow-inner"
            data-testid="avatar-display"
          >
            <span className="text-5xl">{selectedEmoji}</span>
          </div>

          <div className="w-full" data-testid="emoji-picker">
            <div
              ref={scrollRef}
              className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
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
                  className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-all ${
                    selectedEmoji === emoji
                      ? "bg-white/20 ring-2 ring-white/50 scale-110"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                  data-testid={`emoji-option-${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full flex flex-col gap-2">
            <Input
              placeholder="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              className="text-center text-base bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/30"
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
          onClick={handleSubmit}
          disabled={isSubmitting}
          size="lg"
          className="w-full max-w-sm bg-white text-black border-white hover:bg-white/90"
          data-testid="button-complete-onboarding"
        >
          {isSubmitting ? "Setting up..." : "Let's go"}
        </Button>
      </div>
    </div>
  );
}
