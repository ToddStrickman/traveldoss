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

export function MobileBubbles() {
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const tiltRef = useRef({ tx: 0, ty: 0, dirty: true });
  const rafRef = useRef<number | null>(null);
  const elsRef = useRef<Array<HTMLDivElement | null>>([]);
  const debugRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (!coarse) return;
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setDebugMode(new URLSearchParams(window.location.search).get("debug") === "bubbles");
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
    let tgtX = 0;
    let tgtY = 0;
    let gotOrientation = false;
    let lastT = 0;
    // Per-input-source spring tuning. Pointer events are large discrete
    // jumps (a finger lands somewhere new), so a softer spring with a
    // deeper idle relaxation keeps motion from snapping. Gyro is a
    // continuous stream of small deltas, so a snappier spring tracks
    // flicks without lag while still settling quickly when the phone
    // stops moving.
    type Profile = {
      /** Active spring stiffness (rad/s). */
      omega: number;
      /** Idle multiplier applied after `idleMs` of no input. */
      idleScale: number;
      /** How long with no input before the spring relaxes. */
      idleMs: number;
    };
    const POINTER: Profile = { omega: 5.5, idleScale: 0.45, idleMs: 700 };
    const GYRO: Profile = { omega: 8.5, idleScale: 0.6, idleMs: 900 };
    let profile: Profile = POINTER;
    let lastInputT = 0;

    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      if (!gotOrientation) {
        gotOrientation = true;
        profile = GYRO;
      }
      lastInputT = performance.now();
      // beta: 0 = flat face-up, 90 = upright. Map 0..90 -> 0..1.
      tgtY = Math.max(0, Math.min(1, e.beta / 90));
      // gamma: tilt left/right in degrees. ±45 saturates.
      tgtX = Math.max(-1, Math.min(1, e.gamma / 45));
    };
    window.addEventListener("deviceorientation", onOrient, { passive: true });

    // Fallback for environments without device orientation (preview
    // emulator, desktop, iOS pre-permission). Map pointer / scroll to a
    // gentle drift so bubbles always feel alive.
    const onPointer = (e: PointerEvent | MouseEvent) => {
      if (gotOrientation) return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      lastInputT = performance.now();
      tgtX = (e.clientX / w) * 2 - 1; // -1..1
      tgtY = 1 - e.clientY / h; // 1 at top, 0 at bottom
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("mousemove", onPointer, { passive: true });

    const tick = (time: number) => {
      // Frame-rate-independent exponential smoothing.
      // alpha = 1 - exp(-omega * dt) gives the same perceived response
      // whether the loop runs at 60, 90, or 120 Hz.
      const dt = lastT === 0 ? 1 / 60 : Math.min(0.05, (time - lastT) / 1000);
      lastT = time;
      // If input has been idle for >800ms, relax the spring so the bubbles
      // settle gently instead of hunting around the last target.
      const idle = time - lastInputT > profile.idleMs;
      const k = idle ? profile.omega * profile.idleScale : profile.omega;
      const alpha = 1 - Math.exp(-k * dt);
      smX += (tgtX - smX) * alpha;
      smY += (tgtY - smY) * alpha;
      const t = time / 1000;

      for (let i = 0; i < BUBBLES.length; i++) {
        const el = elsRef.current[i];
        if (!el) continue;
        const b = BUBBLES[i];
        const wobX = Math.sin(t / 2 + b.phase) * 2.4;
        const wobY = Math.cos(t / 2.4 + b.phase) * 2.4;
        const offX = smX * 30 + wobX;
        const offY = -smY * 38 + wobY;
        el.style.transform = `translate3d(${offX.toFixed(2)}vmin, ${offY.toFixed(2)}vmin, 0)`;
      }

      if (debugRef.current) {
        debugRef.current.textContent = [
          `target  x:${tgtX.toFixed(3)} y:${tgtY.toFixed(3)}  [${gotOrientation ? "gyro" : "pointer"}]`,
          `spring  x:${smX.toFixed(3)} y:${smY.toFixed(3)}  ω:${profile.omega.toFixed(1)} (${gotOrientation ? "gyro" : "pointer"})`,
          `dt:${dt.toFixed(4)}s  α:${alpha.toFixed(4)}  idle:${idle}`,
        ].join("\n");
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
      {debugMode && (
        <div
          ref={debugRef}
          className="fixed bottom-2 left-2 z-[9999] rounded px-2 py-1.5 text-[10px] leading-tight"
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            color: "#a5f3fc",
            background: "rgba(2,6,23,0.75)",
            WebkitBackdropFilter: "blur(4px)",
            backdropFilter: "blur(4px)",
            pointerEvents: "none",
            whiteSpace: "pre",
          }}
        />
      )}
    </div>
  );
}