/**
 * SandBorder — a canvas of pink sand grains drifting along the perimeter of a
 * rounded rectangle. Used to dress the layout switcher so the control reads as
 * part of the studio's sand language instead of a stock outlined button.
 *
 * Purely decorative: it sits behind the trigger, never takes pointer events and
 * renders a single static frame when the visitor prefers reduced motion.
 */
import { useEffect, useRef } from "react";

type Grain = {
  /** Position along the perimeter, 0..1. */
  t: number;
  /** Signed offset from the path, in px. */
  off: number;
  speed: number;
  size: number;
  alpha: number;
};

const GRAIN_COUNT = 190;

/** Point on a rounded-rect perimeter at normalised distance t. */
function perimeterPoint(w: number, h: number, r: number, t: number) {
  const straightX = Math.max(0, w - 2 * r);
  const straightY = Math.max(0, h - 2 * r);
  const arc = (Math.PI * r) / 2;
  const segs = [straightX, arc, straightY, arc, straightX, arc, straightY, arc];
  const total = segs.reduce((a, b) => a + b, 0);
  let d = ((t % 1) + 1) % 1;
  d *= total;
  let i = 0;
  while (i < segs.length && d > segs[i]!) {
    d -= segs[i]!;
    i += 1;
  }
  const seg = segs[i] || 1;
  const k = d / seg;
  switch (i) {
    case 0:
      return { x: r + straightX * k, y: 0 };
    case 1: {
      const a = (-Math.PI / 2) * (1 - k);
      return { x: w - r + r * Math.cos(a), y: r + r * Math.sin(a) };
    }
    case 2:
      return { x: w, y: r + straightY * k };
    case 3: {
      const a = (Math.PI / 2) * k;
      return { x: w - r + r * Math.cos(a), y: h - r + r * Math.sin(a) };
    }
    case 4:
      return { x: w - r - straightX * k, y: h };
    case 5: {
      const a = Math.PI / 2 + (Math.PI / 2) * k;
      return { x: r + r * Math.cos(a), y: h - r + r * Math.sin(a) };
    }
    case 6:
      return { x: 0, y: h - r - straightY * k };
    default: {
      const a = Math.PI + (Math.PI / 2) * k;
      return { x: r + r * Math.cos(a), y: r + r * Math.sin(a) };
    }
  }
}

/** Inward normal-ish direction, approximated from the box centre. */
function normalAt(x: number, y: number, w: number, h: number) {
  const dx = x - w / 2;
  const dy = y - h / 2;
  const len = Math.hypot(dx, dy) || 1;
  return { nx: dx / len, ny: dy / len };
}

export function SandBorder({ radius = 999 }: { radius?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const grains: Grain[] = Array.from({ length: GRAIN_COUNT }, () => ({
      t: Math.random(),
      off: (Math.random() - 0.5) * 5.2,
      speed: (0.00006 + Math.random() * 0.00022) * (Math.random() < 0.22 ? -1 : 1),
      size: 0.35 + Math.pow(Math.random(), 2.1) * 1.35,
      alpha: 0.18 + Math.random() * 0.72,
    }));

    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      if (!w || !h) return;
      const r = Math.min(radius, h / 2, w / 2);
      ctx.clearRect(0, 0, w, h);
      for (const g of grains) {
        if (!reduced) g.t += g.speed;
        const p = perimeterPoint(w, h, r, g.t);
        const { nx, ny } = normalAt(p.x, p.y, w, h);
        // Slow breathing drift so grains shimmer rather than march.
        const breathe = reduced ? 0 : Math.sin(now * 0.0009 + g.t * 40) * 0.9;
        const off = g.off + breathe;
        const x = p.x + nx * off;
        const y = p.y + ny * off;
        // Pink sand: hotter and brighter toward the top-right corner.
        const heat = (x / w) * 0.6 + (1 - y / h) * 0.4;
        const hue = 356 - heat * 24;
        const light = 62 + heat * 22;
        const sat = 42 + heat * 46;
        ctx.fillStyle = `hsl(${hue} ${sat}% ${light}% / ${g.alpha * (0.42 + heat * 0.58)})`;
        ctx.beginPath();
        ctx.arc(x, y, g.size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    resize();
    if (reduced) {
      draw(0);
    } else {
      raf = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(0);
    });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [radius]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
