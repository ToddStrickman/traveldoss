/**
 * Live Map marker taxonomy.
 *
 * The block model carries six canonical categories plus legacy aliases
 * (see the `category` union in `src/lib/skins/types.ts`). The map needs a
 * smaller, stable set of marker kinds with a colour family and an icon
 * each. Everything maps somewhere: an unknown or missing category lands on
 * `other`, never on a blank pin.
 *
 * Adding a category (coffee, bar, shopping…) is a Phase 3 change that has
 * to touch the editors and the three AI schemas together; this module is
 * where the map side of that will live.
 */
import type { ComponentType, SVGProps } from "react";
import {
  AirfareIcon,
  CultureIcon,
  CurrencyIcon,
  EventIcon,
  HikeIcon,
  HotelIcon,
  RestaurantIcon,
  TransitIcon,
} from "@/lib/skins/shared/CategoryIcon";
import { ensureContrast, isDark, mix } from "./color";

export type MarkerKind =
  | "stay"
  | "dine"
  | "drink"
  | "culture"
  | "walk"
  | "event"
  | "transit"
  | "other";

const KIND_BY_CATEGORY: Record<string, MarkerKind> = {
  // Canonical six
  accommodation: "stay",
  restaurant: "dine",
  walk: "walk",
  event: "event",
  culture: "culture",
  transit: "transit",
  // Legacy aliases
  stay: "stay",
  hotel: "stay",
  eat: "dine",
  food: "dine",
  drink: "drink",
  see: "culture",
  do: "walk",
  walking: "walk",
  airfare: "transit",
  flight: "transit",
  currency: "other",
  other: "other",
};

export function markerKindFor(category?: string | null): MarkerKind {
  if (!category) return "other";
  return KIND_BY_CATEGORY[category.trim().toLowerCase()] ?? "other";
}

/** Accessible-name prefix per kind ("Restaurant: Belcanto"). */
export const MARKER_LABEL: Record<MarkerKind, string> = {
  stay: "Stay",
  dine: "Restaurant",
  drink: "Bar",
  culture: "Museum or cultural site",
  walk: "Walk or outdoor activity",
  event: "Event",
  transit: "Transit",
  other: "Saved place",
};

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const ICON_BY_KIND: Partial<Record<MarkerKind, IconComponent>> = {
  stay: HotelIcon,
  dine: RestaurantIcon,
  culture: CultureIcon,
  walk: HikeIcon,
  event: EventIcon,
  transit: TransitIcon,
};

/**
 * Icon for a marker. A few legacy categories keep their more specific
 * glyph (a plane for `airfare`, a coin for `currency`) because the shared
 * views already render them that way. `null` means "draw the plain pin".
 */
export function markerIconFor(kind: MarkerKind, category?: string | null): IconComponent | null {
  const raw = category?.trim().toLowerCase();
  if (raw === "airfare" || raw === "flight") return AirfareIcon;
  if (raw === "currency") return CurrencyIcon;
  return ICON_BY_KIND[kind] ?? null;
}

/** Hue families: [on paper skins, on night skins]. */
const FAMILY: Record<Exclude<MarkerKind, "stay" | "transit" | "other">, [string, string]> = {
  dine: ["#9A4A2E", "#D98B6A"],
  drink: ["#A85A38", "#E09A78"],
  culture: ["#2C4A7A", "#7FA3D9"],
  walk: ["#3E6B4C", "#86BC9E"],
  event: ["#5E4A8A", "#A98FD6"],
};

export type PinTokens = { bg: string; ink: string; inkSoft: string; accent: string };

/**
 * Pin fills for one skin. Every fill is nudged 12% toward the skin's ink so
 * the set reads as one family, then pushed further toward ink until the
 * paper-coloured glyph clears WCAG AA (4.5:1) on it. Deterministic, so the
 * contrast test can assert it for all eleven skins.
 */
export function pinPalette(tokens: PinTokens): Record<MarkerKind, string> {
  const dark = isDark(tokens.bg);
  const settle = (base: string) => ensureContrast(mix(base, tokens.ink, 0.12), tokens.bg, tokens.ink, 4.5);
  const neutral = settle(mix(tokens.inkSoft, tokens.ink, 0.35));
  return {
    stay: settle(tokens.accent),
    dine: settle(FAMILY.dine[dark ? 1 : 0]),
    drink: settle(FAMILY.drink[dark ? 1 : 0]),
    culture: settle(FAMILY.culture[dark ? 1 : 0]),
    walk: settle(FAMILY.walk[dark ? 1 : 0]),
    event: settle(FAMILY.event[dark ? 1 : 0]),
    transit: neutral,
    other: neutral,
  };
}
