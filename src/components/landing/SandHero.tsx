/**
 * SandHero — the Travel Doss headline as a living archaeological excavation.
 *
 * Tens of thousands of independent sand grains form the inscription; wind
 * and the visitor's cursor uncover it. See src/lib/sand/engine.ts for the
 * simulation. This wrapper owns SSR safety, accessibility, fallbacks, and
 * lifecycle.
 *
 * Fallback ladder:
 *   WebGL + motion OK → full simulation
 *   prefers-reduced-motion → static revealed inscription (one render)
 *   no WebGL → static 2D-canvas grain rendering (same sampler, no sim)
 *   no canvas at all / SSR → the plain serif headline
 */
import { useEffect, useRef, useState } from "react";
import type { SandEngineOptions } from "@/lib/sand/engine";
import type { HeadlineLine } from "@/lib/sand/textSampler";
import { ITALIC_SAMPLING, UPRIGHT_SAMPLING } from "@/lib/sand/samplingConfig";
import type { LightingPreset, Story } from "@/lib/sand/story";

export interface SandHeroProps {
  lines?: HeadlineLine[];
  /** Plain-text headline for screen readers and SEO. */
  accessibleText?: string;
  fontFamily?: string;
  particleCount?: number;
  cursorRadius?: number;
  attraction?: number;
  windIntensity?: number;
  dustIntensity?: number;
  revealDuration?: number;
  lighting?: LightingPreset;
  /** Per-line inscription alignment. Default "center". */
  align?: "center" | "left";
  /** Remember excavation progress across visits (localStorage). */
  persist?: boolean;
  className?: string;
  onStory?: (story: Story) => void;
}

const DEFAULT_LINES: HeadlineLine[] = [
  { text: "Travel", ...UPRIGHT_SAMPLING },
  { text: "Doss", italic: true, accent: ".", ...ITALIC_SAMPLING },
];

/**
 * How far the sand may spill past the layout box, as fractions of it.
 * The canvas is enlarged by these insets (pointer-events: none, so content
 * beneath — e.g. the CTA — stays clickable) and the engine feathers loose
 * grains into the margin so the field never reads as a rectangle. Deepest
 * below: the excavation's tailings drift under the content that follows.
 */
const BLEED = { x: 0.22, top: 0.12, bottom: 0.42 };

export function SandHero({
  lines = DEFAULT_LINES,
  accessibleText = "Travel Doss.",
  fontFamily,
  particleCount = 30000,
  cursorRadius = 90,
  attraction = 1,
  windIntensity = 1,
  dustIntensity = 1,
  revealDuration,
  lighting,
  align,
  persist = true,
  className = "",
  onStory,
}: SandHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"pending" | "webgl" | "static" | "text">("pending");

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const family =
      fontFamily ??
      firstFontFamily(getComputedStyle(document.documentElement).getPropertyValue("--font-display")) ??
      "Playfair Display";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Mobile: fewer grains, gentler physics — same experience, honest budget.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const budget = coarse ? Math.min(particleCount, 14000) : particleCount;

    let engine: import("@/lib/sand/engine").SandEngine | null = null;
    let disposed = false;
    let rebuildTimer: ReturnType<typeof setTimeout> | undefined;
    let lastW = container.clientWidth;
    let lastH = container.clientHeight;
    let ro: ResizeObserver | undefined;
    let io: IntersectionObserver | undefined;

    const onMove = (e: PointerEvent) => engine?.pointer(e.clientX, e.clientY, e.buttons > 0);
    const onLeave = () => engine?.pointerLeave();

    (async () => {
      const { SandEngine } = await import("@/lib/sand/engine");
      if (disposed) return;

      // Never start against a 0×0 container (mid-hydration layout): the text
      // sampler would rasterize at world-width 0 and every grain would home
      // at the origin. Wait for a real measurement first. If the container
      // still has no size when the wait caps out (stalled layout, hidden
      // ancestor), building would poison the engine's grid math with NaN —
      // fall to the plain serif headline instead of a broken sim.
      const sized = await waitForSize(container);
      if (disposed) return;
      if (!sized) {
        setMode("text");
        return;
      }
      lastW = container.clientWidth;
      lastH = container.clientHeight;

      const opts: SandEngineOptions = {
        lines,
        fontFamily: family,
        particleCount: budget,
        cursorRadius,
        attraction,
        windIntensity,
        dustIntensity,
        revealDuration,
        bleed: BLEED,
        lighting,
        align,
        persist,
        reducedMotion,
        onStory,
      };

      try {
        engine = new SandEngine(canvas, opts);
        await engine.start(container.clientWidth, container.clientHeight);
        if (disposed) { engine.dispose(); return; }
        setMode("webgl");
      } catch (err) {
        // WebGL unavailable (blocked, headless, ancient GPU). Draw the grains
        // once on a 2D canvas — still sand, just asleep.
        console.warn("[SandHero] WebGL failed, falling back to static grains:", err);
        engine = null;
        const ok = await drawStaticGrains(canvas, container, lines, family);
        setMode(ok ? "static" : "text");
        return;
      }

      container.addEventListener("pointermove", onMove);
      container.addEventListener("pointerdown", onMove);
      container.addEventListener("pointerleave", onLeave);

      ro = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (!rect || !engine) return;
        // A collapsed box (hidden ancestor, teardown reflow) is not a size
        // to simulate at — resizing/rebuilding to 0 would NaN the grid.
        if (rect.width <= 10 || rect.height <= 10) return;
        engine.resize(rect.width, rect.height);
        // Size shifts change the rasterized font size → re-sample, debounced.
        // Height matters as much as width: the box width caps at 1100px on
        // large screens, and the sampler is usually height-constrained — a
        // stale height leaves the inscription small in a grown box (a big
        // empty band under the text).
        if (Math.abs(rect.width - lastW) > 80 || Math.abs(rect.height - lastH) > 60) {
          clearTimeout(rebuildTimer);
          rebuildTimer = setTimeout(() => {
            lastW = rect.width;
            lastH = rect.height;
            void engine?.rebuild(rect.width, rect.height);
          }, 300);
        }
      });
      ro.observe(container);

      // The sim is a full-core burn (30k grains × noise per frame); nobody
      // needs it while the hero is scrolled out of view. Pause keeps the
      // last frame on the canvas so the gate is invisible — the sand is
      // simply mid-pose when the visitor scrolls back up.
      io = new IntersectionObserver(
        ([entry]) => {
          if (!engine) return;
          if (entry?.isIntersecting) engine.resume();
          else engine.pause();
        },
        { threshold: 0 },
      );
      io.observe(container);
    })();

    return () => {
      disposed = true;
      clearTimeout(rebuildTimer);
      ro?.disconnect();
      io?.disconnect();
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerdown", onMove);
      container.removeEventListener("pointerleave", onLeave);
      engine?.dispose();
      engine = null;
    };
    // The engine is intentionally built once per mount; prop changes that
    // matter (text, counts) warrant a remount via key upstream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative cursor-crosshair select-none touch-pan-y ${className}`}
      aria-label={accessibleText}
      role="img"
    >
      <h1 className="sr-only">{accessibleText}</h1>
      {mode === "text" ? (
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center text-center text-[18vw] font-normal leading-[0.95] tracking-[-0.03em] text-ink md:text-[9vw]"
          style={{ fontFamily: fontFamily ? `"${fontFamily}", Georgia, serif` : "var(--font-display)" }}
        >
          {accessibleText}
        </span>
      ) : (
        <canvas
          ref={canvasRef}
          aria-hidden
          // Oversized past the layout box so loose sand can bleed into the
          // page; pointer-events-none keeps content underneath interactive
          // (cursor digging listens on the container, not the canvas).
          className="pointer-events-none absolute"
          // Canvas is a replaced element: with only insets it would size to
          // its intrinsic pixel buffer (dpr-scaled!), so width/height must be
          // explicit for the stretch to hold on high-dpr screens.
          style={{
            left: `${-BLEED.x * 100}%`,
            top: `${-BLEED.top * 100}%`,
            width: `${(1 + 2 * BLEED.x) * 100}%`,
            height: `${(1 + BLEED.top + BLEED.bottom) * 100}%`,
            opacity: mode === "pending" ? 0 : 1,
            transition: "opacity 0.9s ease",
          }}
        />
      )}
    </div>
  );
}

