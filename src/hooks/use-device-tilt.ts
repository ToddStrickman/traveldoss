import { useEffect, useState } from "react";

/**
 * Normalized device tilt in the range [-1, 1] for x (gamma / left-right) and
 * y (beta / front-back). Returns zeroes on desktop, when reduced motion is
 * preferred, or before the iOS permission gate has been satisfied.
 *
 * Values are low-pass filtered for a plush, drift-free feel and bound to a
 * comfortable ±20° envelope so phone wiggles don't blow out transforms.
 */
export type Tilt = { x: number; y: number; enabled: boolean };

type IOSOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const RANGE_DEG = 20; // saturate at ±20° of phone rotation
const SMOOTHING = 0.18; // 0 = frozen, 1 = no smoothing

let sharedState: { x: number; y: number } = { x: 0, y: 0 };
let listeners = new Set<(s: { x: number; y: number }) => void>();
let attached = false;
let permission: "unknown" | "granted" | "denied" | "unsupported" = "unknown";

function attach() {
  if (attached || typeof window === "undefined") return;
  attached = true;
  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    const targetX = clamp(e.gamma / RANGE_DEG, -1, 1);
    // Phones are typically held with screen tilted ~45° back; subtract that
    // baseline so the resting position reads as neutral.
    const targetY = clamp((e.beta - 45) / RANGE_DEG, -1, 1);
    sharedState = {
      x: sharedState.x + (targetX - sharedState.x) * SMOOTHING,
      y: sharedState.y + (targetY - sharedState.y) * SMOOTHING,
    };
    listeners.forEach((fn) => fn(sharedState));
  };
  window.addEventListener("deviceorientation", onOrient, { passive: true });
}

export async function requestTiltPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const Ctor = window.DeviceOrientationEvent as IOSOrientationEvent | undefined;
  if (!Ctor) {
    permission = "unsupported";
    return false;
  }
  if (typeof Ctor.requestPermission === "function") {
    try {
      const res = await Ctor.requestPermission();
      permission = res === "granted" ? "granted" : "denied";
    } catch {
      permission = "denied";
    }
  } else {
    permission = "granted";
  }
  if (permission === "granted") attach();
  return permission === "granted";
}

export function getTiltPermissionState() {
  return permission;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Subscribe to the shared device-tilt stream. Returns `{ x, y, enabled }`.
 * `enabled` is true once the listener has produced at least one sample.
 */
export function useDeviceTilt(): Tilt {
  const [tilt, setTilt] = useState<Tilt>({ x: 0, y: 0, enabled: false });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduce || !coarse) return;

    // Non-iOS browsers can attach immediately. iOS only fires events once
    // requestTiltPermission() has been granted via a user gesture.
    const Ctor = window.DeviceOrientationEvent as IOSOrientationEvent | undefined;
    if (Ctor && typeof Ctor.requestPermission !== "function") {
      attach();
    } else if (permission === "granted") {
      attach();
    }

    const listener = (s: { x: number; y: number }) =>
      setTilt({ x: s.x, y: s.y, enabled: true });
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return tilt;
}