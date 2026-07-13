import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import type { Block, SkinTokens, TripView } from "@/lib/skins/types";
import { buildItinerary } from "@/lib/skins/shared/itinerary";
import { loadGoogleMaps } from "@/lib/maps/google-maps-loader";

/**
 * The Live Map (landing promise: "see them on a live map").
 *
 * A floating pin button rendered by SkinFrame across every template. Opening
 * it plots ONLY the stops currently visible on screen — anything truncated
 * or collapsed (closed grid disclosures, hidden carousel alternatives,
 * collapsed Plan-B section) is excluded by checking real DOM visibility of
 * each rendered activity at click time. Pins are numbered per stop and
 * colored per day; a per-day polyline traces the day's route.
 *
 * Cost profile: coordinates are persisted at enrichment time, so opening the
 * map performs zero geocoding; the Maps SDK itself loads lazily on first
 * click only.
 */

/** Google reports key/referrer auth failures once per page session and then
 *  renders every subsequent map blank — remember it so reopens short-circuit
 *  to the graceful error instead of an empty canvas. */
let mapsAuthFailed = false;

const DAY_COLORS = [
  "#B7472A", "#2E6F8E", "#7A5C2E", "#4A7A4A", "#6B4A8E",
  "#B0713A", "#3A7A72", "#8E3A5C", "#5C6B2E", "#3A4A8E",
];

type Pin = {
  index: number;
  name: string;
  time?: string;
  lat: number;
  lng: number;
  day: number | null; // day number (1-based) or null = trip essentials
  order: number; // 1-based order within its day among located pins
};

/** Indexes of activity blocks currently visible (untruncated) on screen. */
function collectVisibleIndexes(): Set<number> {
  const out = new Set<number>();
  const nodes = document.querySelectorAll<HTMLElement>(".tds [data-block-index]");
  for (const el of nodes) {
    const idx = Number(el.dataset.blockIndex);
    if (Number.isNaN(idx)) continue;
    // Structural visibility only (display/visibility/collapsed ancestors).
    // content-visibility:auto skipping is a scroll-perf optimization, not
    // user truncation — off-screen days still belong on the map.
    const visible =
      typeof el.checkVisibility === "function"
        ? el.checkVisibility()
        : el.offsetParent !== null;
    if (visible) out.add(idx);
  }
  return out;
}

/** Map each block index to its day number (null = preface/essentials).
 *  Exported for SkinFrame's per-day map buttons (which days are locatable). */
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

/* ── Keyless fallback: a static OpenStreetMap tile grid ─────────────────
 * When Google Maps can't authorize (referrer-locked key on non-prod hosts,
 * missing connector key on forks), the Live Map still works: we compute the
 * Web-Mercator projection ourselves, lay out public OSM raster tiles as
 * plain <img>s, and draw numbered day-colored pins + route lines in an SVG
 * overlay. Zero dependencies, zero API keys, proper OSM attribution. */

const TILE = 256;

function mercator(lat: number, lng: number): { x: number; y: number } {
  const x = (lng + 180) / 360;
  const rad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  return { x, y };
}

