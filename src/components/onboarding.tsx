"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";

const AVATAR_EMOJIS = [
  "\u{1F354}",
  "\u{1F355}",
  "\u{1F363}",
  "\u{1F32E}",
  "\u{1F370}",
  "\u{1F35C}",
  "\u{2615}",
  "\u{1F366}",
];

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-sm bg-card rounded-2xl shadow-2xl border p-8 flex flex-col items-center gap-6"
        data-testid="onboarding-card"
      >
        <div
          className="w-28 h-28 rounded-2xl bg-muted flex items-center justify-center shadow-inner relative overflow-hidden"
          data-testid="avatar-display"
        >
          {selectedEmoji ? (
            <span className="text-5xl">{selectedEmoji}</span>
          ) : (
            <span className="text-4xl opacity-30">{"\u{1F60A}"}</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <h2 className="text-lg font-semibold text-center">Pick your vibe</h2>
          <p className="text-xs text-muted-foreground text-center">
            Choose an emoji avatar and a username
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3" data-testid="emoji-picker">
          {AVATAR_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setSelectedEmoji(emoji);
                setError(null);
              }}
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all ${
                selectedEmoji === emoji
                  ? "bg-primary/10 ring-2 ring-primary scale-110"
                  : "bg-muted hover:bg-muted/80"
              }`}
              data-testid={`emoji-option-${emoji}`}
            >
              {emoji}
            </button>
          ))}
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
            className="text-center text-base"
            maxLength={20}
            data-testid="input-username"
          />
          {error && (
            <p className="text-xs text-destructive text-center" data-testid="text-error">
              {error}
            </p>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full"
          size="lg"
          data-testid="button-complete-onboarding"
        >
          {isSubmitting ? "Setting up..." : "Let's go"}
        </Button>
      </div>
    </div>
  );
}
