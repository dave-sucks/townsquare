"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { DARK_STYLE, getLabelDensityStyles } from "@/lib/map-styles";

const REACTION_EMOJIS = ["\u{1F525}", "\u{1F929}", "\u{1F60D}", "\u{2B50}", "\u{1F4AF}", "\u{1F44C}"];

const SEARCH_SEQUENCES = [
  {
    query: "best burger in NYC",
    centerLat: 40.7480,
    centerLng: -73.9850,
    pins: [
      { lat: 40.7580, lng: -73.9855, emoji: "\u{1F354}" },
      { lat: 40.7520, lng: -73.9920, emoji: "\u{1F354}" },
      { lat: 40.7440, lng: -73.9780, emoji: "\u{1F354}" },
      { lat: 40.7610, lng: -73.9700, emoji: "\u{1F525}" },
      { lat: 40.7380, lng: -73.9950, emoji: "\u{1F354}" },
      { lat: 40.7550, lng: -73.9650, emoji: "\u{1F929}" },
      { lat: 40.7650, lng: -73.9800, emoji: "\u{1F354}" },
      { lat: 40.7350, lng: -73.9870, emoji: "\u{1F525}" },
      { lat: 40.7490, lng: -74.0010, emoji: "\u{1F354}" },
      { lat: 40.7700, lng: -73.9750, emoji: "\u{1F44C}" },
    ],
  },
  {
    query: "sushi near Midtown",
    centerLat: 40.7550,
    centerLng: -73.9800,
    pins: [
      { lat: 40.7614, lng: -73.9776, emoji: "\u{1F363}" },
      { lat: 40.7550, lng: -73.9830, emoji: "\u{1F363}" },
      { lat: 40.7490, lng: -73.9720, emoji: "\u{1F363}" },
      { lat: 40.7580, lng: -73.9900, emoji: "\u{1F60D}" },
      { lat: 40.7640, lng: -73.9680, emoji: "\u{1F363}" },
      { lat: 40.7450, lng: -73.9860, emoji: "\u{2B50}" },
      { lat: 40.7520, lng: -73.9950, emoji: "\u{1F363}" },
      { lat: 40.7680, lng: -73.9750, emoji: "\u{1F363}" },
      { lat: 40.7410, lng: -73.9790, emoji: "\u{1F525}" },
      { lat: 40.7570, lng: -73.9630, emoji: "\u{1F363}" },
      { lat: 40.7700, lng: -73.9850, emoji: "\u{1F44C}" },
    ],
  },
  {
    query: "pizza in the Village",
    centerLat: 40.7320,
    centerLng: -73.9980,
    pins: [
      { lat: 40.7291, lng: -73.9965, emoji: "\u{1F355}" },
      { lat: 40.7340, lng: -74.0020, emoji: "\u{1F355}" },
      { lat: 40.7260, lng: -73.9900, emoji: "\u{1F525}" },
      { lat: 40.7380, lng: -73.9940, emoji: "\u{1F355}" },
      { lat: 40.7310, lng: -74.0080, emoji: "\u{1F355}" },
      { lat: 40.7220, lng: -73.9980, emoji: "\u{1F929}" },
      { lat: 40.7360, lng: -74.0060, emoji: "\u{1F355}" },
      { lat: 40.7190, lng: -74.0030, emoji: "\u{1F355}" },
      { lat: 40.7400, lng: -73.9880, emoji: "\u{2B50}" },
      { lat: 40.7250, lng: -74.0100, emoji: "\u{1F355}" },
    ],
  },
  {
    query: "ramen in Lower East Side",
    centerLat: 40.7200,
    centerLng: -73.9880,
    pins: [
      { lat: 40.7189, lng: -73.9890, emoji: "\u{1F35C}" },
      { lat: 40.7230, lng: -73.9840, emoji: "\u{1F35C}" },
      { lat: 40.7150, lng: -73.9920, emoji: "\u{1F525}" },
      { lat: 40.7210, lng: -73.9960, emoji: "\u{1F35C}" },
      { lat: 40.7170, lng: -73.9810, emoji: "\u{1F35C}" },
      { lat: 40.7260, lng: -73.9870, emoji: "\u{1F60D}" },
      { lat: 40.7130, lng: -73.9950, emoji: "\u{1F35C}" },
      { lat: 40.7240, lng: -73.9780, emoji: "\u{2B50}" },
      { lat: 40.7280, lng: -73.9930, emoji: "\u{1F35C}" },
      { lat: 40.7110, lng: -73.9860, emoji: "\u{1F35C}" },
    ],
  },
  {
    query: "coffee near Empire State",
    centerLat: 40.7500,
    centerLng: -73.9870,
    pins: [
      { lat: 40.7484, lng: -73.9857, emoji: "\u{2615}" },
      { lat: 40.7520, lng: -73.9900, emoji: "\u{2615}" },
      { lat: 40.7450, lng: -73.9810, emoji: "\u{2615}" },
      { lat: 40.7540, lng: -73.9830, emoji: "\u{1F525}" },
      { lat: 40.7470, lng: -73.9930, emoji: "\u{2615}" },
      { lat: 40.7510, lng: -73.9770, emoji: "\u{1F44C}" },
      { lat: 40.7430, lng: -73.9880, emoji: "\u{2615}" },
      { lat: 40.7560, lng: -73.9920, emoji: "\u{2615}" },
      { lat: 40.7490, lng: -73.9750, emoji: "\u{1F929}" },
      { lat: 40.7410, lng: -73.9960, emoji: "\u{2615}" },
    ],
  },
  {
    query: "tacos in Jersey City",
    centerLat: 40.7280,
    centerLng: -74.0500,
    pins: [
      { lat: 40.7282, lng: -74.0476, emoji: "\u{1F32E}" },
      { lat: 40.7320, lng: -74.0530, emoji: "\u{1F32E}" },
      { lat: 40.7250, lng: -74.0420, emoji: "\u{1F525}" },
      { lat: 40.7340, lng: -74.0580, emoji: "\u{1F32E}" },
      { lat: 40.7210, lng: -74.0500, emoji: "\u{1F32E}" },
      { lat: 40.7300, lng: -74.0380, emoji: "\u{1F929}" },
      { lat: 40.7360, lng: -74.0450, emoji: "\u{1F32E}" },
      { lat: 40.7190, lng: -74.0550, emoji: "\u{1F32E}" },
      { lat: 40.7270, lng: -74.0620, emoji: "\u{2B50}" },
      { lat: 40.7380, lng: -74.0400, emoji: "\u{1F32E}" },
    ],
  },
];

