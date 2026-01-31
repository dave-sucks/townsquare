// Google Maps style definitions for different themes

export type MapStyleKey = "standard" | "satellite" | "terrain" | "silver" | "retro" | "dark" | "night" | "aubergine";

export interface MapStyleConfig {
  id: MapStyleKey;
  name: string;
  mapTypeId?: google.maps.MapTypeId;
  styles?: google.maps.MapTypeStyle[];
}

export const SILVER_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
];

export const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
];

export const NIGHT_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
];

export const RETRO_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#ebe3cd" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#523735" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f1e6" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#f5f1e6" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f8c967" }] },
  { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#b9d3c2" }] },
  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#a5b076" }] },
];

export const AUBERGINE_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c6675" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283d6a" }] },
];

export const MAP_STYLES: MapStyleConfig[] = [
  { id: "standard", name: "Standard" },
  { id: "satellite", name: "Satellite", mapTypeId: "satellite" as google.maps.MapTypeId },
  { id: "terrain", name: "Terrain", mapTypeId: "terrain" as google.maps.MapTypeId },
  { id: "silver", name: "Silver", styles: SILVER_STYLE },
  { id: "retro", name: "Retro", styles: RETRO_STYLE },
  { id: "dark", name: "Dark", styles: DARK_STYLE },
  { id: "night", name: "Night", styles: NIGHT_STYLE },
  { id: "aubergine", name: "Aubergine", styles: AUBERGINE_STYLE },
];

export const DEFAULT_MAP_STYLE: MapStyleKey = "retro";

export function getMapStyleConfig(styleKey: MapStyleKey): MapStyleConfig {
  return MAP_STYLES.find((s) => s.id === styleKey) || MAP_STYLES[0];
}

export function applyMapStyle(map: google.maps.Map, styleKey: MapStyleKey) {
  const config = getMapStyleConfig(styleKey);
  
  if (config.mapTypeId) {
    map.setMapTypeId(config.mapTypeId);
    map.setOptions({ styles: [] });
  } else {
    map.setMapTypeId("roadmap");
    map.setOptions({ styles: config.styles || [] });
  }
}

// Storage key for persisting map style preference
export const MAP_STYLE_STORAGE_KEY = "beli-map-style";

export function getStoredMapStyle(): MapStyleKey {
  if (typeof window === "undefined") return DEFAULT_MAP_STYLE;
  try {
    const stored = localStorage.getItem(MAP_STYLE_STORAGE_KEY);
    if (stored && MAP_STYLES.some(s => s.id === stored)) {
      return stored as MapStyleKey;
    }
  } catch (e) {
    // Ignore
  }
  return DEFAULT_MAP_STYLE;
}

export function saveMapStyle(styleKey: MapStyleKey) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MAP_STYLE_STORAGE_KEY, styleKey);
  } catch (e) {
    // Ignore
  }
}
