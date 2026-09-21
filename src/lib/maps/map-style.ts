/**
 * The cartographer's plate: a MapLibre style generated from a skin's tokens.
 *
 * The basemap is furniture. Land is the skin's paper, water is paper mixed
 * a few percent toward ink, roads are hairlines of ink, and the only things
 * with colour are the dossier's own pins and route. Detail arrives with
 * zoom: major roads first, minor roads from 14, footpaths and buildings
 * from 15, then a quiet layer of the places a traveller might care about
 * (restaurants, bars, cafés, museums, parks) as small ink dots at 15 and
 * their names at 16. Basemap POIs are deliberately faint so the traveller's
 * planned stops stay the hero.
 *
 * Tiles: OpenFreeMap's public vector tiles (OpenMapTiles schema, weekly
 * planet builds, no key, no quota, commercial use allowed). The tile URL is
 * one string so a self-hosted Protomaps source can replace it later.
 */
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { SkinTokens } from "@/lib/skins/types";
import { alpha, isDark, mix } from "./color";

export const OPENFREEMAP_TILES = "https://tiles.openfreemap.org/planet";
export const OPENFREEMAP_GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const OPENFREEMAP_SPRITE = "https://tiles.openfreemap.org/sprites/ofm_f384/ofm";
/** Ready-made OpenFreeMap style, used when a deployment opts out of the
 *  skin-tinted plate by setting VITE_MAP_STYLE_URL. */
export const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/**
 * A whole style URL to load instead of the generated plate, when the
 * deployment sets one. Absent (the normal case) = the skin-tinted style.
 */
export function mapStyleUrlOverride(): string | null {
  const raw = import.meta.env["VITE_MAP_STYLE_URL"];
  const url = typeof raw === "string" ? raw.trim() : "";
  if (!url) return null;
  return url === "default" ? DEFAULT_MAP_STYLE_URL : url;
}

export type MapPalette = {
  dark: boolean;
  land: string;
  water: string;
  waterLine: string;
  park: string;
  building: string;
  roadMajor: string;
  roadMid: string;
  roadMinor: string;
  path: string;
  rail: string;
  boundary: string;
  labelStrong: string;
  labelSoft: string;
  labelStreet: string;
  labelWater: string;
  halo: string;
  poiWarm: string;
  poiCool: string;
  poiGreen: string;
  poiNeutral: string;
};

export function mapPalette(tokens: Pick<SkinTokens, "bg" | "ink" | "inkSoft" | "accent">): MapPalette {
  const dark = isDark(tokens.bg);
  const { bg, ink, inkSoft, accent } = tokens;
  const quiet = (family: string) => mix(mix(family, inkSoft, 0.35), bg, 0.1);
  return {
    dark,
    land: bg,
    water: mix(bg, ink, dark ? 0.12 : 0.07),
    waterLine: alpha(ink, dark ? 0.22 : 0.3),
    park: mix(bg, accent, dark ? 0.06 : 0.05),
    building: alpha(ink, dark ? 0.04 : 0.03),
    roadMajor: alpha(ink, dark ? 0.14 : 0.16),
    roadMid: alpha(ink, dark ? 0.11 : 0.12),
    roadMinor: alpha(ink, dark ? 0.08 : 0.09),
    path: alpha(ink, 0.22),
    rail: alpha(ink, 0.18),
    boundary: alpha(ink, 0.2),
    labelStrong: alpha(ink, 0.68),
    labelSoft: alpha(ink, 0.55),
    labelStreet: alpha(ink, 0.45),
    labelWater: alpha(ink, 0.4),
    halo: alpha(bg, 0.9),
    poiWarm: quiet(dark ? "#D98B6A" : "#9A4A2E"),
    poiCool: quiet(dark ? "#7FA3D9" : "#2C4A7A"),
    poiGreen: quiet(dark ? "#86BC9E" : "#3E6B4C"),
    poiNeutral: mix(inkSoft, bg, 0.15),
  };
}

/** Basemap POI classes worth a traveller's glance (OpenMapTiles `poi.class`).
 *  Deliberately curated: no fast food, no lodging (the traveller's own stay
 *  is already a pin; hostels and rentals only compete with it), no services. */
