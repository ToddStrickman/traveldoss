import type { GuideDef } from "./types";
import { albania } from "./albania";
import { savannah } from "./savannah";

/** Registry stub: listed on the index and reachable, content pending. */
function stub(
  d: Pick<GuideDef, "slug" | "destination" | "dek" | "days" | "season" | "no" | "chips" | "skinId" | "accent" | "lat" | "lon"> & {
    title?: string;
  },
): GuideDef {
  const title = d.title ?? `${d.destination}: The Insider Guide`;
  return {
    ...d,
    title,
    seoTitle: `${d.destination} Itinerary — ${d.days}: The Insider Guide | TravelDoss`,
    metaDescription: `${d.destination} — the insider itinerary. ${d.dek}`.slice(0, 155),
    blocks: [],
    faq: [],
    sources: "",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
    published: false,
  };
}

/**
 * The Insider Guides cast. Order is editorial (guide number order) and drives
 * both the globe pins and the SEO card grid. Mirrors the skin-registry
 * pattern: one array plus a bySlug lookup.
 */
export const GUIDES: GuideDef[] = [
  albania,
  stub({
    slug: "crete",
    destination: "Crete",
    dek: "Greece's great food island — and the wild west is its kitchen.",
    days: "6 days",
    season: "April–June · September–October",
    no: "№ 02",
    chips: ["6 days", "Food-first", "Open-jaw"],
    skinId: "marcello",
    accent: "#FF9A62",
    lat: 35.3,
    lon: 24.5,
  }),
  stub({
    slug: "uncharted-indonesia",
    destination: "Uncharted Indonesia",
    dek: "East of Bali: the wild-luxury arc. Sumba, Komodo, and a wooden yacht.",
    days: "9 days",
    season: "April–November",
    no: "№ 03",
    chips: ["9 days", "Sumba · Komodo", "Apr–Nov"],
    skinId: "shishu",
    accent: "#EFC96A",
    lat: -9.4,
    lon: 119.6,
  }),
  stub({
    slug: "okinawa",
    destination: "Okinawa",
    dek: "Champuru — the mixed-up island. Japan at island speed.",
    days: "6 days",
    season: "April–June · October–November",
    no: "№ 04",
    chips: ["6 days", "3 registers", "Apr–Jun · Oct–Nov"],
    skinId: "shishu",
    accent: "#63E6DA",
    lat: 26.5,
    lon: 127.9,
  }),
  savannah,
  stub({
    slug: "japan-golden-route",
    destination: "Japan",
    title: "Japan's Golden Route: The Insider Guide",
    dek: "Tokyo, Kyoto, and the two detours that make the classic route yours.",
    days: "10 days",
    season: "Late March–April · November",
    no: "№ 06",
    chips: ["10 days", "Rail-first", "Cherry · Momiji"],
    skinId: "shishu",
    accent: "#A9C2FF",
    lat: 35.0,
    lon: 135.77,
  }),
  stub({
    slug: "amalfi-coast",
    destination: "Amalfi Coast",
    dek: "The postcard coast, timed to miss the crowd it created.",
    days: "6 days",
    season: "May–June · late September",
    no: "№ 07",
    chips: ["6 days", "Boat-first", "May–Jun · Sept"],
    skinId: "marcello",
    accent: "#FFB877",
    lat: 40.63,
    lon: 14.6,
  }),
  stub({
    slug: "lisbon",
    destination: "Lisbon",
    dek: "A long weekend that behaves like a week — hills, tiles, and dinner at ten.",
    days: "4 days",
    season: "March–June · September–October",
    no: "№ 08",
    chips: ["4 days", "Walkable", "Shoulder season"],
    skinId: "calliope",
    accent: "#7FE0C8",
    lat: 38.72,
    lon: -9.14,
  }),
  stub({
    slug: "mexico-city",
    destination: "Mexico City",
    dek: "The best eating city in North America, arranged by neighborhood.",
    days: "5 days",
    season: "November–April",
    no: "№ 09",
    chips: ["5 days", "Food-first", "Dry season"],
    skinId: "cassian",
    accent: "#FF8FA3",
    lat: 19.43,
    lon: -99.13,
  }),
  stub({
    slug: "paris",
    destination: "Paris",
    dek: "The fourth visit itinerary — for people who already did the first three.",
    days: "5 days",
    season: "April–June · September–October",
    no: "№ 10",
    chips: ["5 days", "Arrondissement-first", "Spring · Fall"],
    skinId: "vesper",
    accent: "#C9B6FF",
    lat: 48.86,
    lon: 2.35,
  }),
];

export const GUIDES_BY_SLUG: Record<string, GuideDef> = Object.fromEntries(
  GUIDES.map((g) => [g.slug, g]),
);

export const getGuide = (slug: string): GuideDef | undefined => GUIDES_BY_SLUG[slug];

/** Guides with converted content — the only ones that get indexed. */
export const PUBLISHED_GUIDES: GuideDef[] = GUIDES.filter((g) => g.published);

/** Up to `n` sibling guides for the "More Insider Guides" rail. Published
 *  only — a sibling card must never lead to an empty dossier. */
export function siblingGuides(slug: string, n = 3): GuideDef[] {
  return PUBLISHED_GUIDES.filter((g) => g.slug !== slug).slice(0, n);
}

export type { GuideDef, GuideFaq } from "./types";
