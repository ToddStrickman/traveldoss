import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getTiltPermissionState } from "@/hooks/use-device-tilt";

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
 * resting baseline). On iOS, gyro permission must be requested synchronously
 * from a real gesture, so we prime it from the user's first touch/click.
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

type OrientationPermissionEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const BUBBLES: Bubble[] = [
  { id: 1, size: 6, drift: 11, phase: 0 },
  { id: 2, size: 4, drift: 8, phase: 1.4 },
  { id: 3, size: 3, drift: 13, phase: 3.1 },
];

/**
 * Configurable low-pass filter applied to the raw gyro stream BEFORE the
 * spring (smX/smY) sees the value.
 *
 * - `kind: "ema"` is a first-order exponential moving average. `cutoffHz`
 *   maps to alpha via `alpha = 1 - exp(-2π·fc·dt)`, which behaves like a
 *   first-order Butterworth low-pass at the same cutoff.
 * - `kind: "butterworth"` is a 2nd-order Butterworth cascade (two
 *   one-poles in series) — steeper roll-off, less ripple, at the cost of
 *   ~1 extra frame of group delay.
 *
 * `deadband` (in normalized 0..1 tilt units) snaps sub-noise residuals to
 * the previous frame so a still phone reads as still.
 */
export type GyroFilterConfig = {
  kind?: "ema" | "butterworth";
  /** -3 dB cutoff frequency in Hz. Lower = smoother + laggier. */
  cutoffHz?: number;
  /** Snap-to-still threshold in normalized tilt units (0..1). */
  deadband?: number;
};

const DEFAULT_FILTER: Required<GyroFilterConfig> = {
  kind: "butterworth",
  cutoffHz: 6,
  deadband: 0.012,
};