function StaticOsmMap({
  pins,
  hiddenDays,
  colorFor,
}: {
  pins: Pin[];
  hiddenDays: Set<number>;
  colorFor: (day: number | null) => string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shown = pins.filter((p) => p.day == null || !hiddenDays.has(p.day));

  const layout = useMemo(() => {
    if (!size || shown.length === 0) return null;
    const { w, h } = size;
    const pts = shown.map((p) => ({ p, m: mercator(p.lat, p.lng) }));
    const minX = Math.min(...pts.map((t) => t.m.x));
    const maxX = Math.max(...pts.map((t) => t.m.x));
    const minY = Math.min(...pts.map((t) => t.m.y));
    const maxY = Math.max(...pts.map((t) => t.m.y));
    // Largest zoom (≤17) whose pixel bbox fits with breathing room.
    let z = 17;
    while (z > 2) {
      const scale = TILE * 2 ** z;
      if ((maxX - minX) * scale <= w - 90 && (maxY - minY) * scale <= h - 90) break;
      z--;
    }
    if (shown.length === 1) z = Math.min(z, 15);
    const scale = TILE * 2 ** z;
    const cx = ((minX + maxX) / 2) * scale;
    const cy = ((minY + maxY) / 2) * scale;
    const ox = cx - w / 2; // world-pixel origin of the viewport
    const oy = cy - h / 2;
    const tiles: Array<{ key: string; url: string; left: number; top: number }> = [];
    const tx0 = Math.floor(ox / TILE);
    const ty0 = Math.floor(oy / TILE);
    const tx1 = Math.floor((ox + w) / TILE);
    const ty1 = Math.floor((oy + h) / TILE);
    const nTiles = 2 ** z;
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = Math.max(0, ty0); ty <= Math.min(nTiles - 1, ty1); ty++) {
        const wrappedX = ((tx % nTiles) + nTiles) % nTiles;
        tiles.push({
          key: `${z}/${tx}/${ty}`,
          url: `https://tile.openstreetmap.org/${z}/${wrappedX}/${ty}.png`,
          left: tx * TILE - ox,
          top: ty * TILE - oy,
        });
      }
    }
    const dots = pts.map(({ p, m }) => ({
      pin: p,
      left: m.x * scale - ox,
      top: m.y * scale - oy,
    }));
    const paths = new Map<number, string>();
    for (const d of dots) {
      if (d.pin.day == null) continue;
      const prev = paths.get(d.pin.day);
      paths.set(d.pin.day, `${prev ? `${prev} L` : "M"}${d.left.toFixed(1)},${d.top.toFixed(1)}`);
    }
    return { tiles, dots, paths, w, h };
  }, [size, shown]);

  return (
    <div ref={boxRef} style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#e8e4dc" }}>
      {layout ? (
        <>
          {layout.tiles.map((t) => (
            <img
              key={t.key}
              src={t.url}
              alt=""
              width={TILE}
              height={TILE}
              draggable={false}
              style={{ position: "absolute", left: t.left, top: t.top, userSelect: "none" }}
            />
          ))}
          <svg
            width={layout.w}
            height={layout.h}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            aria-hidden
          >
            {[...layout.paths.entries()].map(([day, d]) => (
              <path key={day} d={d} fill="none" stroke={colorFor(day)} strokeWidth={2.5} strokeOpacity={0.55} />
            ))}
          </svg>
          {layout.dots.map(({ pin, left, top }) => (
            <div
              key={pin.index}
              title={`${pin.name}${pin.day != null ? ` · Day ${pin.day}` : ""}`}
              style={{
                position: "absolute",
                left,
                top,
                transform: "translate(-50%, -50%)",
                width: 26,
                height: 26,
                borderRadius: 999,
                background: colorFor(pin.day),
                border: "2px solid #ffffff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                color: "#ffffff",
                font: "700 11px/22px system-ui, sans-serif",
                textAlign: "center",
              }}
            >
              {pin.order}
            </div>
          ))}
          <div
            style={{
              position: "absolute",
              right: 6,
              bottom: 4,
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(255,255,255,0.75)",
              font: "400 10px/1.3 system-ui, sans-serif",
              color: "#333",
            }}
          >
            ©{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
              OpenStreetMap
            </a>{" "}
            contributors
          </div>
        </>
      ) : null}
    </div>
  );
}

/* The floating DossierMapButton FAB is retired (owner correction): the map
 * is opened from an embedded button in EVERY day header — see SkinFrame's
 * DayMapContext and editing-kit's EditableDayHeader. */

