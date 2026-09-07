/**
 * The MapLibre canvas for the Live Map.
 *
 * Loads `maplibre-gl` lazily on first mount (nothing about the map ships in
 * the entry bundle), builds the skin's plate style, draws the per-day route
 * as a dotted accent line over a paper halo, and places one HTML pin per
 * planned stop. Pins are React components rendered into MapLibre marker
 * elements through portals, so the same `MapPin` works here and in
 * parchment mode.
 *
 * Failure paths are explicit: no WebGL2, a library that fails to import,
 * or a tile source that never renders all report `error` and the overlay
 * falls back to parchment mode. Pins render before tiles arrive.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Map as MLMap, Marker as MLMarker, GeoJSONSource, LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre spawns its tile worker from a URL relative to its own module.
// Vite's dep pre-bundling (dev) and Rollup chunking (build) both move the
// module, so the relative URL 404s and the style never loads. Let Vite
// bundle the worker (it imports maplibre-gl-shared.mjs) as its own entry and
// hand MapLibre the resulting URL instead.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { SkinTokens } from "@/lib/skins/types";
import type { MapModel, MapPlace } from "@/lib/maps/build-map-places";
import { buildMapStyle } from "@/lib/maps/map-style";
import type { MarkerKind } from "@/lib/maps/taxonomy";
import { MapPin } from "./MapPin";

export type MapCanvasHandle = {
  fitAll: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

export type MapStatus = "loading" | "ready" | "error";

// Keeps every pin clear of the zoom/fit controls (top-right) and the
// selected-stop caption (bottom).
const FIT_PADDING = { top: 64, bottom: 96, left: 48, right: 88 };
const READY_TIMEOUT_MS = 12_000;

export function hasWebGL2(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

function routeGeoJSON(model: MapModel, hiddenDays: Set<number>) {
  return {
    type: "FeatureCollection" as const,
    features: model.segments
      .filter((s) => s.kind === "walk" && !hiddenDays.has(s.day))
      .map((s) => ({
        type: "Feature" as const,
        properties: { day: s.day },
        geometry: { type: "LineString" as const, coordinates: s.coordinates },
      })),
  };
}

export const MapCanvas = forwardRef<
  MapCanvasHandle,
  {
    model: MapModel;
    visible: MapPlace[];
    tokens: SkinTokens;
    palette: Record<MarkerKind, string>;
    hiddenDays: Set<number>;
    showRoute: boolean;
    showOrder: boolean;
    selectedKey: string | null;
    onSelect: (key: string | null) => void;
    onStatus: (status: MapStatus) => void;
  }
>(function MapCanvas(
  { model, visible, tokens, palette, hiddenDays, showRoute, showOrder, selectedKey, onSelect, onStatus },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markersRef = useRef<Map<string, { marker: MLMarker; el: HTMLDivElement }>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [mounts, setMounts] = useState<Array<{ key: string; el: HTMLDivElement }>>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  const bounds = model.bounds;
  const single = model.places.length === 1 ? model.places[0] : null;

  // Mount the map once.
  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    if (!hasWebGL2()) {
      onStatusRef.current("error");
      return;
    }
    onStatusRef.current("loading");
    let map: MLMap | null = null;
    let readyTimer: number | null = null;
    let errors = 0;
    let idle = false;

    import("maplibre-gl")
      .then((ml) => {
        if (cancelled) return;
        mlRef.current = ml;
        if (ml.getWorkerUrl() !== maplibreWorkerUrl) ml.setWorkerUrl(maplibreWorkerUrl);
        const style = buildMapStyle(tokens);
        map = new ml.Map({
          container,
          style,
          attributionControl: false,
          maxZoom: 18,
          minZoom: 2,
          fadeDuration: 120,
          ...(bounds && !single
            ? { bounds: bounds as LngLatBoundsLike, fitBoundsOptions: { padding: FIT_PADDING, maxZoom: 16 } }
            : single
              ? { center: [single.lng, single.lat] as [number, number], zoom: 15 }
              : { center: [0, 20] as [number, number], zoom: 2 }),
        });
        // The tile source's own attribution credits OpenFreeMap, OpenMapTiles
        // and OpenStreetMap (ODbL requires the last). `compact` left unset =
        // full text on wide plates, an expandable ⓘ under 640 px.
        map.addControl(new ml.AttributionControl({}), "bottom-right");
        map.on("click", () => onSelectRef.current(null));
        map.on("error", (e) => {
          errors++;
          if (import.meta.env.DEV) console.warn("[live-map]", e?.error?.message ?? e);
        });
        map.once("idle", () => {
          idle = true;
          if (!cancelled) onStatusRef.current("ready");
        });
        map.on("load", () => {
          if (cancelled || !map) return;
          map.addSource("route", { type: "geojson", data: routeGeoJSON(model, hiddenDays) });
          map.addLayer({
            id: "route-halo",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": tokens.bg, "line-width": 5.5, "line-opacity": 0.9 },
          });
          map.addLayer({
            id: "route-dots",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": tokens.accent, "line-width": 2.2, "line-opacity": 0.72, "line-dasharray": [0, 2.4] },
          });
          setLoaded(true);
        });
        mapRef.current = map;
        // A style that never finishes (tiles unreachable, glyphs blocked)
        // must not leave the traveller on a blank canvas.
        readyTimer = window.setTimeout(() => {
          if (!cancelled && !idle && errors > 0) onStatusRef.current("error");
        }, READY_TIMEOUT_MS);
      })
      .catch((err) => {
        console.error("[live-map] maplibre failed to load", err);
        if (!cancelled) onStatusRef.current("error");
      });

    return () => {
      cancelled = true;
      if (readyTimer) window.clearTimeout(readyTimer);
      for (const { marker } of markersRef.current.values()) marker.remove();
      markersRef.current.clear();
      setMounts([]);
      map?.remove();
      mapRef.current = null;
      setLoaded(false);
    };
    // The map is created once per overlay open; tokens/model are captured
    // at open time on purpose (the overlay remounts on a new open).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconcile pins with the visible places.
  useEffect(() => {
    const ml = mlRef.current;
    const map = mapRef.current;
    if (!ml || !map) return;
    const want = new Map(visible.map((p) => [p.key, p]));
    const have = markersRef.current;
    let changed = false;
    for (const [key, entry] of have) {
      if (!want.has(key)) {
        entry.marker.remove();
        have.delete(key);
        changed = true;
      }
    }
    for (const p of visible) {
      if (have.has(p.key)) continue;
      const el = document.createElement("div");
      el.className = "tds-mappin-anchor";
      const marker = new ml.Marker({ element: el, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(map);
      have.set(p.key, { marker, el });
      changed = true;
    }
    if (changed) setMounts([...have.entries()].map(([key, { el }]) => ({ key, el })));
  }, [visible, loaded]);

  // Route data follows the day chips and the route toggle.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const src = map.getSource("route") as GeoJSONSource | undefined;
    src?.setData(routeGeoJSON(model, hiddenDays));
    const vis = showRoute ? "visible" : "none";
    for (const id of ["route-halo", "route-dots"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
    }
  }, [model, hiddenDays, showRoute, loaded]);

  useImperativeHandle(
    ref,
    () => ({
      fitAll: () => {
        const map = mapRef.current;
        if (!map) return;
        if (bounds && !single) map.fitBounds(bounds as LngLatBoundsLike, { padding: FIT_PADDING, maxZoom: 16 });
        else if (single) map.easeTo({ center: [single.lng, single.lat], zoom: 15 });
      },
      zoomIn: () => mapRef.current?.zoomIn(),
      zoomOut: () => mapRef.current?.zoomOut(),
    }),
    [bounds, single],
  );

  const byKey = useMemo(() => new Map(visible.map((p) => [p.key, p])), [visible]);

  return (
    <>
      <div ref={containerRef} className="tds-map" />
      <div className="tds-map-grain" aria-hidden />
      {mounts.map(({ key, el }) => {
        const place = byKey.get(key);
        if (!place) return null;
        return createPortal(
          <MapPin
            key={key}
            place={place}
            tokens={tokens}
            fill={palette[place.kind]}
            showOrder={showOrder}
            selected={selectedKey === key}
            onSelect={(k) => onSelectRef.current(k)}
          />,
          el,
          key,
        );
      })}
    </>
  );
});
