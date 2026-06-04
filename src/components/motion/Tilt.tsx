import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDeviceTilt, requestTiltPermission, getTiltPermissionState } from "@/hooks/use-device-tilt";

/**
 * Parallax — translates content opposite the device tilt to create depth.
 * `depth` is the max pixel offset at full tilt (±20°). Background layers use
 * larger depths, foreground content uses smaller (or negative) depths so
 * planes shift at different speeds.
 *
 * Desktop / reduced-motion / pre-permission: renders a plain wrapper.
 */
export function Parallax({
  depth = 12,
  className,
  style,
  children,
  as: As = "div",
}: {
  depth?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  as?: "div" | "section" | "span";
}) {
  const { x, y, enabled } = useDeviceTilt();
  const tx = enabled ? -x * depth : 0;
  const ty = enabled ? -y * depth : 0;
  return (
    <As
      className={className}
      style={{
        ...style,
        transform: `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`,
        transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: enabled ? "transform" : undefined,
      }}
    >
      {children}
    </As>
  );
}

/**
 * TiltCard — perspective-rotates content with device orientation for a
 * floating-card feel. Optional `glare` paints a soft highlight that tracks
 * the tilt direction.
 */
export function TiltCard({
  intensity = 8,
  glare = true,
  className,
  style,
  children,
}: {
  intensity?: number; // max rotation in degrees
  glare?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { x, y, enabled } = useDeviceTilt();
  const rotY = enabled ? x * intensity : 0;
  const rotX = enabled ? -y * intensity : 0;
  return (
    <div
      className={className}
      style={{
        ...style,
        transform: `perspective(900px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`,
        transformStyle: "preserve-3d",
        transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: enabled ? "transform" : undefined,
        position: "relative",
      }}
    >
      {children}
      {glare && enabled ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 mix-blend-overlay"
          style={{
            background: `radial-gradient(circle at ${50 + x * 40}% ${50 + y * 40}%, rgba(255,255,255,0.18), rgba(255,255,255,0) 55%)`,
            transition: "background 180ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * MotionPermissionPrompt — one-tap iOS gate that asks the device for
 * orientation access. Auto-shows only on iOS Safari where permission is
 * required; otherwise it self-removes silently.
 */
export function MotionPermissionPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("td_tilt_dismissed") === "1") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduce || !coarse) return;
    const Ctor = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> })
      | undefined;
    const needsGate = Ctor && typeof Ctor.requestPermission === "function";
    if (needsGate && getTiltPermissionState() === "unknown") setVisible(true);
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed inset-x-3 bottom-4 z-[60] md:hidden">
      <div className="surface-card flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-paper/90 px-4 py-3 text-[11px] text-ink shadow-2xl backdrop-blur">
        <span className="leading-snug">
          Enable motion for the full feel — pages tilt with your phone.
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => {
              sessionStorage.setItem("td_tilt_dismissed", "1");
              setVisible(false);
            }}
            className="text-[10px] uppercase tracking-[0.3em] text-ink/45"
          >
            Skip
          </button>
          <button
            onClick={async () => {
              await requestTiltPermission();
              sessionStorage.setItem("td_tilt_dismissed", "1");
              setVisible(false);
            }}
            className="rounded-sm border border-seal bg-seal px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] text-paper"
          >
            Enable
          </button>
        </div>
      </div>
    </div>
  );
}