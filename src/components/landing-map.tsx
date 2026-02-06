"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { DARK_STYLE, getLabelDensityStyles } from "@/lib/map-styles";

const DEMO_LOCATIONS = [
  { lat: 40.7580, lng: -73.9855, emoji: "\u{1F354}", label: "best burger in NYC" },
  { lat: 40.7614, lng: -73.9776, emoji: "\u{1F363}", label: "sushi near Midtown" },
  { lat: 40.7291, lng: -73.9965, emoji: "\u{1F355}", label: "pizza in the Village" },
  { lat: 40.7189, lng: -73.9890, emoji: "\u{1F35C}", label: "ramen in Lower East Side" },
  { lat: 40.7484, lng: -73.9857, emoji: "\u{2615}", label: "coffee near Empire State" },
  { lat: 40.7831, lng: -73.9712, emoji: "\u{1F950}", label: "brunch on the Upper West" },
  { lat: 40.7282, lng: -74.0776, emoji: "\u{1F32E}", label: "tacos in Jersey City" },
  { lat: 40.6892, lng: -74.0445, emoji: "\u{1F366}", label: "ice cream near Liberty" },
  { lat: 40.7527, lng: -73.9772, emoji: "\u{1F370}", label: "dessert in Midtown East" },
  { lat: 40.7061, lng: -74.0087, emoji: "\u{1F377}", label: "wine bar in FiDi" },
  { lat: 40.7425, lng: -73.9549, emoji: "\u{1F969}", label: "steak in Murray Hill" },
  { lat: 40.7681, lng: -73.9819, emoji: "\u{1F96F}", label: "bagels near Columbus Circle" },
];

interface LandingMapProps {
  onReady?: () => void;
}

export function LandingMap({ onReady }: LandingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<google.maps.OverlayView[]>([]);
  const [currentQuery, setCurrentQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceRef = useRef(0);

  const createDemoOverlay = useCallback((
    map: google.maps.Map,
    lat: number,
    lng: number,
    emoji: string,
    delay: number
  ) => {
    const overlay = new google.maps.OverlayView();
    const position = new google.maps.LatLng(lat, lng);

    overlay.onAdd = function () {
      const div = document.createElement("div");
      div.style.cssText = `
        position: absolute;
        font-size: 28px;
        transform: translate(-50%, -100%) scale(0);
        transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
        opacity: 0;
        filter: drop-shadow(0 3px 8px rgba(0,0,0,0.5));
        pointer-events: none;
        z-index: 1;
      `;
      div.textContent = emoji;

      const panes = this.getPanes();
      panes?.overlayMouseTarget.appendChild(div);

      (this as any)._div = div;

      setTimeout(() => {
        div.style.transform = "translate(-50%, -100%) scale(1)";
        div.style.opacity = "1";
      }, delay);
    };

    overlay.draw = function () {
      const div = (this as any)._div;
      if (!div) return;
      const proj = this.getProjection();
      const pos = proj.fromLatLngToDivPixel(position);
      if (pos) {
        div.style.left = pos.x + "px";
        div.style.top = pos.y + "px";
      }
    };

    overlay.onRemove = function () {
      const div = (this as any)._div;
      if (div) div.parentNode?.removeChild(div);
    };

    overlay.setMap(map);
    return overlay;
  }, []);

  const typeQuery = useCallback((text: string, onComplete: () => void) => {
    setIsTyping(true);
    setCurrentQuery("");
    let i = 0;

    const type = () => {
      if (i <= text.length) {
        setCurrentQuery(text.slice(0, i));
        i++;
        animationRef.current = setTimeout(type, 40 + Math.random() * 30);
      } else {
        setIsTyping(false);
        animationRef.current = setTimeout(onComplete, 1500);
      }
    };
    type();
  }, []);

  const runSequence = useCallback((map: google.maps.Map) => {
    const idx = sequenceRef.current % DEMO_LOCATIONS.length;
    const batchSize = 3;
    const batch: typeof DEMO_LOCATIONS = [];
    for (let i = 0; i < batchSize; i++) {
      batch.push(DEMO_LOCATIONS[(idx + i) % DEMO_LOCATIONS.length]);
    }

    overlaysRef.current.forEach((o) => {
      const div = (o as any)._div as HTMLDivElement | undefined;
      if (div) {
        div.style.transform = "translate(-50%, -100%) scale(0)";
        div.style.opacity = "0";
      }
      setTimeout(() => o.setMap(null), 400);
    });
    overlaysRef.current = [];

    const primary = batch[0];
    typeQuery(primary.label, () => {
      map.panTo({ lat: primary.lat, lng: primary.lng });

      batch.forEach((loc, i) => {
        const overlay = createDemoOverlay(map, loc.lat, loc.lng, loc.emoji, 300 + i * 200);
        overlaysRef.current.push(overlay);
      });

      sequenceRef.current++;
      animationRef.current = setTimeout(() => runSequence(map), 4500);
    });
  }, [typeQuery, createDemoOverlay]);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !mapRef.current) return;

    const darkMinimalStyles = [...DARK_STYLE, ...getLabelDensityStyles("minimal")];

    const initMap = () => {
      if (!mapRef.current || !window.google) return;

      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 40.7380, lng: -73.9900 },
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "none",
        keyboardShortcuts: false,
        styles: darkMinimalStyles,
      });

      mapInstanceRef.current = map;

      google.maps.event.addListenerOnce(map, "tilesloaded", () => {
        onReady?.();
        animationRef.current = setTimeout(() => runSequence(map), 1200);
      });
    };

    if (window.google?.maps) {
      initMap();
    } else {
      if (window.__googleMapsLoading) {
        window.__googleMapsCallbacks = window.__googleMapsCallbacks || [];
        window.__googleMapsCallbacks.push(initMap);
      } else {
        window.__googleMapsLoading = true;
        window.__googleMapsCallbacks = [initMap];

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=marker`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          window.__googleMapsCallbacks?.forEach((cb) => cb());
          window.__googleMapsCallbacks = [];
        };
        document.head.appendChild(script);
      }
    }

    return () => {
      if (animationRef.current) clearTimeout(animationRef.current);
      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];
    };
  }, [runSequence, onReady]);

  return (
    <div className="absolute inset-0">
      <div ref={mapRef} className="h-full w-full" />

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10">
        <div
          className="bg-black/50 backdrop-blur-lg rounded-full px-5 py-3 shadow-lg border border-white/10 min-w-[320px] flex items-center gap-3"
          data-testid="landing-search-demo"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40 shrink-0">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span className="text-sm text-white/50 truncate">
            {currentQuery || "searching places..."}
            {isTyping && <span className="inline-block w-[2px] h-[14px] bg-white/60 ml-0.5 animate-pulse align-middle" />}
          </span>
        </div>
      </div>
    </div>
  );
}
