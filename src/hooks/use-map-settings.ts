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

const RADIUS_STORAGE_KEY = "beli-map-radius";
const TRAFFIC_STORAGE_KEY = "beli-map-traffic";
const TRANSIT_STORAGE_KEY = "beli-map-transit";

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

function getStoredTraffic(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(TRAFFIC_STORAGE_KEY) === "true";
  } catch (e) {}
  return false;
}

function saveTraffic(show: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TRAFFIC_STORAGE_KEY, String(show));
  } catch (e) {}
}

function getStoredTransit(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(TRANSIT_STORAGE_KEY) === "true";
  } catch (e) {}
  return false;
}

function saveTransit(show: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TRANSIT_STORAGE_KEY, String(show));
  } catch (e) {}
}

export function useMapSettings() {
  const [style, setStyleState] = useState<MapStyleKey>(DEFAULT_MAP_STYLE);
  const [labelDensity, setLabelDensityState] = useState<LabelDensity>(DEFAULT_LABEL_DENSITY);
  const [radius, setRadiusState] = useState(1);
  const [showTraffic, setShowTrafficState] = useState(false);
  const [showTransit, setShowTransitState] = useState(false);

  useEffect(() => {
    setStyleState(getStoredMapStyle());
    setLabelDensityState(getStoredLabelDensity());
    setRadiusState(getStoredRadius());
    setShowTrafficState(getStoredTraffic());
    setShowTransitState(getStoredTransit());
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

  const setShowTraffic = useCallback((show: boolean) => {
    setShowTrafficState(show);
    saveTraffic(show);
    window.dispatchEvent(new CustomEvent("map-traffic-change", { detail: show }));
  }, []);

  const setShowTransit = useCallback((show: boolean) => {
    setShowTransitState(show);
    saveTransit(show);
    window.dispatchEvent(new CustomEvent("map-transit-change", { detail: show }));
  }, []);

  return {
    style,
    setStyle,
    labelDensity,
    setLabelDensity,
    radius,
    setRadius,
    showTraffic,
    setShowTraffic,
    showTransit,
    setShowTransit,
  };
}
