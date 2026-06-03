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

/** Transit — sedan profile for taxi / ferry / transfer / private car. */
export function TransitIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 14h18l-2-5a2 2 0 0 0-1.9-1.4H6.9A2 2 0 0 0 5 9l-2 5z" />
      <path d="M3 14v3h2v-1" />
      <path d="M21 14v3h-2v-1" />
      <circle cx="7.5" cy="14.5" r="1.5" />
      <circle cx="16.5" cy="14.5" r="1.5" />
    </svg>
  );
}

/** Restaurant — knife + fork, more refined than the generic FoodIcon. */
export function RestaurantIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3v8" />
      <path d="M9.5 3v8" />
      <path d="M5 3v6a2 2 0 0 0 2 2h1.5" />
      <path d="M8.25 11v10" />
      <path d="M17 3v18" />
      <path d="M17 3c-1.8 1.5-3 3.5-3 6 0 1.8 1.3 3 3 3" />
    </svg>
  );
}

/** Walk / hike — mountain peaks (trail) for outdoor activity blocks. */
export function HikeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 19h18" />
      <path d="m4 19 5-9 3 5 2-3 6 7" />
      <circle cx="9" cy="6.5" r="1.5" />
    </svg>
  );
}

/** Event — ticket stub with perforation; reads instantly as "ticketed entry". */
export function EventIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" />
      <path d="M13 6v12" strokeDasharray="1 2" />
    </svg>
  );
}

/** Culture / museum — neoclassical columns + pediment. */
export function CultureIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 9 12 4l9 5" />
      <path d="M4 9v1h16V9" />
      <path d="M6 11v7" />
      <path d="M10 11v7" />
      <path d="M14 11v7" />
      <path d="M18 11v7" />
      <path d="M3.5 19h17" />
    </svg>
  );
}

const ICONS = {
  // Canonical six
  transit: TransitIcon,
  restaurant: RestaurantIcon,
  walk: HikeIcon,
  event: EventIcon,
  accommodation: HotelIcon,
  culture: CultureIcon,
  // Legacy aliases
  hotel: HotelIcon,
  stay: HotelIcon,
  airfare: AirfareIcon,
  flight: AirfareIcon,
  currency: CurrencyIcon,
  walking: HikeIcon,
  food: RestaurantIcon,
  eat: RestaurantIcon,
  see: CultureIcon,
} as const;

const LABELS: Record<string, string> = {
  // Canonical six
  transit: "Transit",
  restaurant: "Restaurant",
  walk: "Walk",
  event: "Event",
  accommodation: "Stay",
  culture: "Culture",
  // Legacy aliases
  hotel: "Hotel",
  stay: "Hotel",
  airfare: "Flight",
  flight: "Flight",
  currency: "Currency",
  walking: "Walk",
  food: "Restaurant",
  eat: "Restaurant",
  see: "Culture",
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