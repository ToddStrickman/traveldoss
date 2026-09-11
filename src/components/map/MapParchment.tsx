/**
 * Parchment mode: the Live Map without a basemap.
 *
 * Used when WebGL2 is unavailable, the map library cannot load, or the tile
 * source is unreachable. Projects the stops with our own Web-Mercator
 * math onto the skin's paper and draws the dotted route in SVG, so the
 * itinerary still reads as a map and every pin still works. No network,
 * no dependencies.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapModel, MapPlace } from "@/lib/maps/build-map-places";
import type { MarkerKind } from "@/lib/maps/taxonomy";
import { MapPin } from "./MapPin";
import { spreadMapPins } from "@/lib/maps/spread-map-pins";

const TILE = 256;

function mercator(lat: number, lng: number): { x: number; y: number } {
  const x = (lng + 180) / 360;
  const rad = (Math.max(-85.051129, Math.min(85.051129, lat)) * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  return { x, y };
}

export function MapParchment({
  model,
  visible,
  tokens,
  palette,
  showRoute,
  showOrder,
  selectedKey,
  onSelect,
  hiddenDays,
  focusedDay,
}: {
  model: MapModel;
  /** Places to draw (already filtered for hidden days / Plan B). */
  visible: MapPlace[];
  tokens: { bg: string; ink: string; accent: string; inkSoft: string };
  palette: Record<MarkerKind, string>;
  showRoute: boolean;
  showOrder: boolean;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  hiddenDays: Set<number>;
  focusedDay?: number | null;
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

  const layout = useMemo(() => {
    if (!size || visible.length === 0) return null;
    const { w, h } = size;
    const pts = visible.map((p) => ({ p, m: mercator(p.lat, p.lng) }));
    const minX = Math.min(...pts.map((t) => t.m.x));
    const maxX = Math.max(...pts.map((t) => t.m.x));
    const minY = Math.min(...pts.map((t) => t.m.y));
    const maxY = Math.max(...pts.map((t) => t.m.y));
    let z = 17;
    while (z > 2) {
      const scale = TILE * 2 ** z;
      if ((maxX - minX) * scale <= w - 120 && (maxY - minY) * scale <= h - 120) break;
      z--;
    }
    if (visible.length === 1) z = Math.min(z, 15);
    const scale = TILE * 2 ** z;
    const ox = ((minX + maxX) / 2) * scale - w / 2;
    const oy = ((minY + maxY) / 2) * scale - h / 2;
    const project = (lat: number, lng: number) => {
      const m = mercator(lat, lng);
      return { left: m.x * scale - ox, top: m.y * scale - oy };
    };
    const anchors = pts.map(({ p }) => ({ place: p, ...project(p.lat, p.lng) }));
    const offsets = spreadMapPins(anchors.map((p) => ({key:p.place.key,x:p.left,y:p.top})));
    const dots = anchors.map((p) => { const [dx,dy] = offsets.get(p.place.key) ?? [0,0]; return {...p,left:p.left+dx,top:p.top+dy}; });
    const paths = model.segments
      .filter((s) => s.kind === "walk" && !hiddenDays.has(s.day))
      .map((s) => {
        const a = project(s.coordinates[0][1], s.coordinates[0][0]);
        const b = project(s.coordinates[1][1], s.coordinates[1][0]);
        return `M${a.left.toFixed(1)},${a.top.toFixed(1)} L${b.left.toFixed(1)},${b.top.toFixed(1)}`;
      });
    return { dots, paths, w, h };
  }, [size, visible, model.segments, hiddenDays]);

  return (
    <div
      ref={boxRef}
      className="tds-map"
      style={{ background: tokens.bg, overflow: "hidden" }}
      onClick={() => onSelect(null)}
    >
      <div className="tds-map-grain" aria-hidden />
      {layout ? (
        <>
          {showRoute ? (
            <svg width={layout.w} height={layout.h} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden>
              {layout.paths.map((d, i) => (
                <g key={i}>
                  <path d={d} fill="none" stroke={tokens.bg} strokeWidth={5.5} strokeLinecap="round" />
                  <path d={d} fill="none" stroke={tokens.accent} strokeOpacity={0.72} strokeWidth={2.2} strokeLinecap="round" strokeDasharray="0 5.2" />
                </g>
              ))}
            </svg>
          ) : null}
          {layout.dots.map(({ place, left, top }) => (
            <div key={place.key} style={{ position: "absolute", left, top, transform: "translate(-50%, -50%)" }}>
              <MapPin
                place={place}
                focusedDay={focusedDay}
                tokens={tokens}
                fill={palette[place.kind]}
                showOrder={showOrder}
                selected={selectedKey === place.key}
                onSelect={onSelect}
              />
            </div>
          ))}
        </>
      ) : null}
      <div
        style={{
          position: "absolute", right: 8, bottom: 6, padding: "2px 6px", borderRadius: 4,
          color: tokens.inkSoft, font: "400 10px/1.3 system-ui, sans-serif",
        }}
      >
        Map tiles unavailable · positions are to scale
      </div>
    </div>
  );
}
