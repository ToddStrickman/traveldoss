/**
 * The Live Map's read model.
 *
 * `trips.content.blocks` stays the only source of truth (owner ruling: the
 * flat Block[] is the itinerary). This module derives what the map needs
 * from it, in memory, on every open: located pins grouped by place, their
 * visits in route order, per-day route segments, the stops that still lack
 * a location, and the bounds to fit.
 *
 * Pure and synchronous so it is unit-tested without a map or a DOM.
 */
import type { Block, TripView } from "@/lib/skins/types";
import { buildItinerary, type ActivityBlock } from "@/lib/skins/shared/itinerary";
import { hourOf } from "@/lib/itinerary/slots";
import { markerKindFor, type MarkerKind } from "./taxonomy";

export type GeocodeStatus = "resolved" | "pending" | "needs_review" | "failed" | "manual";

export type MapVisit = {
  blockIndex: number;
  /** null = preface / trip essentials (before the first day block). */
  day: number | null;
  date?: string;
  part?: "morning" | "afternoon" | "evening";
  time?: string;
  /** 1-based order among the day's located primary stops. */
  order: number;
};

export type MapPlace = {
  /** Stable within one open: placeId, else rounded coordinates + name. */
  key: string;
  name: string;
  kind: MarkerKind;
  rawCategory?: string;
  address?: string;
  lat: number;
  lng: number;
  placeId?: string;
  tier: "primary" | "shadow";
  /** Accommodation, or any stop listed before the first day. */
  isBase: boolean;
  note?: string;
  imageUrl?: string;
  website?: string;
  websiteTitle?: string;
  phone?: string;
  hours?: string;
  reservation?: string;
  mapsUrl?: string;
  geocodeStatus: GeocodeStatus;
  visits: MapVisit[];
};

export type MapRouteSegment = {
  day: number;
  /** `hop` = consecutive stops more than HOP_KM apart (a train, a flight). */
  kind: "walk" | "hop";
  /** [lng, lat] pairs, GeoJSON order. */
  coordinates: [number, number][];
  fromKey: string;
  toKey: string;
};

export type MapModel = {
  places: MapPlace[];
  segments: MapRouteSegment[];
  unlocated: Array<{ blockIndex: number; name: string; status: GeocodeStatus | "none" }>;
  /** All itinerary days, including days still awaiting locations. */
  days: number[];
  /** [[west, south], [east, north]] or null when nothing is located. */
  bounds: [[number, number], [number, number]] | null;
};

export type BuildMapModelOptions = {
  /** Block indexes currently visible on screen (the overlay's truncation
   *  contract). When set, only these stops are plotted, except… */
  onlyVisible?: Set<number>;
  /** …stops of this day, which are always included (a collapsed day's
   *  header still opens a useful map). */
  forceDay?: number | null;
};

const HOP_KM = 150;

