"use client";

import {
  useRef,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
  type ReactElement,
  cloneElement,
  isValidElement,
} from "react";
import type { SnapPoint } from "@/components/bottom-sheet";
import { PlaceMap, type PlaceMapHandle } from "@/components/place-map";
import { BottomSheet } from "@/components/bottom-sheet";
import { AppShell } from "@/components/layout";

interface Place {
  id: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  primaryType: string | null;
  types: string[] | null;
  priceLevel: string | null;
  photoRefs: string[] | null;
}

interface SavedPlace {
  id: string;
  userId?: string;
  placeId: string;
  hasBeen: boolean;
  rating: number | null;
  visitedAt?: string | null;
  createdAt?: string;
  place: Place;
}

interface UserData {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

export interface SidebarInjectedProps {
  selectedPlaceId: string | null;
  onPlaceSelect: (savedPlaceId: string) => void;
  placeRowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

interface MapLayoutProps {
  user: UserData | null;
  places: SavedPlace[];
  children: ReactNode;
  selectedPlaceId: string | null;
  onPlaceSelect: (savedPlaceId: string) => void;
  showMapSettings?: boolean;
  showSearch?: boolean;
  sheetComponent?: ReactNode;
}

export function MapLayout({
  user,
  places,
  children,
  selectedPlaceId,
  onPlaceSelect,
  showMapSettings = true,
  showSearch = false,
  sheetComponent,
}: MapLayoutProps) {
  const placeRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const mapRef = useRef<PlaceMapHandle>(null);
  const [sheetSnapRequest, setSheetSnapRequest] = useState<SnapPoint | null>(null);

  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSnapRequest = useCallback((point: SnapPoint) => {
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    setSheetSnapRequest(point);
    snapTimerRef.current = setTimeout(() => setSheetSnapRequest(null), 500);
  }, []);

  useEffect(() => {
    return () => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    };
  }, []);

  const handleMarkerClick = useCallback((savedPlaceId: string) => {
    onPlaceSelect(savedPlaceId);
    triggerSnapRequest("mid");
    const rowElement = placeRowRefs.current.get(savedPlaceId);
    if (rowElement) {
      rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [onPlaceSelect, triggerSnapRequest]);

  const handleSidebarPlaceSelect = useCallback((savedPlaceId: string) => {
    onPlaceSelect(savedPlaceId);
    triggerSnapRequest("mid");
    const selectedPlace = places.find(p => p.id === savedPlaceId);
    if (selectedPlace && mapRef.current) {
      mapRef.current.panTo(selectedPlace.place.lat, selectedPlace.place.lng);
    }
  }, [places, onPlaceSelect, triggerSnapRequest]);

  useEffect(() => {
    if (selectedPlaceId) {
      const selectedPlace = places.find(p => p.id === selectedPlaceId);
      if (selectedPlace && mapRef.current) {
        mapRef.current.panTo(selectedPlace.place.lat, selectedPlace.place.lng);
      }
    }
  }, [selectedPlaceId, places]);

  const injectedProps: SidebarInjectedProps = {
    selectedPlaceId,
    onPlaceSelect: handleSidebarPlaceSelect,
    placeRowRefs,
  };

  const renderChildrenWithProps = (children: ReactNode): ReactNode => {
    if (isValidElement(children)) {
      return cloneElement(children as ReactElement<SidebarInjectedProps>, injectedProps);
    }
    return children;
  };

  return (
    <AppShell user={user}>
      <div className="relative flex-1 overflow-hidden">
        <PlaceMap
          ref={mapRef}
          places={places}
          selectedPlaceId={selectedPlaceId}
          onMarkerClick={handleMarkerClick}
          showSettings={showMapSettings}
          showSearch={showSearch}
        />

        <div className="absolute top-0 left-0 bottom-0 z-10 w-[25rem] p-3 hidden md:block">
          <div className="h-full bg-background rounded-lg border shadow-lg overflow-hidden">
            {renderChildrenWithProps(children)}
          </div>
        </div>

        <div className="md:hidden">
          <BottomSheet defaultSnapPoint="mid" requestedSnapPoint={sheetSnapRequest}>
            {renderChildrenWithProps(children)}
          </BottomSheet>
        </div>
      </div>

      {sheetComponent}
    </AppShell>
  );
}
