import { useEffect, useMemo, useState } from "react";
import { motion, useMotionValue, useMotionTemplate, useSpring, useReducedMotion } from "motion/react";

/**
 * Cursor-reveal topographic background.
 * - Base: deep navy theme wash (lives below).
 * - Reveal layer: ivory paper with topo contours, masked to a soft radial
 *   under the cursor — like a flashlight on parchment.
 * - Honors prefers-reduced-motion (static low-opacity reveal, no tracking).
 * - pointer-events: none everywhere; clicks pass through.
 */
export function TopoBackground() {
  const reduceMotion = useReducedMotion();
  const [coarsePointer, setCoarsePointer] = useState(false);
  const [radius, setRadius] = useState(360);
  const [moving, setMoving] = useState(false);
  const [debug, setDebug] = useState(false);
  const [contrast, setContrast] = useState<{ ratio: number; lo: number; hi: number } | null>(null);
  const [mapSize, setMapSize] = useState(() => ({ width: 1440, height: 900 }));
  const topoSvg = useMemo(() => createTopoSvg(mapSize.width, mapSize.height), [mapSize.width, mapSize.height]);
  const topoPattern = useMemo(() => topoMapPattern(topoSvg), [topoSvg]);
  // Below ~1.5:1 the topo reads as invisible noise on the navy base.
  const CONTRAST_MIN = 1.5;

  // Motion values follow the cursor; spring gives a damped, plush trail.
  const initialX = typeof window !== "undefined" ? window.innerWidth / 2 : 0;
  const initialY = typeof window !== "undefined" ? window.innerHeight / 2 : 0;
  const mx = useMotionValue(initialX);
  const my = useMotionValue(initialY);
  // While moving: soft + heavy → long, plush trail.
  // When stopped: stiffer + lighter → calm, quick settle (no overshoot).
  const springConfig = moving
    ? { stiffness: 55, damping: 22, mass: 1.1 }
    : { stiffness: 140, damping: 28, mass: 0.5 };
  const sx = useSpring(mx, springConfig);
  const sy = useSpring(my, springConfig);

  // Cursor-tracked radial mask. Multi-stop falloff (ease-out cubic-ish) so the
  // edge dissolves into the navy with no visible ring. Radius scales with the
  // viewport so the reveal feels proportional on phones, laptops, and 4K.
  const mask = useMotionTemplate`radial-gradient(circle ${radius}px at ${sx}px ${sy}px,
    rgba(0,0,0,1) 0%,
    rgba(0,0,0,0.96) 18%,
    rgba(0,0,0,0.82) 34%,
    rgba(0,0,0,0.58) 50%,
    rgba(0,0,0,0.30) 68%,
    rgba(0,0,0,0.10) 84%,
    rgba(0,0,0,0) 100%)`;

  useEffect(() => {
    setCoarsePointer(window.matchMedia("(pointer: coarse)").matches);

    // Debug toggle: ?debug-topo in URL, or Shift+D anywhere.
    const params = new URLSearchParams(window.location.search);
    if (params.has("debug-topo")) setDebug(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "D" || e.key === "d")) setDebug((v) => !v);
    };
    window.addEventListener("keydown", onKey);

    // Radius ~ 8% of the viewport's smaller side, clamped to a plush range.
    // The map itself is regenerated at full viewport scale so there are no
    // repeated-tile seams or clipped contour fragments at any screen size.
    const computeRadius = () => {
      const min = Math.min(window.innerWidth, window.innerHeight);
      setRadius(Math.round(Math.max(66, Math.min(156, min * 0.078))));
      setMapSize({ width: Math.ceil(window.innerWidth), height: Math.ceil(window.innerHeight) });
    };
    computeRadius();
    window.addEventListener("resize", computeRadius);

    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const onMove = (e: PointerEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
      setMoving(true);
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setMoving(false), 140);
    };
    if (!reduceMotion) {
      window.addEventListener("pointermove", onMove, { passive: true });
    }
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", computeRadius);
      window.removeEventListener("keydown", onKey);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [mx, my, reduceMotion]);

  const trackingEnabled = !reduceMotion && !coarsePointer;

  // When debug mode flips on, rasterize the real topo SVG over the navy base
  // and measure WCAG contrast between the brightest revealed pixel and the
  // base. This tells us whether the contour lines are actually visible inside
  // the glow — not just whether the mask is clipping.
  useEffect(() => {
    if (!debug) {
      setContrast(null);
      return;
    }
    const base = { r: 38, g: 44, b: 70 }; // approx oklch(0.19 0.04 260)
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 480;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = `rgb(${base.r},${base.g},${base.b})`;
      ctx.fillRect(0, 0, 720, 480);
      ctx.drawImage(img, 0, 0, 720, 480);
      const { data } = ctx.getImageData(0, 0, 720, 480);
      const baseL = relLuminance(base.r, base.g, base.b);
      let hi = baseL;
      let lo = baseL;
      for (let i = 0; i < data.length; i += 4) {
        const L = relLuminance(data[i], data[i + 1], data[i + 2]);
        if (L > hi) hi = L;
        if (L < lo) lo = L;
      }
      const ratio = (Math.max(hi, baseL) + 0.05) / (Math.min(lo, baseL) + 0.05);
      setContrast({ ratio, lo, hi });
    };
    img.onerror = () => setContrast({ ratio: 0, lo: 0, hi: 0 });
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(topoSvg)}`;
  }, [debug, topoSvg]);

  const tooFaint = !!contrast && contrast.ratio < CONTRAST_MIN;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
    >
      {/* Base: deep navy wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, oklch(0.26 0.05 260) 0%, oklch(0.19 0.04 260) 55%, oklch(0.14 0.035 260) 100%)",
        }}
      />

      {/* Cursor-reveal: light exposes concealed topo lines under the cursor */}
      {trackingEnabled ? (
        <>
          {/* Flashlight hot-spot — warm glow that makes the dark surface feel illuminated */}
          <Flashlight sx={sx} sy={sy} radius={radius} mask={mask} />
          <motion.div
            className="absolute inset-0 will-change-[mask-image]"
            style={{
              backgroundImage: topoPattern,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              WebkitMaskImage: mask,
              maskImage: mask,
              opacity: 1,
              contain: "layout paint",
            }}
          />
          {debug ? <DebugOverlay sx={sx} sy={sy} radius={radius} /> : null}
        </>
      ) : (
        null
      )}

      {/* Subtle vignette to keep edges plush */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)",
        }}
      />
      {debug ? (
        <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/80 px-2 py-1 font-mono text-xs text-lime-300">
          TOPO DEBUG · radius {radius}px · tracking {String(trackingEnabled)} · Shift+D toggles
        </div>
      ) : null}
      {debug && contrast ? (
        <div
          className={`pointer-events-none absolute left-3 top-12 rounded px-2 py-1 font-mono text-xs ${
            tooFaint ? "bg-red-600 text-white" : "bg-black/80 text-lime-300"
          }`}
        >
          contrast {contrast.ratio.toFixed(2)}:1 (min {CONTRAST_MIN}:1) {tooFaint ? "⚠ TOO FAINT" : "OK"}
        </div>
      ) : null}
      {tooFaint ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 border-y-4 border-red-500 bg-red-500/15 px-4 py-3 text-center font-mono text-sm font-bold text-red-100">
          ⚠ Topo reveal contrast {contrast!.ratio.toFixed(2)}:1 is below {CONTRAST_MIN}:1 — lines will be invisible inside the glow.
        </div>
      ) : null}
    </div>
  );
}

/** sRGB → relative luminance per WCAG 2.x. */
function relLuminance(r: number, g: number, b: number) {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * Debug overlay: bright ring at the mask boundary + crosshair dot at the
 * spring-tracked center. Lets you verify the spotlight position and that the
 * topo layer is actually being clipped to it.
 */
function DebugOverlay({
  sx,
  sy,
  radius,
}: {
  sx: import("motion/react").MotionValue<number>;
  sy: import("motion/react").MotionValue<number>;
  radius: number;
}) {
  const ring = useMotionTemplate`radial-gradient(circle ${radius}px at ${sx}px ${sy}px,
    rgba(0,0,0,0) 0%,
    rgba(0,0,0,0) 97%,
    rgba(0,255,128,0.95) 98%,
    rgba(0,255,128,0) 100%)`;
  const dot = useMotionTemplate`radial-gradient(circle 6px at ${sx}px ${sy}px,
    rgba(255,0,128,1) 0%,
    rgba(255,0,128,1) 70%,
    rgba(255,0,128,0) 100%)`;
  return (
    <>
      <motion.div className="absolute inset-0" style={{ background: ring }} />
      <motion.div className="absolute inset-0" style={{ background: dot }} />
    </>
  );
}

/**
 * Bright flashlight hot-spot. Sits above the reveal layer and adds the
 * "very bright wherever the mouse is" lift — warm ivory core fading out
 * gracefully so it never reads as a hard disc.
 */
function Flashlight({
  sx,
  sy,
  radius,
  mask,
}: {
  sx: import("motion/react").MotionValue<number>;
  sy: import("motion/react").MotionValue<number>;
  radius: number;
  mask: import("motion/react").MotionValue<string>;
}) {
  const inner = Math.round(radius * 0.72);
  const bg = useMotionTemplate`radial-gradient(circle ${inner}px at ${sx}px ${sy}px,
    rgba(255,250,226,0.46) 0%,
    rgba(248,234,196,0.26) 26%,
    rgba(174,139,94,0.13) 54%,
    rgba(100,72,48,0.05) 78%,
    rgba(0,0,0,0) 100%)`;
  return (
    <motion.div
      className="absolute inset-0"
      style={{
        background: bg,
        mixBlendMode: "screen",
        WebkitMaskImage: mask,
        maskImage: mask,
        contain: "layout paint",
      }}
    />
  );
}

function topoMapPattern(svg: string) {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

const GEO_ANCHOR = {
  // Lauterbrunnen Valley, Switzerland — a real steep-sided valley with river
  // bends and dense contour structure. The coordinates seed the procedural
  // field so the generated map behaves like one continuous surveyed surface
  // instead of a repeated decorative tile.
  name: "Lauterbrunnen Valley",
  lat: 46.5937,
  lon: 7.9091,
};

function createTopoSvg(width: number, height: number) {
  const w = Math.max(720, Math.ceil(width));
  const h = Math.max(520, Math.ceil(height));
  const margin = Math.max(180, Math.round(Math.min(w, h) * 0.22));
  const contourPaths = buildContourPaths(w, h, margin, GEO_ANCHOR.lat, GEO_ANCHOR.lon);
  const riverPath = buildRiverPath(w, h, margin, GEO_ANCHOR.lat, GEO_ANCHOR.lon);
  const tributaryPath = buildTributaryPath(w, h, margin, GEO_ANCHOR.lat, GEO_ANCHOR.lon);

  return `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'>
    <rect width='${w}' height='${h}' fill='none'/>
    <g fill='none' stroke='#7A3F2A' stroke-width='1.25' stroke-opacity='0.72' stroke-linecap='round' stroke-linejoin='round'>
      ${contourPaths.map((d) => `<path d='${d}'/>`).join("\n      ")}
    </g>
    <g fill='none' stroke='#A9D8EA' stroke-width='2.25' stroke-opacity='0.9' stroke-linecap='round' stroke-linejoin='round'>
      <path d='${riverPath}'/>
      <path d='${tributaryPath}' stroke-width='1.45' stroke-opacity='0.58'/>
    </g>
  </svg>`;
}

function buildContourPaths(width: number, height: number, margin: number, lat: number, lon: number) {
  const paths: string[] = [];
  const fullW = width + margin * 2;
  const fullH = height + margin * 2;
  const lineCount = Math.max(30, Math.ceil(fullH / 22));
  const step = fullH / (lineCount - 1);
  const xStep = 22;
  const phase = (Math.abs(lat) * 0.37 + Math.abs(lon) * 0.19) % Math.PI;

  for (let i = 0; i < lineCount; i += 1) {
    const baseY = -margin + i * step;
    const amplitude = 20 + (i % 5) * 5 + Math.sin(i * 0.63 + phase) * 8;
    const points: Array<[number, number]> = [];
    for (let x = -margin; x <= width + margin; x += xStep) {
      const nx = (x + margin) / fullW;
      const valley = Math.exp(-Math.pow((x - width * 0.53) / (width * 0.22), 2));
      const ridge = Math.exp(-Math.pow((x - width * 0.18) / (width * 0.18), 2));
      const shelf = Math.exp(-Math.pow((x - width * 0.78) / (width * 0.16), 2));
      const y =
        baseY +
        Math.sin(nx * Math.PI * 2.1 + i * 0.42 + phase) * amplitude +
        Math.sin(nx * Math.PI * 5.8 + i * 0.18 + lon) * (amplitude * 0.34) +
        valley * Math.sin(i * 0.56 + lat) * 46 -
        ridge * Math.cos(i * 0.31 + lon) * 22 +
        shelf * Math.sin(i * 0.43 - lat) * 18;
      points.push([round(x), round(y)]);
    }
    paths.push(smoothPath(points));
  }

  const peakCount = width > 1200 ? 14 : 10;
  for (let p = 0; p < peakCount; p += 1) {
    const cx = ((p * 0.217 + Math.abs(Math.sin(lat + p)) * 0.37) % 1) * width;
    const cy = ((p * 0.291 + Math.abs(Math.cos(lon - p)) * 0.31) % 1) * height;
    const rx = 110 + (p % 3) * 34;
    const ry = 64 + (p % 4) * 18;
    for (let ring = 0; ring < 3; ring += 1) {
      paths.push(closedContour(cx, cy, rx - ring * 24, ry - ring * 15, phase + p * 0.7 + ring));
    }
  }

  return paths;
}

function buildRiverPath(width: number, height: number, margin: number, lat: number, lon: number) {
  const points: Array<[number, number]> = [];
  const count = Math.max(18, Math.ceil((height + margin * 2) / 68));
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const y = -margin + t * (height + margin * 2);
    const x =
      width * (0.5 + Math.sin(t * Math.PI * 1.45 + lat) * 0.07) +
      Math.sin(t * Math.PI * 6.3 + lon) * width * 0.035;
    points.push([round(x), round(y)]);
  }
  return smoothPath(points);
}

function buildTributaryPath(width: number, height: number, margin: number, lat: number, lon: number) {
  const points: Array<[number, number]> = [];
  const count = 12;
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const x = -margin + t * (width * 0.75 + margin);
    const y =
      height * 0.28 +
      t * height * 0.22 +
      Math.sin(t * Math.PI * 2.7 + lat + lon) * height * 0.04;
    points.push([round(x), round(y)]);
  }
  return smoothPath(points);
}

function smoothPath(points: Array<[number, number]>) {
  if (points.length < 2) return "";
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [x, y] = points[i];
    const [nextX, nextY] = points[i + 1];
    d += ` Q${x} ${y} ${round((x + nextX) / 2)} ${round((y + nextY) / 2)}`;
  }
  const last = points[points.length - 1];
  return `${d} T${last[0]} ${last[1]}`;
}

function closedContour(cx: number, cy: number, rx: number, ry: number, phase: number) {
  const points: Array<[number, number]> = [];
  const count = 18;
  for (let i = 0; i <= count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const wobble = 1 + Math.sin(a * 3 + phase) * 0.09 + Math.cos(a * 5 - phase) * 0.05;
    points.push([round(cx + Math.cos(a) * rx * wobble), round(cy + Math.sin(a) * ry * wobble)]);
  }
  return smoothPath(points);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
