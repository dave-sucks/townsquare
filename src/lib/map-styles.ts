export type MapStyleKey = "standard" | "satellite" | "terrain" | "silver" | "retro" | "dark" | "night" | "aubergine";

export interface MapStyleConfig {
  id: MapStyleKey;
  name: string;
  url: string;
}

const CARTO_VOYAGER = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const CARTO_POSITRON = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const CARTO_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const CARTO_POSITRON_NOLABELS = "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json";
const CARTO_DARK_NOLABELS = "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json";
const CARTO_VOYAGER_NOLABELS = "https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json";

export const MAP_STYLES: MapStyleConfig[] = [
  { id: "standard", name: "Standard", url: CARTO_VOYAGER },
  { id: "silver", name: "Silver", url: CARTO_POSITRON },
  { id: "retro", name: "Retro", url: CARTO_VOYAGER },
  { id: "dark", name: "Dark", url: CARTO_DARK },
  { id: "night", name: "Night", url: CARTO_DARK },
  { id: "aubergine", name: "Aubergine", url: CARTO_DARK },
  { id: "satellite", name: "Satellite", url: CARTO_VOYAGER },
  { id: "terrain", name: "Terrain", url: CARTO_POSITRON },
];

export const DEFAULT_MAP_STYLE: MapStyleKey = "standard";

export function getMapStyleConfig(styleKey: MapStyleKey): MapStyleConfig {
  return MAP_STYLES.find((s) => s.id === styleKey) || MAP_STYLES[0];
}

export function getMapStyleUrl(styleKey: MapStyleKey): string {
  return getMapStyleConfig(styleKey).url;
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

export function getLabelStyleUrl(styleKey: MapStyleKey, density: LabelDensity): string {
  if (density === "minimal") {
    const darkStyles: MapStyleKey[] = ["dark", "night", "aubergine"];
    return darkStyles.includes(styleKey) ? CARTO_DARK_NOLABELS : CARTO_POSITRON_NOLABELS;
  }
  return getMapStyleUrl(styleKey);
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
