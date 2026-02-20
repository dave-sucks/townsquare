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
  { id: "retro", name: "Retro", style: CARTO_VOYAGER, cssFilter: "sepia(0.35) saturate(0.65) brightness(1.05) contrast(1.05)" },
  { id: "dark", name: "Dark", style: CARTO_DARK },
  { id: "night", name: "Night", style: CARTO_DARK, cssFilter: "brightness(0.8) saturate(0.85) hue-rotate(20deg)" },
  { id: "aubergine", name: "Aubergine", style: CARTO_DARK, cssFilter: "hue-rotate(280deg) saturate(0.55) brightness(0.9)" },
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

export function isRasterStyle(styleKey: MapStyleKey): boolean {
  return styleKey === "satellite" || styleKey === "terrain";
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

export const DEFAULT_LABEL_DENSITY: LabelDensity = "normal";

const LABEL_LAYERS_MINIMAL_HIDE = [
  "waterway_label", "watername_lake", "watername_lake_line", "watername_sea",
  "place_hamlet", "place_suburbs", "place_villages", "place_town",
  "poi_stadium", "poi_park",
  "roadname_minor", "roadname_sec", "roadname_pri", "roadname_major",
  "housenumber",
];

const LABEL_LAYERS_LOW_HIDE = [
  "waterway_label", "watername_lake_line",
  "place_hamlet", "place_suburbs",
  "poi_stadium", "poi_park",
  "roadname_minor",
  "housenumber",
];

const LABEL_LAYERS_NORMAL_HIDE = [
  "housenumber",
  "place_hamlet",
];

const ROAD_LAYERS_MINIMAL_HIDE = [
  "road_service_case", "road_service_fill",
  "road_minor_case", "road_minor_fill",
  "road_path",
  "tunnel_path", "tunnel_service_case", "tunnel_service_fill",
  "tunnel_minor_case", "tunnel_minor_fill",
  "bridge_path", "bridge_service_case", "bridge_service_fill",
  "bridge_minor_case", "bridge_minor_fill",
];

const ROAD_LAYERS_LOW_HIDE = [
  "road_service_case", "road_service_fill",
  "road_path",
  "tunnel_path", "tunnel_service_case", "tunnel_service_fill",
  "bridge_path", "bridge_service_case", "bridge_service_fill",
];

const ALL_DENSITY_LAYERS = [...new Set([
  ...LABEL_LAYERS_MINIMAL_HIDE,
  ...LABEL_LAYERS_LOW_HIDE,
  ...LABEL_LAYERS_NORMAL_HIDE,
  ...ROAD_LAYERS_MINIMAL_HIDE,
  ...ROAD_LAYERS_LOW_HIDE,
])];

export function applyLabelDensity(map: any, density: LabelDensity, styleKey: MapStyleKey) {
  if (isRasterStyle(styleKey)) return;
  if (!map.isStyleLoaded()) return;

  try {
    ALL_DENSITY_LAYERS.forEach(layerId => {
      try {
        map.setLayoutProperty(layerId, "visibility", "visible");
      } catch (e) {}
    });

    let layersToHide: string[] = [];

    switch (density) {
      case "minimal":
        layersToHide = [...LABEL_LAYERS_MINIMAL_HIDE, ...ROAD_LAYERS_MINIMAL_HIDE];
        break;
      case "low":
        layersToHide = [...LABEL_LAYERS_LOW_HIDE, ...ROAD_LAYERS_LOW_HIDE];
        break;
      case "normal":
        layersToHide = LABEL_LAYERS_NORMAL_HIDE;
        break;
      case "full":
        break;
    }

    layersToHide.forEach(layerId => {
      try {
        map.setLayoutProperty(layerId, "visibility", "none");
      } catch (e) {}
    });
  } catch (e) {}
}

export function applyLabelDensityWhenReady(map: any, density: LabelDensity, styleKey: MapStyleKey) {
  if (isRasterStyle(styleKey)) return;
  if (map.isStyleLoaded()) {
    applyLabelDensity(map, density, styleKey);
  } else {
    map.once("idle", () => {
      applyLabelDensity(map, density, styleKey);
    });
  }
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
