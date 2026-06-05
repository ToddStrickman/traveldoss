import { type CSSProperties, type ReactNode } from "react";
import { useDeviceTilt } from "@/hooks/use-device-tilt";

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
 * MotionPermissionPrompt — intentionally a no-op. Motion effects must
 * never require user acceptance on phones; if a platform (iOS) requires
 * explicit permission, we simply leave the effect off rather than prompt.
 * Kept as an export so existing imports continue to work.
 */
export function MotionPermissionPrompt() {
  return null;
}