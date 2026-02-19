export type MapStyleKey = "standard" | "satellite" | "terrain" | "silver" | "retro" | "dark" | "night" | "aubergine";

export interface MapStyleConfig {
  id: MapStyleKey;
  name: string;
  style: string | object;
  cssFilter?: string;
}

const CARTO_VOYAGER = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const CARTO_POSITRON = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const CARTO_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const CARTO_POSITRON_NOLABELS = "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json";
const CARTO_DARK_NOLABELS = "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json";
const CARTO_VOYAGER_NOLABELS = "https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json";

const SATELLITE_STYLE = {
  version: 8 as const,
  sources: {
    satellite: {
      type: "raster" as const,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [
    { id: "satellite", type: "raster" as const, source: "satellite" },
  ],
};

const TERRAIN_STYLE = {
  version: 8 as const,
  sources: {
    terrain: {
      type: "raster" as const,
      tiles: ["https://tile.opentopomap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 17,
      attribution: "OpenTopoMap contributors",
    },
  },
  layers: [
    { id: "terrain", type: "raster" as const, source: "terrain" },
  ],
};

export const MAP_STYLES: MapStyleConfig[] = [
  { id: "standard", name: "Standard", style: CARTO_VOYAGER },
  { id: "satellite", name: "Satellite", style: SATELLITE_STYLE },
  { id: "terrain", name: "Terrain", style: TERRAIN_STYLE },
  { id: "silver", name: "Silver", style: CARTO_POSITRON },
  { id: "retro", name: "Retro", style: CARTO_VOYAGER, cssFilter: "sepia(0.3) saturate(0.7) brightness(1.05)" },
  { id: "dark", name: "Dark", style: CARTO_DARK },
  { id: "night", name: "Night", style: CARTO_DARK, cssFilter: "brightness(0.85) saturate(0.9) hue-rotate(15deg)" },
  { id: "aubergine", name: "Aubergine", style: CARTO_DARK, cssFilter: "hue-rotate(290deg) saturate(0.65) brightness(0.95)" },
];

export const DEFAULT_MAP_STYLE: MapStyleKey = "standard";

export function getMapStyleConfig(styleKey: MapStyleKey): MapStyleConfig {
  return MAP_STYLES.find((s) => s.id === styleKey) || MAP_STYLES[0];
}

export function getMapStyle(styleKey: MapStyleKey): string | object {
  return getMapStyleConfig(styleKey).style;
}

export function getMapCssFilter(styleKey: MapStyleKey): string {
  return getMapStyleConfig(styleKey).cssFilter || "none";
}

export function getStyleForDensity(styleKey: MapStyleKey, density: LabelDensity): string | object {
  const config = getMapStyleConfig(styleKey);
  if (density === "minimal" && typeof config.style === "string") {
    if (config.style === CARTO_DARK) return CARTO_DARK_NOLABELS;
    if (config.style === CARTO_POSITRON) return CARTO_POSITRON_NOLABELS;
    if (config.style === CARTO_VOYAGER) return CARTO_VOYAGER_NOLABELS;
  }
  return config.style;
}

export const MAP_STYLE_STORAGE_KEY = "twnsq-map-style";
export const MAP_LABEL_DENSITY_STORAGE_KEY = "twnsq-map-label-density";

export type LabelDensity = "minimal" | "low" | "normal" | "full";

export const LABEL_DENSITY_OPTIONS: { id: LabelDensity; name: string; description: string }[] = [
  { id: "minimal", name: "Minimal", description: "Only major roads" },
  { id: "low", name: "Low", description: "Less clutter" },
  { id: "normal", name: "Normal", description: "Default" },
  { id: "full", name: "Full", description: "All labels" },
];

export const DEFAULT_LABEL_DENSITY: LabelDensity = "normal";

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
