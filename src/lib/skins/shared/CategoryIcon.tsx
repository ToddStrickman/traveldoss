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

/** Transit — sedan profile for taxi / transfer / private car. */
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

/** Plane — side-profile jet for airport runs and flight legs. */
export function PlaneIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12.5 21 5l-4.5 7.5L21 20l-7-2.5-2.5 4-1.5-4.5L4 14z" transform="translate(0,-2) scale(0.9) translate(1.3,2.5)" />
    </svg>
  );
}

/** Train — front-view locomotive for rail legs. */
export function TrainIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 4h14a1 1 0 0 1 1 1v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a1 1 0 0 1 1-1z" />
      <path d="M4 11h16" />
      <circle cx="8.5" cy="14.5" r="0.9" />
      <circle cx="15.5" cy="14.5" r="0.9" />
      <path d="m8 18-2 3M16 18l2 3" />
    </svg>
  );
}

/** Boat — ferry / water taxi / vaporetto hull on water. */
export function BoatIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 15h18l-2.5 3.5h-13L3 15z" />
      <path d="M7 15v-3.5h10V15" />
      <path d="M11 11.5V8h2v3.5" />
      <path d="M5 21c1.5 1 3.5 1 5 0M14 21c1.5 1 3.5 1 5 0" />
    </svg>
  );
}

/** Tram / metro — front car on rails with overhead pickup. */
export function TramIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="5" width="14" height="12" rx="2.5" />
      <path d="M5 11.5h14" />
      <path d="M12 5V2.5M9 2.5h6" />
      <circle cx="9" cy="14.5" r="0.9" />
      <circle cx="15" cy="14.5" r="0.9" />
      <path d="m8 17-1.5 3M16 17l1.5 3" />
    </svg>
  );
}

/** Bus / coach / shuttle — front view. */
export function BusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="16" height="13" rx="2.5" />
      <path d="M4 10.5h16" />
      <circle cx="8.5" cy="14" r="0.9" />
      <circle cx="15.5" cy="14" r="0.9" />
      <path d="M6.5 17v2M17.5 17v2" />
    </svg>
  );
}

/** Cocktail / aperitivo — coupe glass for bars and drinks stops. */
export function CocktailIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5h16l-8 8-8-8z" />
      <path d="M12 13v6" />
      <path d="M8.5 19h7" />
      <path d="M15 3.5l1.5 1.5" />
    </svg>
  );
}

/** Beach / swim — umbrella over a shoreline. */
export function BeachIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3a7 7 0 0 1 7 7H5a7 7 0 0 1 7-7z" />
      <path d="M12 10v7.5a2 2 0 0 0 4 0" />
      <path d="M3 21h18" />
    </svg>
  );
}

/** Viewpoint / landmark — binoculars for overlooks and must-see spots. */
export function LandmarkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="7" cy="16" r="3.2" />
      <circle cx="17" cy="16" r="3.2" />
      <path d="M10.2 16h3.6" />
      <path d="M5 13 8 5h3l-1.5 6M19 13 16 5h-3l1.5 6" />
    </svg>
  );
}

/** Shopping — tote bag. */
export function ShoppingIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 8h14l-1 12a2 2 0 0 1-2 1.8H8A2 2 0 0 1 6 20L5 8z" />
      <path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" />
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
  drink: CocktailIcon,
  do: LandmarkIcon,
  other: LandmarkIcon,
} as const;

/**
 * Keyword refinement: a stop's own name/note picks a more specific icon than
 * its broad category. Airport runs get a plane, ferry legs a boat, bars a
 * coupe — so the icon tells the reader what the stop actually is at a glance.
 * Word-boundary matching; first rule in list order wins within a category.
 */
const REFINEMENTS: ReadonlyArray<{
  categories: ReadonlyArray<keyof typeof ICONS>;
  pattern: RegExp;
  icon: (props: IconProps) => JSX.Element;
}> = [
  // Transit modes
  { categories: ["transit", "airfare", "flight"], pattern: /\b(airport|flight|flights|fly|flying|plane|jfk|terminal)\b/i, icon: PlaneIcon },
  { categories: ["transit"], pattern: /\b(train|rail|railway|eurostar|trenitalia|italo|sncf|amtrak)\b/i, icon: TrainIcon },
  { categories: ["transit"], pattern: /\b(ferry|ferries|boat|boats|boating|vaporetto|gondola|cruise|sail|sailing|water taxi|waterbus)\b/i, icon: BoatIcon },
  { categories: ["transit"], pattern: /\b(metro|subway|underground|tube|tram)\b/i, icon: TramIcon },
  { categories: ["transit"], pattern: /\b(bus|coach|shuttle)\b/i, icon: BusIcon },
  { categories: ["transit"], pattern: /\bwalk(ing)?\s+(to|from|through|around)\b/i, icon: WalkingIcon },
  // Dining vs drinks
  { categories: ["restaurant", "food", "eat", "drink"], pattern: /\b(bar|cocktail|cocktails|aperitivo|aperitif|wine bar|pub|spritz|nightcap|drinks)\b/i, icon: CocktailIcon },
  { categories: ["restaurant", "food", "eat"], pattern: /\b(caf[eé]|coffee|espresso|pasticceria|bakery|gelato|gelateria)\b/i, icon: FoodIcon },
  // Culture vs beach vs views vs shopping
  { categories: ["culture", "see", "do", "other", "walk", "walking"], pattern: /\b(beach|shore|swim|swimming|lido|pool|sunbathe)\b/i, icon: BeachIcon },
  { categories: ["culture", "see", "do", "other"], pattern: /\b(viewpoint|overlook|belvedere|panorama|lookout|sunset spot)\b/i, icon: LandmarkIcon },
  { categories: ["culture", "see", "do", "other"], pattern: /\b(shop|shopping|market|souvenir|boutique|mercato)\b/i, icon: ShoppingIcon },
  { categories: ["culture", "see"], pattern: /\b(church|cathedral|duomo|basilica|chapel|mosque|synagogue|temple)\b/i, icon: CultureIcon },
];

/**
 * Resolve the most specific icon for a stop. `text` should be the stop's
 * name plus any short note; when it says nothing recognizable the broad
 * category icon stands.
 */
export function resolveCategoryIcon(
  category?: string,
  text?: string,
): ((props: IconProps) => JSX.Element) | null {
  if (!category) return null;
  const broad = ICONS[category as keyof typeof ICONS];
  if (!broad) return null;
  if (text) {
    for (const rule of REFINEMENTS) {
      if ((rule.categories as readonly string[]).includes(category) && rule.pattern.test(text)) {
        return rule.icon;
      }
    }
  }
  return broad;
}

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