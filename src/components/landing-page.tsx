"use client";

import { useState, useEffect } from "react";
import { LandingMap } from "@/components/landing-map";
import { Button } from "@/components/ui/button";

export function LandingPage() {
  const [mapReady, setMapReady] = useState(false);
  const [showCard, setShowCard] = useState(false);  useEffect(() => {
    const timer = setTimeout(() => setShowCard(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (mapReady) setShowCard(true);
  }, [mapReady]);

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0 bg-[#212121]" />

      <LandingMap onReady={() => setMapReady(true)} />

      <div
        className={`absolute inset-0 z-10 flex items-center justify-center p-4 transition-opacity duration-700 ${
          showCard ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="w-full max-w-sm bg-black/20 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/10 p-8 flex flex-col items-center gap-6"
          data-testid="landing-card"
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-4xl mb-2" role="img" aria-label="pin">
              {"\u{1F4CD}"}
            </span>
            <h1 className="text-2xl font-bold text-center text-white font-brand">
              We remembered that place you forgot
            </h1>
            <p className="text-sm text-center text-white/60 mt-2 max-w-xs leading-relaxed">
              Save every spot worth remembering. Build maps of your favorites, follow friends, and never lose that place again.
            </p>
          </div>

          <div className="w-full flex flex-col gap-3">
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="w-full bg-white text-black hover-elevate active-elevate-2"
              data-testid="button-signup"
            >
              <a href="/api/login">Sign Up</a>
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full border-white/20 bg-white/10 text-white hover-elevate active-elevate-2"
              data-testid="button-login"
            >
              <a href="/api/login">Log In</a>
            </Button>
          </div>

          <p className="text-[11px] text-white/30 text-center leading-snug">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
