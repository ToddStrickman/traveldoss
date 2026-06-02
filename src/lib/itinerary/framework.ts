/**
 * Destination-agnostic itinerary framework. Neutral by default; the engine
 * (adapt.ts) layers a destination + brief on top, emitting the app's Block[]
 * shape (kind-based, flat day + place). No AI required.
 */
export const DESTINATION_TYPES = [
  "city", "beach", "island", "mountain", "countryside",
  "road-trip", "cruise", "cultural", "adventure", "mixed",
] as const;
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export const TRAVELERS = ["solo", "couple", "family", "group", "business", "luxury", "nomad"] as const;
export const BUDGETS = ["shoestring", "moderate", "comfortable", "luxury"] as const;
export const PACES = ["relaxed", "balanced", "fast"] as const;
export const MOBILITY = ["full", "limited", "step-free"] as const;
export const INTERESTS = [
  "food", "history", "art", "nature", "nightlife", "shopping",
  "relaxation", "adventure", "architecture", "local life", "wellness", "photography",
] as const;

export type DestinationType = (typeof DESTINATION_TYPES)[number];
export type Season = (typeof SEASONS)[number];
export type Pace = (typeof PACES)[number];
export type BudgetLevel = (typeof BUDGETS)[number];

export type TripBrief = {
  destination?: string;
  destinationType: DestinationType;
  durationDays: number;
  season: Season;
  travelers: (typeof TRAVELERS)[number];
  budget: BudgetLevel;
  interests: (typeof INTERESTS)[number][];
  mobility: (typeof MOBILITY)[number];
  pace: Pace;
  currency: string;
};

export const DEFAULT_BRIEF: TripBrief = {
  destination: "",
  destinationType: "mixed",
  durationDays: 4,
  season: "summer",
  travelers: "couple",
  budget: "moderate",
  interests: [],
  mobility: "full",
  pace: "balanced",
  currency: "EUR",
};

export const SLOTS_PER_PACE: Record<Pace, number> = { relaxed: 2, balanced: 3, fast: 4 };
export const BUDGET_DAILY_BAND: Record<BudgetLevel, [number, number]> = {
  shoestring: [40, 90], moderate: [90, 200], comfortable: [200, 400], luxury: [400, 1000],
};
export const BUDGET_SPLIT: Record<string, number> = {
  Stay: 0.4, Food: 0.3, Activities: 0.2, "Local transport": 0.1,
};

const PACK_BASE = ["Layers you can mix", "Comfortable walking shoes", "Chargers + travel adapter", "Copies of key bookings"];
const PACK_SEASON: Record<Season, string[]> = {
  spring: ["A light rain layer", "A warmer evening layer"],
  summer: ["Sun protection", "A refillable water bottle"],
  autumn: ["A warm mid-layer", "Water-resistant shoes"],
  winter: ["A proper warm coat", "Gloves + a hat"],
};
const PACK_TYPE: Partial<Record<DestinationType, string[]>> = {
  beach: ["Swimwear + a cover-up", "Reef-safe sunscreen"],
  island: ["Swimwear", "Quick-dry clothing"],
  mountain: ["Insulating layers", "Broken-in hiking shoes"],
  adventure: ["Daypack", "First-aid basics"],
  "road-trip": ["Snacks + playlists", "A phone car mount"],
  cruise: ["One smart-casual outfit", "Motion-sickness remedy"],
  city: ["A daybag that locks", "Shoes you can walk miles in"],
  countryside: ["Sturdy footwear", "Insect repellent"],
};
export function packingList(season: Season, type: DestinationType): string[] {
  return [...PACK_BASE, ...(PACK_SEASON[season] ?? []), ...(PACK_TYPE[type] ?? [])];
}

export interface FrameworkSection { key: string; title: string; }
export const FRAMEWORK_SECTIONS: FrameworkSection[] = [
  { key: "getting-around", title: "Getting around" },
  { key: "where-to-stay", title: "Where to stay" },
  { key: "eat-and-drink", title: "Eat & drink" },
  { key: "budget", title: "Budget" },
  { key: "packing", title: "What to pack" },
  { key: "customs-safety", title: "Customs & safety" },
  { key: "book-ahead", title: "Book ahead" },
];