interface LandingMapProps {
  onReady?: () => void;
  showSearch?: boolean;
}

export function LandingMap({ onReady, showSearch = true }: LandingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<google.maps.OverlayView[]>([]);
  const [currentQuery, setCurrentQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sequenceRef = useRef(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const createDemoOverlay = useCallback((
    map: google.maps.Map,
    lat: number,
    lng: number,
    emoji: string,
    delay: number,
    size: number = 32
  ) => {
    const overlay = new google.maps.OverlayView();
    const position = new google.maps.LatLng(lat, lng);

    overlay.onAdd = function () {
      const div = document.createElement("div");
      div.style.cssText = `
        position: absolute;
        font-size: ${size}px;
        transform: translate(-50%, -100%) scale(0);
        transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease;
        opacity: 0;
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.7));
        pointer-events: none;
        z-index: 1;
      `;
      div.textContent = emoji;

      const panes = this.getPanes();
      panes?.overlayMouseTarget.appendChild(div);

      (this as any)._div = div;

      const t = setTimeout(() => {
        div.style.transform = "translate(-50%, -100%) scale(1)";
        div.style.opacity = "1";
      }, delay);
      timeoutsRef.current.push(t);
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
        animationRef.current = setTimeout(type, 50 + Math.random() * 40);
      } else {
        setIsTyping(false);
        animationRef.current = setTimeout(onComplete, 800);
      }
    };
    type();
  }, []);

  const runSequence = useCallback((map: google.maps.Map) => {
    const seq = SEARCH_SEQUENCES[sequenceRef.current % SEARCH_SEQUENCES.length];

    overlaysRef.current.forEach((o) => {
      const div = (o as any)._div as HTMLDivElement | undefined;
      if (div) {
        div.style.transform = "translate(-50%, -100%) scale(0)";
        div.style.opacity = "0";
      }
      const t = setTimeout(() => o.setMap(null), 500);
      timeoutsRef.current.push(t);
    });
    overlaysRef.current = [];

    typeQuery(seq.query, () => {
      map.panTo({ lat: seq.centerLat, lng: seq.centerLng });

      seq.pins.forEach((pin, i) => {
        const isReaction = REACTION_EMOJIS.includes(pin.emoji);
        const size = isReaction ? 24 : 36;
        const delay = 200 + i * 400;
        const overlay = createDemoOverlay(map, pin.lat, pin.lng, pin.emoji, delay, size);
        overlaysRef.current.push(overlay);
      });

      sequenceRef.current++;
      animationRef.current = setTimeout(() => runSequence(map), 7000);
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
        onReadyRef.current?.();
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
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];
    };
  }, [runSequence]);

  return (
    <div className="absolute inset-0">
      <div ref={mapRef} className="h-full w-full" />

      {showSearch && (
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
      )}
    </div>
  );
}
