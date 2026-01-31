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

export function applyMapStyle(map: google.maps.Map, styleKey: MapStyleKey, labelDensity?: LabelDensity) {
  const config = getMapStyleConfig(styleKey);
  const density = labelDensity || getStoredLabelDensity();
  const labelStyles = getLabelDensityStyles(density);
  
  if (config.mapTypeId) {
    map.setMapTypeId(config.mapTypeId);
    // For satellite/terrain, we can still apply label density
    map.setOptions({ styles: labelStyles });
  } else {
    map.setMapTypeId("roadmap");
    // Merge base style with label density styles
    const combinedStyles = [...(config.styles || []), ...labelStyles];
    map.setOptions({ styles: combinedStyles });
  }
}

// Storage key for persisting map style preference
export const MAP_STYLE_STORAGE_KEY = "beli-map-style";
export const MAP_LABEL_DENSITY_STORAGE_KEY = "beli-map-label-density";

export type LabelDensity = "minimal" | "low" | "normal" | "full";

export const LABEL_DENSITY_OPTIONS: { id: LabelDensity; name: string; description: string }[] = [
  { id: "minimal", name: "Minimal", description: "Only major roads" },
  { id: "low", name: "Low", description: "Less clutter" },
  { id: "normal", name: "Normal", description: "Default" },
  { id: "full", name: "Full", description: "All labels" },
];

export const DEFAULT_LABEL_DENSITY: LabelDensity = "low";

// Label density style overrides - these get merged with the base style
export function getLabelDensityStyles(density: LabelDensity): google.maps.MapTypeStyle[] {
  switch (density) {
    case "minimal":
      return [
        // Hide all POI labels
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        // Hide transit labels
        { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
        // Hide local road labels
        { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },
        // Hide neighborhood labels
        { featureType: "administrative.neighborhood", elementType: "labels", stylers: [{ visibility: "off" }] },
        // Simplify highway labels
        { featureType: "road.highway", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
      ];
    case "low":
      return [
        // Hide most POI labels except parks
        { featureType: "poi.business", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "poi.attraction", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "poi.place_of_worship", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "poi.school", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "poi.medical", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "poi.government", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "poi.sports_complex", elementType: "labels", stylers: [{ visibility: "off" }] },
        // Hide transit labels
        { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        // Simplify local road labels
        { featureType: "road.local", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
      ];
    case "normal":
      return [
        // Hide some business clutter
        { featureType: "poi.business", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
      ];
    case "full":
    default:
      return [];
  }
}

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

export function getStoredLabelDensity(): LabelDensity {
  if (typeof window === "undefined") return DEFAULT_LABEL_DENSITY;
  try {
    const stored = localStorage.getItem(MAP_LABEL_DENSITY_STORAGE_KEY);
    if (stored && LABEL_DENSITY_OPTIONS.some(o => o.id === stored)) {
      return stored as LabelDensity;
    }
  } catch (e) {
    // Ignore
  }
  return DEFAULT_LABEL_DENSITY;
}

export function saveLabelDensity(density: LabelDensity) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MAP_LABEL_DENSITY_STORAGE_KEY, density);
  } catch (e) {
    // Ignore
  }
}
