import type { SVGProps } from "react";

/**
 * Shared travel iconography for place categories. Each icon is a single-line,
 * stroke-only SVG drawn on a 24×24 grid — minimalist, fashion-forward, posh.
 * Uses currentColor so skins can theme via CSS tokens.
 */

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
};

export function HotelIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      {/* bed: headboard, mattress, pillow, leg */}
      <path d="M3 19V8" />
      <path d="M3 14h18v5" />
      <path d="M7 14v-3a2 2 0 0 1 2-2h10v5" />
      <path d="M7 11.5h4" />
    </svg>
  );
}

export function AirfareIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      {/* paper plane, single continuous gesture */}
      <path d="M21 3 3 11l7 2 2 7 9-17z" />
      <path d="m10 13 5-6" />
    </svg>
  );
}

export function CurrencyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      {/* coin: circle with subtle inner rule */}
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v10" />
      <path d="M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" />
    </svg>
  );
}

export function WalkingIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      {/* walking figure */}
      <circle cx="13" cy="4.5" r="1.5" />
      <path d="M10 21l2.5-6 2.5 3 2 4" />
      <path d="m9 12 3-4 2.5 2.5 3 1" />
      <path d="M8 17l2-2" />
    </svg>
  );
}

export function FoodIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      {/* fork + knife crossed */}
      <path d="M8 3v8a2 2 0 0 1-2 2H5" />
      <path d="M6.5 3v6" />
      <path d="M9.5 3v6" />
      <path d="M6.5 13v8" />
      <path d="M17 3c-2 1.5-3 3.5-3 6 0 1.7 1 3 2.5 3H17v9" />
    </svg>
  );
}

export function SeeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      {/* eye: simple almond + pupil */}
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

const ICONS = {
  hotel: HotelIcon,
  stay: HotelIcon,
  airfare: AirfareIcon,
  flight: AirfareIcon,
  currency: CurrencyIcon,
  walking: WalkingIcon,
  food: FoodIcon,
  eat: FoodIcon,
  see: SeeIcon,
} as const;

const LABELS: Record<string, string> = {
  hotel: "Hotel",
  stay: "Hotel",
  airfare: "Flight",
  flight: "Flight",
  currency: "Currency",
  walking: "Walking",
  food: "Food",
  eat: "Food",
  see: "See",
};

export function CategoryIcon({ category, ...props }: IconProps & { category?: string }) {
  if (!category) return null;
  const Icon = ICONS[category as keyof typeof ICONS];
  if (!Icon) return null;
  return <Icon {...props} />;
}

export function categoryLabel(category?: string) {
  if (!category) return "place";
  return LABELS[category] ?? category;
}