export const POI_DINING = ["restaurant", "bar", "cafe", "beer", "bakery", "ice_cream"];
export const POI_CULTURE = ["museum", "art_gallery", "theatre", "music", "castle", "attraction", "monument", "stadium"];
export const POI_NATURE = ["park", "garden", "beach", "zoo", "aquarium", "swimming"];
/** Raw OSM subclasses that are travel-relevant even when the class is generic. */
export const POI_SUBCLASSES = [
  "viewpoint",
  "monument",
  "memorial",
  "artwork",
  "gallery",
  "winery",
  "pub",
  "nightclub",
  "biergarten",
  "marketplace",
  "garden",
  "spa",
];

const NAME: unknown = ["coalesce", ["get", "name:latin"], ["get", "name_en"], ["get", "name"]];

const poiFilter: unknown = [
  "any",
  ["in", ["get", "class"], ["literal", [...POI_DINING, ...POI_CULTURE, ...POI_NATURE]]],
  ["in", ["get", "subclass"], ["literal", POI_SUBCLASSES]],
];

const notTunnel: unknown = ["!=", ["get", "brunnel"], "tunnel"];

export function buildMapStyle(
  tokens: SkinTokens,
  opts: { tilesUrl?: string } = {},
): StyleSpecification {
  const p = mapPalette(tokens);
  const line = (
    id: string,
    classes: string[],
    color: string,
    width: unknown,
    extra: Partial<LayerSpecification> & { minzoom?: number; maxzoom?: number } = {},
    dash?: number[],
  ): LayerSpecification =>
    ({
      id,
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["all", ["==", ["geometry-type"], "LineString"], ["in", ["get", "class"], ["literal", classes]], notTunnel],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": color, "line-width": width, ...(dash ? { "line-dasharray": dash } : {}) },
      ...extra,
    }) as LayerSpecification;

  const layers: LayerSpecification[] = [
    { id: "background", type: "background", paint: { "background-color": p.land } },
    {
      id: "park",
      type: "fill",
      source: "omt",
      "source-layer": "park",
      paint: { "fill-color": p.park, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 14, 1] },
    },
    {
      id: "landcover",
      type: "fill",
      source: "omt",
      "source-layer": "landcover",
      filter: ["in", ["get", "class"], ["literal", ["wood", "grass", "wetland"]]],
      paint: { "fill-color": p.park, "fill-opacity": 0.7 },
    },
    { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": p.water } },
    {
      id: "waterway",
      type: "line",
      source: "omt",
      "source-layer": "waterway",
      filter: ["in", ["get", "class"], ["literal", ["river", "canal", "stream"]]],
      paint: {
        "line-color": p.waterLine,
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.4, 16, 1.2],
      },
    },
    {
      id: "boundary-region",
      type: "line",
      source: "omt",
      "source-layer": "boundary",
      minzoom: 5,
      maxzoom: 12,
      filter: ["==", ["get", "admin_level"], 4],
      paint: { "line-color": p.boundary, "line-width": 0.6, "line-dasharray": [3, 2], "line-opacity": 0.6 },
    },
    {
      id: "boundary-country",
      type: "line",
      source: "omt",
      "source-layer": "boundary",
      filter: ["==", ["get", "admin_level"], 2],
      paint: { "line-color": p.boundary, "line-width": 1, "line-dasharray": [3, 2] },
    },
    {
      id: "building",
      type: "fill",
      source: "omt",
      "source-layer": "building",
      minzoom: 15,
      paint: { "fill-color": p.building, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0, 16, 1] },
    },
    line("road-path", ["path", "track"], p.path, ["interpolate", ["linear"], ["zoom"], 15, 0.7, 18, 1.4], { minzoom: 15 }, [1.5, 2]),
    line("road-minor", ["minor", "service"], p.roadMinor, ["interpolate", ["linear"], ["zoom"], 14, 0.5, 18, 1.6], { minzoom: 14 }),
    line("road-mid", ["secondary", "tertiary"], p.roadMid, ["interpolate", ["linear"], ["zoom"], 11, 0.4, 16, 1.8], { minzoom: 11 }),
    line("road-major", ["motorway", "trunk", "primary"], p.roadMajor, ["interpolate", ["linear"], ["zoom"], 7, 0.5, 16, 2.6]),
    line("rail", ["rail", "transit"], p.rail, 0.8, { minzoom: 12 }, [4, 3]),
    {
      id: "poi-dot",
      type: "circle",
      source: "omt",
      "source-layer": "poi",
      minzoom: 15,
      filter: poiFilter as never,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 15, 1.6, 18, 3],
        "circle-color": [
          "match",
          ["get", "class"],
          POI_DINING,
          p.poiWarm,
          POI_CULTURE,
          p.poiCool,
          POI_NATURE,
          p.poiGreen,
          p.poiNeutral,
        ],
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0.4, 17, 0.8],
        "circle-stroke-color": p.land,
        "circle-stroke-width": 0.8,
      },
    },
    {
      id: "road-name",
      type: "symbol",
      source: "omt",
      "source-layer": "transportation_name",
      minzoom: 15,
      filter: ["!", ["in", ["get", "class"], ["literal", ["path", "track", "rail", "transit"]]]],
      layout: {
        "symbol-placement": "line",
        "text-field": NAME as never,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 15, 9, 18, 12],
        "text-letter-spacing": 0.03,
        "text-max-angle": 30,
        "symbol-spacing": 320,
      },
      paint: { "text-color": p.labelStreet, "text-halo-color": p.halo, "text-halo-width": 1.2 },
    },
    {
      id: "water-name",
      type: "symbol",
      source: "omt",
      "source-layer": "water_name",
      // Seas, bays and real lakes only: a city's ponds and fountains are
      // named in the tiles too and read as noise at plate scale.
      filter: [
        "any",
        ["in", ["get", "class"], ["literal", ["ocean", "sea", "bay"]]],
        ["all", ["==", ["get", "class"], "lake"], ["<=", ["coalesce", ["get", "rank"], 99], 3]],
      ],
      layout: {
        "text-field": NAME as never,
        "text-font": ["Noto Sans Italic"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 6, 10, 14, 13],
        "text-letter-spacing": 0.08,
        "text-max-width": 8,
      },
      paint: { "text-color": p.labelWater, "text-halo-color": p.halo, "text-halo-width": 1.2 },
    },
    {
      id: "place-district",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      minzoom: 11,
      maxzoom: 16,
      filter: ["in", ["get", "class"], ["literal", ["suburb", "quarter", "neighbourhood", "hamlet", "village"]]],
      layout: {
        "text-field": NAME as never,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 9, 15, 11],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.18,
        "text-max-width": 7,
        "text-padding": 10,
      },
      paint: { "text-color": p.labelSoft, "text-halo-color": p.halo, "text-halo-width": 1.2 },
    },
    {
      id: "poi-label",
      type: "symbol",
      source: "omt",
      "source-layer": "poi",
      // Dots from 15, names one step later: at neighbourhood scale the
      // dossier's own pins must stay the only words with weight.
      minzoom: 17,
      filter: poiFilter as never,
      layout: {
        "text-field": NAME as never,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 17, 9.5, 18, 11],
        "text-offset": [0, 0.8],
        "text-anchor": "top",
        "text-max-width": 8,
        "text-padding": 6,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
      },
      paint: { "text-color": p.labelSoft, "text-halo-color": p.halo, "text-halo-width": 1.1 },
    },
    {
      id: "place-city",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      minzoom: 3,
      // Hand over to district names at 11: a bold city name under the
      // pins at trip scale is clutter, not orientation.
      maxzoom: 11,
      filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
      layout: {
        "text-field": NAME as never,
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 10, 14, 13, 16],
        "text-letter-spacing": 0.06,
        "text-max-width": 8,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
      },
      paint: { "text-color": p.labelStrong, "text-halo-color": p.halo, "text-halo-width": 1.5 },
    },
    {
      id: "place-country",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      minzoom: 2,
      maxzoom: 7,
      filter: ["==", ["get", "class"], "country"],
      layout: {
        "text-field": NAME as never,
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 2, 9, 6, 13],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.2,
        "text-max-width": 7,
      },
      paint: { "text-color": p.labelSoft, "text-halo-color": p.halo, "text-halo-width": 1.5 },
    },
  ];

  return {
    version: 8,
    name: "TravelDoss plate",
    glyphs: OPENFREEMAP_GLYPHS,
    sprite: OPENFREEMAP_SPRITE,
    sources: {
      omt: { type: "vector", url: opts.tilesUrl ?? OPENFREEMAP_TILES },
    },
    layers,
  };
}
