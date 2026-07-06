import type { ElementType } from "react";
import { cn } from "@/lib/utils";

/**
 * Canonical brand tagline copy. Import this constant anywhere the phrase is
 * referenced as text (aria-labels, meta descriptions, analytics events, etc.)
 * so the wording stays identical across the app.
 */
export const ELEVATE_TAGLINE = "Elevate your itinerary" as const;

type ElevateTaglineProps = {
  /** Extra classes appended to the base typography (colour, size overrides, etc.). */
  className?: string;
  /** Render as a different element (default: <span>). */
  as?: ElementType;
};

/**
 * Shared display-serif italic rendering of the brand tagline. Every surface
 * that shows "Elevate your itinerary" must use this component so the copy
 * and font styling stay locked in one place.
 */
export function ElevateTagline({ className, as: Tag = "span" }: ElevateTaglineProps) {
  return (
    <Tag
      className={cn("italic leading-snug tracking-normal", className)}
      style={{ fontFamily: "var(--font-display)" }}
    >
      {ELEVATE_TAGLINE}
    </Tag>
  );
}