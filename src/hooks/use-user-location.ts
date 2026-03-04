"use client";

import { useState, useEffect, useRef } from "react";

const LOCATION_KEY = "twnsq-user-location";
const LOCATION_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface UserLocation {
  lat: number;
  lng: number;
  timestamp: number;
}

function getCachedLocation(): UserLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const parsed: UserLocation = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > LOCATION_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function cacheLocation(lat: number, lng: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LOCATION_KEY,
      JSON.stringify({ lat, lng, timestamp: Date.now() })
    );
  } catch {}
}

export function useUserLocation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    // Use cache first
    const cached = getCachedLocation();
    if (cached) {
      setLocation({ lat: cached.lat, lng: cached.lng });
      setLoading(false);
      return;
    }

    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        cacheLocation(loc.lat, loc.lng);
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  return { location, loading };
}
