import type { GuideDef } from "./types";
import { albania } from "./albania";
import { crete } from "./crete";
import { unchartedIndonesia } from "./uncharted-indonesia";
import { okinawa } from "./okinawa";
import { savannah } from "./savannah";
import { japanGoldenRoute } from "./japan-golden-route";
import { amalfiCoast } from "./amalfi-coast";
import { lisbon } from "./lisbon";
import { mexicoCity } from "./mexico-city";
import { paris } from "./paris";

/**
 * The Insider Guides cast. Order is editorial (guide number order) and drives
 * both the globe pins and the SEO card grid. Mirrors the skin-registry
 * pattern: one array plus a bySlug lookup.
 */
export const GUIDES: GuideDef[] = [
  albania,
  crete,
  unchartedIndonesia,
  okinawa,
  savannah,
  japanGoldenRoute,
  amalfiCoast,
  lisbon,
  mexicoCity,
  paris,
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
