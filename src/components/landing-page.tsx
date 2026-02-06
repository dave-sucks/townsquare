"use client";

import { useState, useEffect } from "react";
import { LandingMap } from "@/components/landing-map";

export function LandingPage() {
  const [mapReady, setMapReady] = useState(false);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowCard(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (mapReady) setShowCard(true);
  }, [mapReady]);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800" />

      <LandingMap onReady={() => setMapReady(true)} />

      <div
        className={`absolute inset-0 z-10 flex items-center justify-center p-4 transition-opacity duration-700 ${
          showCard ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="w-full max-w-md bg-white/80 dark:bg-black/70 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/30 dark:border-white/10 p-8 flex flex-col items-center gap-6"
          data-testid="landing-card"
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-4xl mb-2" role="img" aria-label="pin">
              {"\u{1F4CD}"}
            </span>
            <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white font-brand">
              We remembered that place you forgot
            </h1>
            <p className="text-sm text-center text-gray-600 dark:text-gray-300 mt-2 max-w-xs leading-relaxed">
              Save every spot with a single link. Build maps of your favorite foods, follow friends, and never forget that place you saw on Instagram.
            </p>
          </div>

          <div className="w-full flex flex-col gap-3">
            <a
              href="/api/login"
              className="flex items-center justify-center gap-3 w-full rounded-lg border border-gray-200 dark:border-white/20 bg-white dark:bg-white/10 px-4 py-3 text-sm font-medium text-gray-900 dark:text-white transition-colors hover:bg-gray-50 dark:hover:bg-white/20"
              data-testid="button-login-google"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </a>

            <a
              href="/api/login"
              className="flex items-center justify-center gap-3 w-full rounded-lg border border-gray-200 dark:border-white/20 bg-white dark:bg-white/10 px-4 py-3 text-sm font-medium text-gray-900 dark:text-white transition-colors hover:bg-gray-50 dark:hover:bg-white/20"
              data-testid="button-login-apple"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Continue with Apple
            </a>

            <a
              href="/api/login"
              className="flex items-center justify-center gap-3 w-full rounded-lg border border-gray-200 dark:border-white/20 bg-white dark:bg-white/10 px-4 py-3 text-sm font-medium text-gray-900 dark:text-white transition-colors hover:bg-gray-50 dark:hover:bg-white/20"
              data-testid="button-login-email"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              Continue with email
            </a>
          </div>

          <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center leading-snug">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