/** "Playfair Display", Georgia, serif → Playfair Display */
function firstFontFamily(value: string): string | null {
  const first = value.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
  return first || null;
}

/**
 * Resolves once the element has a real layout size (rAF polling, ~2s cap).
 * Resolves true when sized, false when the cap expired first — callers must
 * NOT build the simulation against a false (the box is still 0×0).
 */
function waitForSize(el: HTMLElement): Promise<boolean> {
  return new Promise((resolve) => {
    let tries = 0;
    const check = () => {
      if (el.clientWidth > 10 && el.clientHeight > 10) resolve(true);
      else if (tries++ > 120) resolve(false);
      else requestAnimationFrame(check);
    };
    check();
  });
}

/** No-WebGL fallback: sample the headline and stipple it once, fully revealed. */
async function drawStaticGrains(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  lines: HeadlineLine[],
  family: string,
): Promise<boolean> {
  const { sampleHeadline, ensureFontLoaded } = await import("@/lib/sand/textSampler");
  const { mulberry32 } = await import("@/lib/sand/noise");
  await ensureFontLoaded(family);

  const w = container.clientWidth;
  const h = container.clientHeight;
  // The canvas is oversized past the container (bleed); draw into its full
  // box but keep the inscription centered on the container's center.
  const cw = canvas.clientWidth || w;
  const ch = canvas.clientHeight || h;
  const crect = container.getBoundingClientRect();
  const krect = canvas.getBoundingClientRect();
  const cx = crect.left - krect.left + w / 2;
  const cy = crect.top - krect.top + h / 2;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = cw * dpr;
  canvas.height = ch * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const rand = mulberry32(20260515);
  const sampled = sampleHeadline({
    lines, fontFamily: family,
    worldWidth: Math.min(w * 0.92, 1150),
    worldHeight: h * 0.94,
    maxPoints: 16000, rand,
  });

  ctx.scale(dpr, dpr);
  const SAND = ["#EDDCC0", "#D6C29C", "#B89461", "#8C6B45"];
  const GOLD = "#EBCC8C";
  for (const p of sampled.points) {
    ctx.fillStyle = p.accent ? GOLD : SAND[(rand() * SAND.length) | 0];
    ctx.globalAlpha = 0.55 + rand() * 0.45;
    const r = 0.8 + rand() * 0.8;
    ctx.beginPath();
    ctx.arc(cx + p.x, cy - p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return true;
}
