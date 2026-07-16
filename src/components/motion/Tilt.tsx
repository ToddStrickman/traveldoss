import { type CSSProperties, type ReactNode } from "react";

/**
 * Post-bubbles cleanup: the device-orientation system was removed
 * (see docs/branch-audit.md, Spec 4). These components stay as
 * passthrough wrappers so existing callers on landing / gallery keep
 * compiling and rendering — motion is intentionally gone. If we later
 * want tasteful cursor-parallax on desktop, it should ship as its own
 * considered feature per the spec pack §4A.
 */

/**
 * Parallax — translates content opposite the device tilt to create depth.
 * `depth` is the max pixel offset at full tilt (±20°). Background layers use
 * larger depths, foreground content uses smaller (or negative) depths so
 * planes shift at different speeds.
 *
 * Desktop / reduced-motion / pre-permission: renders a plain wrapper.
 */
export function Parallax({
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
  return (
    <As className={className} style={style}>
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
  className,
  style,
  children,
}: {
  intensity?: number;
  glare?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={className} style={style}>
      {children}
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