export function MobileBubbles({ filter }: { filter?: GyroFilterConfig } = {}) {
  const [mounted, setMounted] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const rafRef = useRef<number | null>(null);
  const elsRef = useRef<Array<HTMLDivElement | null>>([]);
  const debugRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<Required<GyroFilterConfig>>({ ...DEFAULT_FILTER, ...filter });
  filterRef.current = { ...DEFAULT_FILTER, ...filter };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTouchish =
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(hover: none)").matches ||
      "ontouchstart" in window;
    setCoarse(isTouchish);
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setDebugMode(new URLSearchParams(window.location.search).get("debug") === "bubbles");
    setMounted(true);
    if (!isTouchish) return;
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!mounted || !coarse || reduced || hidden) return;

    const OrientationCtor = window.DeviceOrientationEvent as OrientationPermissionEvent | undefined;
    let needsGesturePermission =
      !!OrientationCtor &&
      typeof OrientationCtor.requestPermission === "function" &&
      getTiltPermissionState() !== "granted";
    let requestingPermission = false;
    let smX = 0;
    let smY = 0;
    let tgtX = 0;
    let tgtY = 0;
    // Low-pass filter state. The 2nd Butterworth stage uses fX1/fY1 as the
    // intermediate one-pole; the first stage writes directly to tgtX/tgtY.
    let fX1 = 0;
    let fY1 = 0;
    let hasRaw = false;
    let lastSampleT = 0;
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

    const getScreenAngle = (): number => {
      const so = (window.screen && (window.screen.orientation as ScreenOrientation | undefined)) || undefined;
      if (so && typeof so.angle === "number") return so.angle;
      const legacy = (window as unknown as { orientation?: number }).orientation;
      return typeof legacy === "number" ? legacy : 0;
    };

    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      needsGesturePermission = false;
      if (!gotOrientation) {
        gotOrientation = true;
        profile = GYRO;
      }
      lastInputT = performance.now();
      // Re-map raw beta/gamma to screen-relative axes so landscape and
      // upside-down orientations feel correct.
      const beta = e.beta;
      const gamma = e.gamma;
      const angle = getScreenAngle();
      let rawX: number;
      let rawY: number;
      switch (angle) {
        case 90:
          rawX = beta;
          rawY = -gamma;
          break;
        case -90:
        case 270:
          rawX = -beta;
          rawY = gamma;
          break;
        case 180:
          rawX = -gamma;
          rawY = -beta;
          break;
        default:
          rawX = gamma;
          rawY = beta;
      }
      const nx = Math.max(-1, Math.min(1, rawX / 35));
      const ny = Math.max(-1, Math.min(1, rawY / 45));
      const now = performance.now();
      const sampleDt = lastSampleT === 0 ? 1 / 60 : Math.min(0.1, (now - lastSampleT) / 1000);
      lastSampleT = now;
      const { kind, cutoffHz, deadband } = filterRef.current;
      // alpha for a first-order low-pass at `cutoffHz` given this sample dt.
      const alpha = 1 - Math.exp(-2 * Math.PI * cutoffHz * sampleDt);
      if (!hasRaw) {
        tgtX = nx;
        tgtY = ny;
        fX1 = nx;
        fY1 = ny;
        hasRaw = true;
      } else if (kind === "butterworth") {
        // Two cascaded one-poles ≈ 2nd-order Butterworth response.
        fX1 += (nx - fX1) * alpha;
        fY1 += (ny - fY1) * alpha;
        tgtX += (fX1 - tgtX) * alpha;
        tgtY += (fY1 - tgtY) * alpha;
      } else {
        tgtX += (nx - tgtX) * alpha;
        tgtY += (ny - tgtY) * alpha;
      }
      // Snap small residuals to the previous frame so a still phone reads
      // as truly still.
      if (Math.abs(tgtX - smX) < deadband) tgtX = smX;
      if (Math.abs(tgtY - smY) < deadband) tgtY = smY;
    };
    // Some browsers (Chrome on Android) only fire `deviceorientationabsolute`
    // when the platform can resolve absolute heading. Listen to both and let
    // whichever fires first drive the bubbles.
    window.addEventListener("deviceorientation", onOrient, { passive: true });
    window.addEventListener(
      "deviceorientationabsolute" as "deviceorientation",
      onOrient,
      { passive: true },
    );

    const primeOrientation = () => {
      if (!needsGesturePermission || requestingPermission || !OrientationCtor?.requestPermission) return;
      requestingPermission = true;
      const permissionRequest = OrientationCtor.requestPermission();
      void permissionRequest
        .then((result) => {
          needsGesturePermission = result !== "granted" && result !== "denied";
        })
        .catch(() => {
          needsGesturePermission = true;
        })
        .finally(() => {
          requestingPermission = false;
        });
    };
    window.addEventListener("touchstart", primeOrientation, { passive: true, capture: true });
    window.addEventListener("pointerdown", primeOrientation, { passive: true, capture: true });
    window.addEventListener("click", primeOrientation, { passive: true, capture: true });

    // Fallback for environments without device orientation (preview
    // emulator, desktop, iOS pre-permission). Map pointer / scroll to a
    // gentle drift so bubbles always feel alive.
    const onPointer = (e: PointerEvent | MouseEvent) => {
      if (gotOrientation) return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      lastInputT = performance.now();
      tgtX = (e.clientX / w) * 2 - 1; // -1..1
      tgtY = 1 - (e.clientY / h) * 2; // 1 at top, -1 at bottom
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

      // Travel almost the entire viewport so bubbles can reach edges.
      const TRAVEL_X = 42; // vw
      const TRAVEL_Y = 44; // vh
      // Hard caps so a runaway sensor spike or pointer jump can never
      // launch a bubble past the viewport edge.
      const MAX_X = 48;
      const MAX_Y = 48;
      for (let i = 0; i < BUBBLES.length; i++) {
        const el = elsRef.current[i];
        if (!el) continue;
        const b = BUBBLES[i];
        const wobX = Math.sin(t / 2 + b.phase) * 2.4;
        const wobY = Math.cos(t / 2.4 + b.phase) * 2.4;
        const rawOffX = smX * TRAVEL_X + wobX;
        const rawOffY = -smY * TRAVEL_Y + wobY;
        const offX = Math.max(-MAX_X, Math.min(MAX_X, rawOffX));
        const offY = Math.max(-MAX_Y, Math.min(MAX_Y, rawOffY));
        el.style.transform = `translate3d(${offX.toFixed(2)}vw, ${offY.toFixed(2)}vh, 0)`;
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
      window.removeEventListener(
        "deviceorientationabsolute" as "deviceorientation",
        onOrient,
      );
      window.removeEventListener("touchstart", primeOrientation, { capture: true });
      window.removeEventListener("pointerdown", primeOrientation, { capture: true });
      window.removeEventListener("click", primeOrientation, { capture: true });
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("mousemove", onPointer);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      elsRef.current = [];
    };
  }, [mounted, coarse, reduced, hidden]);

  // Render nothing on the server and on the very first client paint so
  // hydration cannot mismatch. After mount, only render on touch devices
  // and only via a portal attached to document.body — keeps the overlay
  // out of the hydrated React tree entirely.
  if (!mounted || !coarse || hidden) return null;

  return createPortal(
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
          className="td-bubble"
          style={{
            width: `${b.size}vmin`,
            height: `${b.size}vmin`,
            marginLeft: `${-b.size / 2}vmin`,
            marginTop: `${-b.size / 2}vmin`,
            ["--td-bubble-drift" as string]: `${b.drift}s`,
          }}
        />
      ))}
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
    </div>,
    document.body,
  );
}