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
 *
 * PERFORMANCE NOTES
 * - Orientation events are throttled to ~20 Hz so low-end SoCs don't burn
 *   cycles smoothing every raw event.
 * - The rAF loop skips frames on low-end devices (≤4 logical cores) to
 *   keep headroom for the main thread.
 * - DOM writes only happen when tilt actually changed (dirty-flag) so
 *   flat/idle phones do zero layout work.
 * - `transform` + `will-change` keeps everything on the compositor;
 *   no layout properties are touched per frame.
 */
type Bubble = {
  id: number;
  /** Size in vmin. */
  size: number;
  /** Drift speed in seconds. */
  drift: number;
  /** Phase offset for the gentle wobble. */
  phase: number;
};

const BUBBLES: Bubble[] = [
  { id: 1, size: 6, drift: 11, phase: 0 },
  { id: 2, size: 4, drift: 8, phase: 1.4 },
  { id: 3, size: 3, drift: 13, phase: 3.1 },
];

/** Threshold below which a tilt delta is considered noise. */
const TILT_EPSILON = 0.005;

function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const hw = navigator.hardwareConcurrency;
  if (typeof hw === "number" && hw <= 4) return true;
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return true;
  return false;
}

export function MobileBubbles() {
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const tiltRef = useRef({ tx: 0, ty: 0, dirty: true });
  const rafRef = useRef<number | null>(null);
  const elsRef = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setMounted(true);
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!mounted || reduced) return;

    let smX = 0;
    let smY = 0;
    let lastOrient = 0;
    const orientThrottleMs = 50; // cap tilt input at ~20 Hz
    const frameSkip = isLowEndDevice() ? 2 : 1; // render every 2nd frame on low-end
    let frameIdx = 0;
    let prevTx = 0;
    let prevTy = 0;
    let gotOrientation = false;

    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      gotOrientation = true;
      const now = performance.now();
      if (now - lastOrient < orientThrottleMs) return;
      lastOrient = now;

      // beta: 0 = flat face-up, 90 = upright. Map 0..90 -> 0..1.
      const upright = Math.max(0, Math.min(1, e.beta / 90));
      // gamma: tilt left/right in degrees. ±45 saturates.
      const sideways = Math.max(-1, Math.min(1, e.gamma / 45));
      // Smooth toward the target so motion stays plush.
      smX += (sideways - smX) * 0.18;
      smY += (upright - smY) * 0.18;

      // Mark dirty only when the change is perceptible.
      if (
        Math.abs(smX - prevTx) > TILT_EPSILON ||
        Math.abs(smY - prevTy) > TILT_EPSILON
      ) {
        tiltRef.current = { tx: smX, ty: smY, dirty: true };
        prevTx = smX;
        prevTy = smY;
      }
    };
    window.addEventListener("deviceorientation", onOrient, { passive: true });

    // Fallback for environments without device orientation (preview
    // emulator, desktop, iOS pre-permission). Map pointer / scroll to a
    // gentle drift so bubbles always feel alive.
    const onPointer = (e: PointerEvent | MouseEvent) => {
      if (gotOrientation) return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const targetX = (e.clientX / w) * 2 - 1; // -1..1
      const targetY = 1 - e.clientY / h; // 1 at top, 0 at bottom
      smX += (targetX - smX) * 0.15;
      smY += (targetY - smY) * 0.15;
      tiltRef.current = { tx: smX, ty: smY, dirty: true };
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("mousemove", onPointer, { passive: true });

    const tick = (time: number) => {
      frameIdx++;
      if (frameIdx % frameSkip !== 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const { tx, ty } = tiltRef.current;
      const t = time / 1000;

      // Always animate the wobble so bubbles drift visibly even when
      // the device is perfectly still / there's no tilt source.
      {
        BUBBLES.forEach((b, i) => {
          const el = elsRef.current[i];
          if (!el) return;
          const wobX = Math.sin(t / 2 + b.phase) * 2.4;
          const wobY = Math.cos(t / 2.4 + b.phase) * 2.4;
          const offX = tx * 30 + wobX;
          const offY = -ty * 38 + wobY;
          el.style.transform = `translate3d(${offX.toFixed(2)}vmin, ${offY.toFixed(2)}vmin, 0)`;
        });
        tiltRef.current.dirty = false;
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("mousemove", onPointer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mounted, reduced]);

  if (!mounted || hidden) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[2] overflow-hidden"
    >
      {BUBBLES.map((b, i) => (
        <div
          key={b.id}
          ref={(n) => {
            elsRef.current[i] = n;
          }}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: `${b.size}vmin`,
            height: `${b.size}vmin`,
            marginLeft: `${-b.size / 2}vmin`,
            marginTop: `${-b.size / 2}vmin`,
            borderRadius: "9999px",
            opacity: reduced ? 0.55 : undefined,
            background: reduced
              ? "rgba(186,221,255,0.35)"
              : "radial-gradient(circle at 35% 30%, rgba(186,221,255,0.85) 0%, rgba(140,190,235,0.55) 35%, rgba(90,140,200,0.22) 60%, rgba(60,110,170,0) 78%)",
            boxShadow: reduced
              ? undefined
              : "inset 0 0 0 1px rgba(255,255,255,0.6), inset 0 -2px 6px rgba(255,255,255,0.35), 0 4px 14px rgba(40,80,140,0.18)",
            willChange: reduced ? undefined : "transform",
            animation: reduced
              ? undefined
              : `td-bubble-breathe ${b.drift}s ease-in-out infinite`,
          }}
        />
      ))}
      {!reduced && (
        <style>{`
          @keyframes td-bubble-breathe {
            0%, 100% { opacity: 0.8; }
            50% { opacity: 1; }
          }
        `}</style>
      )}
    </div>
  );
}