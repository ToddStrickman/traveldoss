/**
 * SandDrift — a thin drift of sand grains behind the template carousel, so
 * choosing a dossier echoes the excavated wordmark that opens the site.
 *
 * Deliberately cheap: a few hundred grains on a 2D canvas, paused when the
 * tab is hidden, and not mounted at all under prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from "react";

const GRAINS = 220;

export function SandDrift({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const grains = Array.from({ length: GRAINS }, () => ({
      x: Math.random(),
      y: Math.random(),
      v: 0.02 + Math.random() * 0.06,
      r: 0.5 + Math.random() * 1.1,
      a: 0.12 + Math.random() * 0.3,
    }));

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const g of grains) {
        g.x += (g.v * dt) / 1000;
        if (g.x > 1.02) g.x = -0.02;
        const px = g.x * w;
        const py = g.y * h + Math.sin((now / 2600 + g.y * 8)) * 4;
        ctx.globalAlpha = g.a;
        ctx.fillStyle = "#d6c29c";
        ctx.beginPath();
        ctx.arc(px, py, g.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  // The element renders (reserving its space) even when the drift is off, so
  // enabling/disabling motion never shifts layout.
  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
