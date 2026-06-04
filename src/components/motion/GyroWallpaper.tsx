import { useEffect, useState } from "react";
import { useDeviceTilt } from "@/hooks/use-device-tilt";

/**
 * GyroWallpaper — full-screen ambient backdrop that drifts with device tilt.
 *
 * Three plush color clouds and a faint star field, each shifting at a
 * different speed so the scene parallaxes when you rotate the phone. The
 * whole thing renders with `mix-blend-mode: screen` so it tints dark
 * surfaces (the app's default) and stays invisible on light surfaces — it
 * augments existing page backgrounds rather than replacing them.
 *
 * Mobile-only: gated on coarse pointer and prefers-reduced-motion via the
 * shared device-tilt hook. Desktop and reduced-motion users see nothing.
 */
export function GyroWallpaper() {
  const { x, y, enabled } = useDeviceTilt();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (!reduce && coarse) setMounted(true);
  }, []);

  if (!mounted) return null;

  // Per-layer offsets — larger numbers feel further away.
  const layers = [
    { depth: 60, hue: "210 95% 60%", size: "70vmax", x: 25, y: 30, opacity: 0.55 },
    { depth: 90, hue: "12 90% 55%", size: "60vmax", x: 75, y: 70, opacity: 0.42 },
    { depth: 120, hue: "275 80% 55%", size: "80vmax", x: 60, y: 20, opacity: 0.32 },
  ];

  const dust = enabled ? `translate3d(${(-x * 20).toFixed(2)}px, ${(-y * 20).toFixed(2)}px, 0)` : "translate3d(0,0,0)";

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      style={{ mixBlendMode: "screen" }}
    >
      {layers.map((l, i) => {
        const tx = enabled ? -x * l.depth : 0;
        const ty = enabled ? -y * l.depth : 0;
        return (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${l.x}%`,
              top: `${l.y}%`,
              width: l.size,
              height: l.size,
              marginLeft: `calc(${l.size} / -2)`,
              marginTop: `calc(${l.size} / -2)`,
              background: `radial-gradient(circle, hsla(${l.hue} / ${l.opacity}) 0%, hsla(${l.hue} / 0) 60%)`,
              transform: `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`,
              transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
              filter: "blur(20px)",
              willChange: enabled ? "transform" : undefined,
            }}
          />
        );
      })}
      {/* Star/dust field — finer, faster parallax */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle 1px at 12% 18%, rgba(255,255,255,0.9), transparent 60%), radial-gradient(circle 1px at 78% 32%, rgba(255,255,255,0.7), transparent 60%), radial-gradient(circle 1.2px at 42% 65%, rgba(255,255,255,0.8), transparent 60%), radial-gradient(circle 1px at 88% 80%, rgba(255,255,255,0.7), transparent 60%), radial-gradient(circle 1px at 24% 88%, rgba(255,255,255,0.6), transparent 60%), radial-gradient(circle 1px at 60% 12%, rgba(255,255,255,0.7), transparent 60%), radial-gradient(circle 1.5px at 8% 55%, rgba(255,255,255,0.5), transparent 60%), radial-gradient(circle 1px at 95% 50%, rgba(255,255,255,0.6), transparent 60%)",
          backgroundSize: "100% 100%",
          transform: dust,
          transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: enabled ? "transform" : undefined,
        }}
      />
      {/* Slow ambient drift even when the phone is still */}
      <style>{`
        @keyframes td-gyro-drift {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, -1.5%, 0) scale(1.04); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
      `}</style>
    </div>
  );
}