export function DossierMapOverlay({
  trip,
  blocks,
  tokens,
  onClose,
  initialDay,
}: {
  trip: TripView;
  blocks: Block[];
  tokens: SkinTokens;
  onClose: () => void;
  /** Open focused on one day: every OTHER day starts hidden; the existing
   *  day chips restore them (the reference dossier's in-map day picker). */
  initialDay?: number;
}) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<number, google.maps.Marker[]>>(new Map());
  const linesRef = useRef<Map<number, google.maps.Polyline>>(new Map());
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Snapshot what's on screen at open time — the "untruncated only" contract.
  const { pins, unlocatedVisible } = useMemo(() => {
    const visible = collectVisibleIndexes();
    const dayOf = indexDayLookup(blocks);
    const perDayCount = new Map<number, number>();
    const pins: Pin[] = [];
    let unlocated = 0;
    blocks.forEach((b, index) => {
      if (b.kind !== "place" || !visible.has(index)) return;
      if (b.lat == null || b.lng == null) {
        unlocated++;
        return;
      }
      const day = dayOf.get(index) ?? null;
      const key = day ?? 0;
      const order = (perDayCount.get(key) ?? 0) + 1;
      perDayCount.set(key, order);
      pins.push({ index, name: b.name, time: b.time, lat: b.lat, lng: b.lng, day, order });
    });
    return { pins, unlocatedVisible: unlocated };
    // Intentionally computed once per open — the overlay reflects the screen
    // state at the moment the traveler clicked the map icon.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const days = useMemo(() => {
    const set = new Set<number>();
    for (const p of pins) if (p.day != null) set.add(p.day);
    return [...set].sort((a, b) => a - b);
  }, [pins]);

  // Day-focused opening: start with every other day hidden. (Declared after
  // `days` so the initializer can see the full day list; hooks order is
  // stable because none of this is conditional.)
  const [hiddenDays, setHiddenDays] = useState<Set<number>>(() =>
    initialDay == null
      ? new Set<number>()
      : new Set(days.filter((d) => d !== initialDay)),
  );

  const colorFor = useCallback(
    (day: number | null) =>
      day == null ? "#555555" : DAY_COLORS[(day - 1) % DAY_COLORS.length],
    [],
  );

  // Mount the map once the SDK arrives.
  useEffect(() => {
    let cancelled = false;
    // Google reports key/referrer problems via this global rather than the
    // loader promise — surface our graceful error state instead of the SDK's
    // raw "Oops" overlay (e.g. RefererNotAllowedMapError on non-prod hosts).
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
      mapsAuthFailed = true;
      if (!cancelled) setStatus("error");
    };
    if (mapsAuthFailed) {
      setStatus("error");
      return () => {
        cancelled = true;
      };
    }
    loadGoogleMaps()
      .then((gm) => {
        if (cancelled || !mapEl.current) return;
        const map = new gm.Map(mapEl.current, {
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;
        const bounds = new gm.LatLngBounds();
        const info = new gm.InfoWindow();
        const byDay = markersRef.current;
        const lines = linesRef.current;
        const dayPaths = new Map<number, { lat: number; lng: number }[]>();

        for (const pin of pins) {
          const color = colorFor(pin.day);
          const marker = new gm.Marker({
            map,
            position: { lat: pin.lat, lng: pin.lng },
            label: { text: String(pin.order), color: "#ffffff", fontSize: "11px", fontWeight: "700" },
            icon: {
              path: gm.SymbolPath.CIRCLE,
              scale: 13,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
            title: pin.name,
          });
          marker.addListener("click", () => {
            info.close();
            const when = pin.time ? `<div style="color:#666;font-size:11px">${pin.time}${pin.day != null ? ` · Day ${pin.day}` : ""}</div>` : pin.day != null ? `<div style="color:#666;font-size:11px">Day ${pin.day}</div>` : "";
            info.open({ map, anchor: marker });
            (info as unknown as { setContent: (c: string) => void }).setContent(
              `<div style="font:600 13px/1.4 system-ui;max-width:220px">${pin.name}${when}</div>`,
            );
          });
          const dayKey = pin.day ?? 0;
          byDay.set(dayKey, [...(byDay.get(dayKey) ?? []), marker]);
          if (pin.day != null) {
            dayPaths.set(pin.day, [...(dayPaths.get(pin.day) ?? []), { lat: pin.lat, lng: pin.lng }]);
          }
          bounds.extend({ lat: pin.lat, lng: pin.lng });
        }
        for (const [day, path] of dayPaths) {
          if (path.length < 2) continue;
          lines.set(
            day,
            new gm.Polyline({
              map,
              path,
              strokeColor: colorFor(day),
              strokeOpacity: 0.55,
              strokeWeight: 2.5,
            }),
          );
        }
        if (pins.length > 1) map.fitBounds(bounds, 56);
        else if (pins.length === 1) {
          map.setCenter({ lat: pins[0].lat, lng: pins[0].lng });
          map.setZoom(15);
        }
        setStatus("ready");
      })
      .catch((err) => {
        console.error("[live-map] failed to load Google Maps", err);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      mapRef.current = null;
      markersRef.current = new Map();
      linesRef.current = new Map();
    };
  }, [pins, colorFor]);

  // Day chip toggles — hide/show that day's markers + route line.
  const toggleDay = useCallback((day: number) => {
    setHiddenDays((prev) => {
      const next = new Set(prev);
      const nowHidden = !next.has(day);
      if (nowHidden) next.add(day);
      else next.delete(day);
      for (const m of markersRef.current.get(day) ?? []) m.setMap(nowHidden ? null : mapRef.current);
      const line = linesRef.current.get(day);
      if (line) line.setMap(nowHidden ? null : mapRef.current);
      return next;
    });
  }, []);

  // Escape closes; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Live map of ${trip.destination}`}
      data-print="hide"
      style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", flexDirection: "column", background: tokens.bg }}
    >
      <header
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          padding: "12px 16px", borderBottom: `1px solid ${tokens.rule}`, color: tokens.ink,
          fontFamily: tokens.fontBody,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <MapPin size={16} color={tokens.accent} aria-hidden />
          <span style={{ font: `600 11px/1 ${tokens.fontBody}`, letterSpacing: "0.28em", textTransform: "uppercase" }}>
            The Live Map
          </span>
          <span style={{ color: tokens.inkSoft, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {trip.destination} · {pins.length} stop{pins.length === 1 ? "" : "s"} shown
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close map"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, borderRadius: 999, border: `1px solid ${tokens.rule}`,
            background: "transparent", color: tokens.ink, cursor: "pointer",
          }}
        >
          <X size={16} aria-hidden />
        </button>
      </header>

      {days.length > 0 ? (
        <div
          style={{
            display: "flex", gap: 8, padding: "10px 16px", overflowX: "auto",
            borderBottom: `1px solid ${tokens.rule}`,
          }}
        >
          {days.map((d) => {
            const off = hiddenDays.has(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                aria-pressed={!off}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px",
                  borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap",
                  border: `1px solid ${off ? tokens.rule : colorFor(d)}`,
                  background: off ? "transparent" : colorFor(d),
                  color: off ? tokens.inkSoft : "#ffffff",
                  font: `600 10px/1 ${tokens.fontBody}`, letterSpacing: "0.16em", textTransform: "uppercase",
                }}
              >
                <span
                  aria-hidden
                  style={{ width: 8, height: 8, borderRadius: 999, background: off ? colorFor(d) : "#ffffff" }}
                />
                Day {String(d).padStart(2, "0")}
              </button>
            );
          })}
        </div>
      ) : null}

      <div style={{ position: "relative", flex: 1 }}>
        <div
          ref={mapEl}
          style={{ position: "absolute", inset: 0, visibility: status === "error" ? "hidden" : "visible" }}
        />
        {status === "error" ? (
          // Google couldn't authorize (or no key) — the itinerary still gets a
          // real map: static OpenStreetMap tiles, keyless and dependency-free.
          <StaticOsmMap pins={pins} hiddenDays={hiddenDays} colorFor={colorFor} />
        ) : null}
        {status === "loading" ? (
          <div
            style={{
              position: "absolute", inset: 0, display: "grid", placeItems: "center",
              color: tokens.inkSoft, font: `500 12px/1.5 ${tokens.fontBody}`, textAlign: "center", padding: 24,
            }}
          >
            Plotting your dossier…
          </div>
        ) : null}
      </div>

      {unlocatedVisible > 0 ? (
        <footer
          style={{
            padding: "8px 16px", borderTop: `1px solid ${tokens.rule}`,
            color: tokens.inkSoft, font: `500 11px/1.4 ${tokens.fontBody}`,
          }}
        >
          {unlocatedVisible} visible stop{unlocatedVisible === 1 ? "" : "s"} without a pinned
          location yet — locations fill in automatically as the dossier saves.
        </footer>
      ) : null}
    </div>
  );
}
