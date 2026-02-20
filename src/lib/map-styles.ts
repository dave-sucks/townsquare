export type MapStyleKey = "standard" | "satellite" | "terrain" | "silver" | "retro" | "dark" | "night" | "aubergine";

export interface MapStyleConfig {
  id: MapStyleKey;
  name: string;
  mapTypeId?: string;
  styles?: google.maps.MapTypeStyle[];
}

const SILVER_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
  { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
];

const RETRO_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#ebe3cd" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#523735" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f1e6" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#c9b2a6" }] },
  { featureType: "administrative.land_parcel", elementType: "geometry.stroke", stylers: [{ color: "#dcd2be" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#ae9e90" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#dfd2ae" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#dfd2ae" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#93817c" }] },
  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#a5b076" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#447530" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#f5f1e6" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#fdfcf8" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f8c967" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#e9bc62" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#e98d58" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry.stroke", stylers: [{ color: "#db8555" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#806b63" }] },
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#dfd2ae" }] },
  { featureType: "transit.line", elementType: "labels.text.fill", stylers: [{ color: "#8f7d77" }] },
  { featureType: "transit.line", elementType: "labels.text.stroke", stylers: [{ color: "#ebe3cd" }] },
  { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#dfd2ae" }] },
  { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#b9d3c2" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#92998d" }] },
];

const DARK_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "poi.park", elementType: "labels.text.stroke", stylers: [{ color: "#1b1b1b" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#4e4e4e" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] },
];

const NIGHT_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
];

const AUBERGINE_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#64779e" }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
  { featureType: "landscape.man_made", elementType: "geometry.stroke", stylers: [{ color: "#334e87" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#023e58" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283d6a" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6f9ba5" }] },
  { featureType: "poi", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#023e58" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#3C7680" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
  { featureType: "road", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c6675" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#255763" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#b0d5ce" }] },
  { featureType: "road.highway", elementType: "labels.text.stroke", stylers: [{ color: "#023e58" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
  { featureType: "transit", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
  { featureType: "transit.line", elementType: "geometry.fill", stylers: [{ color: "#283d6a" }] },
  { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#3a4762" }] },
  { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#071f3b" }] }, // deep navy-purple
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4e6d70" }] },
];

export const MAP_STYLES: MapStyleConfig[] = [
  { id: "standard", name: "Standard" },
  { id: "satellite", name: "Satellite", mapTypeId: "satellite" },
  { id: "terrain", name: "Terrain", mapTypeId: "terrain" },
  { id: "silver", name: "Silver", styles: SILVER_STYLES },
  { id: "retro", name: "Retro", styles: RETRO_STYLES },
  { id: "dark", name: "Dark", styles: DARK_STYLES },
  { id: "night", name: "Night", styles: NIGHT_STYLES },
  { id: "aubergine", name: "Aubergine", styles: AUBERGINE_STYLES },
];

export const DEFAULT_MAP_STYLE: MapStyleKey = "standard";

export function getMapStyleConfig(styleKey: MapStyleKey): MapStyleConfig {
  return MAP_STYLES.find((s) => s.id === styleKey) || MAP_STYLES[0];
}

export function applyMapStyle(map: google.maps.Map, styleKey: MapStyleKey) {
  const config = getMapStyleConfig(styleKey);
  
  const mapTypeId = config.mapTypeId || "roadmap";
  if (map.getMapTypeId() !== mapTypeId) {
    map.setMapTypeId(mapTypeId);
  }
  
  if (config.styles) {
    map.setOptions({ styles: config.styles });
  } else if (!config.mapTypeId) {
    map.setOptions({ styles: [] });
  }
}

export const MAP_STYLE_STORAGE_KEY = "twnsq-map-style";
export const MAP_LABEL_DENSITY_STORAGE_KEY = "twnsq-map-label-density";

export type LabelDensity = "minimal" | "low" | "normal" | "full";

export const LABEL_DENSITY_OPTIONS: { id: LabelDensity; name: string; description: string }[] = [
  { id: "minimal", name: "Minimal", description: "Only major cities" },
  { id: "low", name: "Low", description: "Less clutter" },
  { id: "normal", name: "Normal", description: "Default" },
  { id: "full", name: "Full", description: "All labels" },
];

export const DEFAULT_LABEL_DENSITY: LabelDensity = "minimal";

function buildDensityStyles(density: LabelDensity): google.maps.MapTypeStyle[] {
  const styles: google.maps.MapTypeStyle[] = [];
  
  switch (density) {
    case "minimal":
      styles.push(
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "road.arterial", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "administrative.neighborhood", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "administrative.land_parcel", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] },
      );
      break;
    case "low":
      styles.push(
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "administrative.land_parcel", elementType: "labels", stylers: [{ visibility: "off" }] },
      );
      break;
    case "normal":
      styles.push(
        { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        { featureType: "administrative.land_parcel", elementType: "labels", stylers: [{ visibility: "off" }] },
      );
      break;
    case "full":
      break;
  }
  
  return styles;
}

export function applyLabelDensity(map: google.maps.Map, density: LabelDensity, styleKey: MapStyleKey) {
  const config = getMapStyleConfig(styleKey);
  
  if (config.mapTypeId === "satellite" || config.mapTypeId === "terrain") return;
  
  const baseStyles = config.styles || [];
  const densityStyles = buildDensityStyles(density);
  map.setOptions({ styles: [...baseStyles, ...densityStyles] });
}

export function getStoredMapStyle(): MapStyleKey {
  if (typeof window === "undefined") return DEFAULT_MAP_STYLE;
  try {
    const stored = localStorage.getItem(MAP_STYLE_STORAGE_KEY);
    if (stored && MAP_STYLES.some(s => s.id === stored)) {
      return stored as MapStyleKey;
    }
  } catch (e) {}
  return DEFAULT_MAP_STYLE;
}

export function saveMapStyle(styleKey: MapStyleKey) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MAP_STYLE_STORAGE_KEY, styleKey);
  } catch (e) {}
}

export function getStoredLabelDensity(): LabelDensity {
  if (typeof window === "undefined") return DEFAULT_LABEL_DENSITY;
  try {
    const stored = localStorage.getItem(MAP_LABEL_DENSITY_STORAGE_KEY);
    if (stored && LABEL_DENSITY_OPTIONS.some(o => o.id === stored)) {
      return stored as LabelDensity;
    }
  } catch (e) {}
  return DEFAULT_LABEL_DENSITY;
}

export function saveLabelDensity(density: LabelDensity) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MAP_LABEL_DENSITY_STORAGE_KEY, density);
  } catch (e) {}
}
