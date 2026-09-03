/**
 * The complete first-party event vocabulary.
 *
 * `recordEvents` is a public endpoint on the published site, so the event name
 * is validated against this list server-side: an unknown name is dropped rather
 * than written. Client-safe on purpose — both the browser queue and the server
 * function import this one array so the two cannot drift.
 *
 * Adding an event means adding it here AND to docs/analytics/tracking-plan.md.
 */
export const FIRST_PARTY_EVENTS = [
  // Navigation (the funnel's "landed" and "browsed templates" steps)
  "page_viewed",

  // Compose / mint funnel
  "compose_opened",
  "template_previewed",
  "template_picked",
  "template_switched",
  "template_browse_mode_changed",
  "mint_input_ready",
  "mint_submitted",
  "mint_login_required",
  "mint_parse_failed",
  "mint_completed",
  "mint_failed",

  // Insider Guides
  "guide_view",
  "guide_card_open",
  "guide_clone",
  "guide_faq_open",
  "guide_cta_clicked",

  // Landing walkthrough
  "flow_step_navigated",

  // Dossier surfaces
  "access_trail_opened",

  // Contact
  "contact_message_submitted",
  "contact_message_failed",
] as const;

export type FirstPartyEvent = (typeof FIRST_PARTY_EVENTS)[number];

const ALLOWED = new Set<string>(FIRST_PARTY_EVENTS);

export function isAllowedEvent(event: string): boolean {
  return ALLOWED.has(event);
}

/**
 * Property keys promoted to their own indexed columns in `product_events`.
 * Everything else lands in the `props` jsonb blob.
 */
export const PROMOTED_PROPS = ["template_id", "trip_id", "path"] as const;
