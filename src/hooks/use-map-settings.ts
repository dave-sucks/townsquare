"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type MapStyleKey,
  type LabelDensity,
  getStoredMapStyle,
  saveMapStyle,
  getStoredLabelDensity,
  saveLabelDensity,
  DEFAULT_MAP_STYLE,
  DEFAULT_LABEL_DENSITY,
} from "@/lib/map-styles";

const RADIUS_STORAGE_KEY = "twnsq-map-radius";

function getStoredRadius(): number {
  if (typeof window === "undefined") return 1;
  try {
    const stored = localStorage.getItem(RADIUS_STORAGE_KEY);
    if (stored) return parseFloat(stored) || 1;
  } catch (e) {}
  return 1;
}

function saveRadius(radius: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RADIUS_STORAGE_KEY, String(radius));
  } catch (e) {}
}

export function useMapSettings() {
  const [style, setStyleState] = useState<MapStyleKey>(DEFAULT_MAP_STYLE);
  const [labelDensity, setLabelDensityState] = useState<LabelDensity>(DEFAULT_LABEL_DENSITY);
  const [radius, setRadiusState] = useState(1);

  useEffect(() => {
    setStyleState(getStoredMapStyle());
    setLabelDensityState(getStoredLabelDensity());
    setRadiusState(getStoredRadius());
  }, []);

  const setStyle = useCallback((newStyle: MapStyleKey) => {
    setStyleState(newStyle);
    saveMapStyle(newStyle);
    window.dispatchEvent(new CustomEvent("map-style-change", { detail: newStyle }));
  }, []);

  const setLabelDensity = useCallback((density: LabelDensity) => {
    setLabelDensityState(density);
    saveLabelDensity(density);
    window.dispatchEvent(new CustomEvent("map-label-density-change", { detail: density }));
  }, []);

  const setRadius = useCallback((newRadius: number) => {
    setRadiusState(newRadius);
    saveRadius(newRadius);
    window.dispatchEvent(new CustomEvent("map-radius-change", { detail: newRadius }));
  }, []);

  return {
    style,
    setStyle,
    labelDensity,
    setLabelDensity,
    radius,
    setRadius,
    showTraffic: false,
    setShowTraffic: () => {},
    showTransit: false,
    setShowTransit: () => {},
  };
}
