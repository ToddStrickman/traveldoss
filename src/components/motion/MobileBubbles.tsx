import { useEffect, useRef, useState } from "react";

/**
 * MobileBubbles — a quiet floating-bubble overlay on touch devices.
 *
 * Two or three tiny bubbles sit on the screen as if you were peering into
 * a pool from above. Tilt the phone and they drift to whichever direction
 * the device is oriented:
 *   - Phone flat (face up):       bubbles centered (top-down "pool" view).
 *   - Phone held upright:         bubbles drift toward the top center
 *                                 (gravity pulls them "up" toward the sky).
 *   - Tilted left/right:          bubbles slide toward the higher edge.
 *
 * Listens directly to `deviceorientation` rather than going through the
 * shared tilt hook so we can use a screen-relative mapping (no -45°
 * resting baseline). No permission gate, no UI — on iOS where permission
 * is required, the event simply never fires and bubbles stay centered.
 */
type Bubble = {
  id: number;
  /** Base position on screen, 0..1. */
  bx: number;
  by: number;
  /** Size in vmin. */
  size: number;
  /** Drift speed in seconds. */
  drift: number;
  /** Phase offset for the gentle wobble. */
  phase: number;
};

const BUBBLES: Bubble[] = [
  { id: 1, bx: 0.5, by: 0.5, size: 6, drift: 11, phase: 0 },
  { id: 2, bx: 0.5, by: 0.5, size: 4, drift: 8, phase: 1.4 },
  { id: 3, bx: 0.5, by: 0.5, size: 3, drift: 13, phase: 3.1 },
];

export function MobileBubbles() {
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const tiltRef = useRef({ tx: 0, ty: 0 });
  const rafRef = useRef<number | null>(null);
  const elsRef = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduce || !coarse) return;
    setMounted(true);
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let smX = 0;
    let smY = 0;
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      // beta: 0 = flat face-up, 90 = upright. Map 0..90 -> 0..1 so the
      // higher you stand the phone the more the bubbles rise.
      const upright = Math.max(0, Math.min(1, e.beta / 90));
      // gamma: tilt left/right in degrees. ±45 saturates.
      const sideways = Math.max(-1, Math.min(1, e.gamma / 45));
      // Smooth toward the target so motion stays plush.
      smX += (sideways - smX) * 0.18;
      smY += (upright - smY) * 0.18;
      tiltRef.current = { tx: smX, ty: smY };
    };
    window.addEventListener("deviceorientation", onOrient, { passive: true });

    const tick = () => {
      const { tx, ty } = tiltRef.current;
      const t = performance.now() / 1000;
      BUBBLES.forEach((b, i) => {
        const el = elsRef.current[i];
        if (!el) return;
        // tx in [-1..1] -> ±35% of vmin from base.
        // ty in [0..1]  -> bubble rises from 0 to -40% of vmin.
        const wobX = Math.sin(t / 2 + b.phase) * 1.2;
        const wobY = Math.cos(t / 2.4 + b.phase) * 1.2;
        const offX = tx * 30 + wobX;
        const offY = -ty * 38 + wobY;
        el.style.transform = `translate3d(${offX.toFixed(2)}vmin, ${offY.toFixed(2)}vmin, 0)`;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mounted]);

  if (!mounted || hidden) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[2] overflow-hidden"
      style={{ mixBlendMode: "screen" }}
    >
      {BUBBLES.map((b, i) => (
        <div
          key={b.id}
          ref={(n) => {
            elsRef.current[i] = n;
          }}
          style={{
            position: "absolute",
            left: `${b.bx * 100}%`,
            top: `${b.by * 100}%`,
            width: `${b.size}vmin`,
            height: `${b.size}vmin`,
            marginLeft: `${-b.size / 2}vmin`,
            marginTop: `${-b.size / 2}vmin`,
            borderRadius: "9999px",
            background:
              "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.18) 35%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0) 75%)",
            boxShadow:
              "inset 0 0 0 1px rgba(255,255,255,0.22), inset 0 -2px 6px rgba(255,255,255,0.18)",
            willChange: "transform",
            animation: `td-bubble-breathe ${b.drift}s ease-in-out infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes td-bubble-breathe {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 0.95; }
        }
      `}</style>
    </div>
  );
}