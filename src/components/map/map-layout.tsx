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
import { SearchBar } from "@/components/map/search-bar";
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
  userId?: string | null;
  placeId: string;
  hasBeen: boolean;
  rating: number | null;
  emoji?: string | null;
  visitedAt?: string | null;
  createdAt?: string;
  place: Place;
  savedBy?: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  } | null;
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
  showAvatars?: boolean;
  disableFitToPlaces?: boolean;
  // Search bar props (passed through to SearchBar)
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  locationLabel?: string;
  isCustomLocation?: boolean;
  onOpenSearch?: () => void;
  onOpenLocation?: () => void;
  onClearSearch?: () => void;
  onClearLocation?: () => void;
  onOverlayClick?: () => void;
  searchCenter?: { lat: number; lng: number };
  isSearchOpen?: boolean;
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
  showAvatars = false,
  disableFitToPlaces = false,
  searchQuery,
  onSearchQueryChange,
  locationLabel,
  isCustomLocation,
  onOpenSearch,
  onOpenLocation,
  onClearSearch,
  onClearLocation,
  onOverlayClick,
  searchCenter,
  isSearchOpen = false,
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

  const handleMarkerClick = useCallback(
    (savedPlaceId: string) => {
      onPlaceSelect(savedPlaceId);
      triggerSnapRequest("mid");
      const selectedPlace = places.find((p) => p.id === savedPlaceId);
      if (selectedPlace && mapRef.current) {
        mapRef.current.panTo(selectedPlace.place.lat, selectedPlace.place.lng);
      }
      const rowElement = placeRowRefs.current.get(savedPlaceId);
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [onPlaceSelect, triggerSnapRequest, places]
  );

  const handleSidebarPlaceSelect = useCallback(
    (savedPlaceId: string) => {
      onPlaceSelect(savedPlaceId);
      triggerSnapRequest("mid");
      const selectedPlace = places.find((p) => p.id === savedPlaceId);
      if (selectedPlace && mapRef.current) {
        mapRef.current.panTo(selectedPlace.place.lat, selectedPlace.place.lng);
      }
    },
    [places, onPlaceSelect, triggerSnapRequest]
  );

  useEffect(() => {
    if (selectedPlaceId) {
      const selectedPlace = places.find((p) => p.id === selectedPlaceId);
      if (selectedPlace && mapRef.current) {
        mapRef.current.panTo(selectedPlace.place.lat, selectedPlace.place.lng);
      }
    }
  }, [selectedPlaceId, places]);

  useEffect(() => {
    if (searchCenter && mapRef.current) {
      mapRef.current.panTo(searchCenter.lat, searchCenter.lng);
      mapRef.current.setZoom(11);
    }
  }, [searchCenter]);

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
        {/* Transparent backdrop — sits below the sidebar (z-9) so clicking the map closes panels */}
        {onOverlayClick && (
          <div className="absolute inset-0 z-[9]" onClick={onOverlayClick} />
        )}

        <PlaceMap
          ref={mapRef}
          places={places}
          selectedPlaceId={selectedPlaceId}
          onMarkerClick={handleMarkerClick}
          showSettings={showMapSettings}
          showAvatars={showAvatars}
          disableFitToPlaces={disableFitToPlaces}
        />

        {/* ── Desktop: left column with search above panel ──────────── */}
        <div className="absolute top-0 left-0 bottom-0 z-10 w-[25rem] p-3 hidden md:flex flex-col gap-2">
          {showSearch && (
            <SearchBar
              onOpen={onOpenSearch ?? (() => {})}
              onClose={onOverlayClick}
              searchQuery={searchQuery}
              onSearchQueryChange={onSearchQueryChange}
              locationLabel={locationLabel}
              isCustomLocation={isCustomLocation}
              onClearSearch={onClearSearch}
              onClearLocation={onClearLocation}
              isSearchOpen={isSearchOpen}
            />
          )}
          <div className="flex-1 bg-background rounded-lg border shadow-lg overflow-hidden min-h-0">
            {renderChildrenWithProps(children)}
          </div>
        </div>

        {/* ── Mobile: search floats at top ──────────────────────────── */}
        {showSearch && (
          <div className="absolute top-3 left-3 right-3 z-[55] md:hidden">
            <SearchBar
              onOpen={onOpenSearch ?? (() => {})}
              onClose={onOverlayClick}
              searchQuery={searchQuery}
              onSearchQueryChange={onSearchQueryChange}
              locationLabel={locationLabel}
              isCustomLocation={isCustomLocation}
              onClearSearch={onClearSearch}
              onClearLocation={onClearLocation}
              isSearchOpen={isSearchOpen}
            />
          </div>
        )}

        {/* ── Mobile: bottom sheet panel ───────────────────────────── */}
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
