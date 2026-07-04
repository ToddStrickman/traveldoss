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
  /** Remember excavation progress across visits (localStorage). */
  persist?: boolean;
  className?: string;
  onStory?: (story: Story) => void;
}

const DEFAULT_LINES: HeadlineLine[] = [
  { text: "Travel" },
  { text: "Doss", italic: true, accent: "." },
];

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
    let ro: ResizeObserver | undefined;

    const onMove = (e: PointerEvent) => engine?.pointer(e.clientX, e.clientY, e.buttons > 0);
    const onLeave = () => engine?.pointerLeave();

    (async () => {
      const { SandEngine } = await import("@/lib/sand/engine");
      if (disposed) return;

      // Never start against a 0×0 container (mid-hydration layout): the text
      // sampler would rasterize at world-width 0 and every grain would home
      // at the origin. Wait for a real measurement first.
      await waitForSize(container);
      if (disposed) return;
      lastW = container.clientWidth;

      const opts: SandEngineOptions = {
        lines,
        fontFamily: family,
        particleCount: budget,
        cursorRadius,
        attraction,
        windIntensity,
        dustIntensity,
        revealDuration,
        lighting,
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
        engine.resize(rect.width, rect.height);
        // Width shifts change the rasterized font size → re-sample, debounced.
        if (Math.abs(rect.width - lastW) > 80) {
          clearTimeout(rebuildTimer);
          rebuildTimer = setTimeout(() => {
            lastW = rect.width;
            void engine?.rebuild(rect.width, rect.height);
          }, 300);
        }
      });
      ro.observe(container);
    })();

    return () => {
      disposed = true;
      clearTimeout(rebuildTimer);
      ro?.disconnect();
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
      className={`relative select-none touch-none ${className}`}
      aria-label={accessibleText}
      role="img"
    >
      <h1 className="sr-only">{accessibleText}</h1>
      {mode === "text" ? (
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center text-center text-[18vw] font-normal leading-[0.95] tracking-[-0.03em] text-ink md:text-[9vw]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {accessibleText}
        </span>
      ) : (
        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 h-full w-full cursor-crosshair"
          style={{ opacity: mode === "pending" ? 0 : 1, transition: "opacity 0.9s ease" }}
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

/** Resolves once the element has a real layout size (rAF polling, ~2s cap). */
function waitForSize(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    let tries = 0;
    const check = () => {
      if ((el.clientWidth > 10 && el.clientHeight > 10) || tries++ > 120) resolve();
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
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
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
    ctx.arc(w / 2 + p.x, h / 2 - p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return true;
}