/** Great-circle distance in kilometres. */
export function distanceKm(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function placeKey(b: ActivityBlock): string {
  if (b.placeId) return `id:${b.placeId}`;
  return `ll:${(b.lat as number).toFixed(4)},${(b.lng as number).toFixed(4)}:${normalizeName(b.name)}`;
}

function statusOf(b: ActivityBlock): GeocodeStatus | "none" {
  if (b.geocode?.status) return b.geocode.status;
  return b.lat != null && b.lng != null ? "resolved" : "none";
}

function located(b: ActivityBlock): b is ActivityBlock & { lat: number; lng: number } {
  return typeof b.lat === "number" && typeof b.lng === "number" && Number.isFinite(b.lat) && Math.abs(b.lat) <= 90 && Number.isFinite(b.lng) && Math.abs(b.lng) <= 180;
}

type Entry = { activity: ActivityBlock; index: number };

/** Route order inside one part of a day: parsed clock time first, then
 *  block order. Stable, so untimed stops keep their written order. */
function orderWithinPart(entries: Entry[]): Entry[] {
  return entries
    .map((e, i) => ({ e, i, h: e.activity.time ? hourOf(e.activity.time) : null }))
    .sort((a, b) => {
      if (a.h != null && b.h != null && a.h !== b.h) return a.h - b.h;
      return a.i - b.i;
    })
    .map((x) => x.e);
}

export function buildMapModel(
  _trip: TripView,
  blocks: Block[],
  opts: BuildMapModelOptions = {},
): MapModel {
  const it = buildItinerary(blocks);
  const byKey = new Map<string, MapPlace>();
  const unlocated: MapModel["unlocated"] = [];
  const segments: MapRouteSegment[] = [];
  const daysWithPins = new Set<number>();

  const include = (index: number, day: number | null) => {
    if (!opts.onlyVisible) return true;
    if (opts.forceDay != null && day === opts.forceDay) return true;
    return opts.onlyVisible.has(index);
  };

  const upsert = (
    b: ActivityBlock & { lat: number; lng: number },
    visit: MapVisit,
    isBase: boolean,
    dayBlock?: { images?: { src: string }[] },
  ): MapPlace => {
    const key = placeKey(b);
    const existing = byKey.get(key);
    if (existing) {
      existing.visits.push(visit);
      if (isBase) existing.isBase = true;
      return existing;
    }
    const place: MapPlace = {
      key,
      name: b.name,
      kind: markerKindFor(b.category),
      rawCategory: b.category,
      address: b.address,
      lat: b.lat,
      lng: b.lng,
      placeId: b.placeId,
      tier: b.tier === "shadow" ? "shadow" : "primary",
      isBase,
      note: b.note,
      imageUrl: b.images?.[0]?.src ?? dayBlock?.images?.[0]?.src,
      website: b.website,
      websiteTitle: b.websiteTitle,
      phone: b.phone,
      hours: b.hours,
      reservation: b.reservation,
      mapsUrl: b.mapsUrl,
      geocodeStatus: b.geocode?.status ?? "resolved",
      visits: [visit],
    };
    byKey.set(key, place);
    return place;
  };

  const consider = (
    entry: Entry,
    day: number | null,
    part: MapVisit["part"],
    orderCounter: { n: number } | null,
    dayBlock?: { date?: string; images?: { src: string }[] },
  ): MapPlace | null => {
    const b = entry.activity;
    if (b.mapHidden) return null;
    if (!include(entry.index, day)) return null;
    if (!located(b)) {
      unlocated.push({ blockIndex: entry.index, name: b.name, status: statusOf(b) });
      return null;
    }
    const isShadow = b.tier === "shadow";
    const order = !isShadow && orderCounter ? ++orderCounter.n : 0;
    const visit: MapVisit = { blockIndex: entry.index, day, date: dayBlock?.date, part, time: b.time, order };
    const isBase = day == null || markerKindFor(b.category) === "stay";
    return upsert(b, visit, isBase, dayBlock);
  };

  // Preface: hotel, currency, essentials before Day 1. Not on any route.
  for (const entry of it.preface) consider(entry, null, undefined, null);

  for (const d of it.days) {
    const counter = { n: 0 };
    const route: Array<{ place: MapPlace; coord: [number, number] }> = [];
    const parts: Array<[MapVisit["part"], Entry[]]> = [
      ["morning", it.days.length ? d.morning : []],
      ["afternoon", d.afternoon],
      ["evening", d.evening],
      [undefined, d.unassigned],
    ];
    for (const [part, entries] of parts) {
      for (const entry of orderWithinPart(entries)) {
        const place = consider(entry, d.day.n, part, counter, d.day);
        if (place && place.tier === "primary") route.push({ place, coord: [place.lng, place.lat] });
      }
    }
    for (const entry of d.shadows) consider(entry, d.day.n, undefined, null, d.day);

    daysWithPins.add(d.day.n);
    for (let i = 1; i < route.length; i++) {
      const from = route[i - 1];
      const to = route[i];
      segments.push({
        day: d.day.n,
        kind: distanceKm(from.coord, to.coord) > HOP_KM ? "hop" : "walk",
        coordinates: [from.coord, to.coord],
        fromKey: from.place.key,
        toKey: to.place.key,
      });
    }
  }

  const places = [...byKey.values()];
  let bounds: MapModel["bounds"] = null;
  for (const p of places) {
    if (!bounds) bounds = [[p.lng, p.lat], [p.lng, p.lat]];
    else {
      bounds[0][0] = Math.min(bounds[0][0], p.lng);
      bounds[0][1] = Math.min(bounds[0][1], p.lat);
      bounds[1][0] = Math.max(bounds[1][0], p.lng);
      bounds[1][1] = Math.max(bounds[1][1], p.lat);
    }
  }

  return {
    places,
    segments,
    unlocated,
    days: [...daysWithPins].sort((a, b) => a - b),
    bounds,
  };
}

/** Day number of every block index (null = preface). Used by SkinFrame to
 *  decide which day headers get a Map pill. */
export function indexDayLookup(blocks: Block[]): Map<number, number | null> {
  const it = buildItinerary(blocks);
  const lookup = new Map<number, number | null>();
  for (const { index } of it.preface) lookup.set(index, null);
  for (const d of it.days) {
    const entries = [...d.morning, ...d.afternoon, ...d.evening, ...d.unassigned, ...d.shadows];
    for (const { index } of entries) lookup.set(index, d.day.n);
  }
  return lookup;
}
