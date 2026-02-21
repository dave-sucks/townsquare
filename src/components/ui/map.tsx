"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

type MapContextValue = {
  map: google.maps.Map | null;
  isLoaded: boolean;
};

const MapContext = createContext<MapContextValue | null>(null);

function useMap() {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error("useMap must be used within a Map component");
  }
  return context;
}

type MapRef = google.maps.Map;

type MapProps = {
  children?: ReactNode;
  className?: string;
  center?: [number, number];
  zoom?: number;
  mapTypeId?: string;
  styles?: google.maps.MapTypeStyle[];
  disableDefaultUI?: boolean;
};

const DefaultLoader = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-muted">
    <div className="flex gap-1">
      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-pulse" />
      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:150ms]" />
      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:300ms]" />
    </div>
  </div>
);

const Map = forwardRef<MapRef, MapProps>(function Map(
  {
    children,
    className,
    center = [-74.006, 40.7128],
    zoom = 12,
    mapTypeId = "roadmap",
    styles,
    disableDefaultUI = true,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useImperativeHandle(ref, () => mapInstance as google.maps.Map, [mapInstance]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    loadGoogleMaps().then(() => {
      if (cancelled || !containerRef.current) return;

      const map = new google.maps.Map(containerRef.current, {
        center: { lat: center[1], lng: center[0] },
        zoom,
        mapTypeId,
        styles: styles || [],
        disableDefaultUI: true,
        zoomControl: false,
        clickableIcons: false,
        gestureHandling: "greedy",
      });

      setMapInstance(map);

      google.maps.event.addListenerOnce(map, "tilesloaded", () => {
        if (!cancelled) setIsLoaded(true);
      });
    });

    return () => {
      cancelled = true;
      setIsLoaded(false);
      setMapInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contextValue = useMemo(
    () => ({ map: mapInstance, isLoaded }),
    [mapInstance, isLoaded]
  );

  return (
    <MapContext.Provider value={contextValue}>
      <div className={cn("relative w-full h-full", className)}>
        <div ref={containerRef} className="absolute inset-0 z-0" />
        {!isLoaded && <DefaultLoader />}
        {mapInstance && isLoaded && children}
      </div>
    </MapContext.Provider>
  );
});

interface HtmlOverlayInstance extends google.maps.OverlayView {
  position: google.maps.LatLng;
  container: HTMLDivElement;
  setPosition(position: google.maps.LatLng): void;
}

function createHtmlOverlay(position: google.maps.LatLng, container: HTMLDivElement): HtmlOverlayInstance {
  const overlay = new google.maps.OverlayView() as HtmlOverlayInstance;
  overlay.position = position;
  overlay.container = container;

  overlay.onAdd = function () {
    const pane = this.getPanes()?.overlayMouseTarget;
    if (pane) {
      pane.appendChild(this.container);
    }
  };

  overlay.draw = function () {
    const projection = this.getProjection();
    if (!projection) return;
    const pos = projection.fromLatLngToDivPixel(this.position);
    if (pos) {
      this.container.style.position = "absolute";
      this.container.style.left = `${pos.x}px`;
      this.container.style.top = `${pos.y}px`;
      this.container.style.transform = "translate(-50%, -50%)";
    }
  };

  overlay.onRemove = function () {
    try {
      if (this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    } catch (e) {
    }
  };

  overlay.setPosition = function (newPosition: google.maps.LatLng) {
    this.position = newPosition;
    this.draw();
  };

  return overlay;
}

type MarkerContextValue = {
  container: HTMLDivElement;
};

const MarkerContext = createContext<MarkerContextValue | null>(null);

type MapMarkerProps = {
  longitude: number;
  latitude: number;
  children: ReactNode;
  onClick?: (e: MouseEvent) => void;
  onMouseEnter?: (e: MouseEvent) => void;
  onMouseLeave?: (e: MouseEvent) => void;
};

function MapMarker({
  longitude,
  latitude,
  children,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: MapMarkerProps) {
  const { map } = useMap();
  const overlayRef = useRef<HtmlOverlayInstance | null>(null);
  const [container] = useState(() => {
    const el = document.createElement("div");
    el.style.cursor = "pointer";
    return el;
  });

  const callbacksRef = useRef({ onClick, onMouseEnter, onMouseLeave });
  callbacksRef.current = { onClick, onMouseEnter, onMouseLeave };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => callbacksRef.current.onClick?.(e);
    const handleMouseEnter = (e: MouseEvent) => callbacksRef.current.onMouseEnter?.(e);
    const handleMouseLeave = (e: MouseEvent) => callbacksRef.current.onMouseLeave?.(e);

    container.addEventListener("click", handleClick);
    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      container.removeEventListener("click", handleClick);
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [container]);

  useEffect(() => {
    if (!map) return;

    const position = new google.maps.LatLng(latitude, longitude);
    const overlay = createHtmlOverlay(position, container);
    overlay.setMap(map);
    overlayRef.current = overlay;

    return () => {
      overlayRef.current = null;
      overlay.setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, container]);

  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.setPosition(new google.maps.LatLng(latitude, longitude));
    }
  }, [latitude, longitude]);

  return (
    <MarkerContext.Provider value={{ container }}>
      {children}
    </MarkerContext.Provider>
  );
}

function MarkerContent({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  const ctx = useContext(MarkerContext);
  if (!ctx?.container) return null;

  return createPortal(
    <div className={cn("cursor-pointer", className)}>
      {children || (
        <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-md" />
      )}
    </div>,
    ctx.container
  );
}

export {
  Map,
  MapMarker,
  MarkerContent,
  useMap,
  type MapRef,
  type MapProps,
};
