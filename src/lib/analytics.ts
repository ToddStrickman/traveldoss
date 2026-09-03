/**
 * Client analytics. Every capture call in the app goes through this module:
 * inline posthog.* calls elsewhere are forbidden so the event vocabulary stays
 * auditable in one file. No-ops gracefully when the env keys are absent, so
 * previews and tests never need a PostHog project.
 */
import type { PostHog } from "posthog-js";
import { gtagEvent } from "./analytics/gtag";
import { recordFirstParty } from "./analytics/first-party";

type Props = Record<string, string | number | boolean | null | undefined>;

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;

function key(): string | undefined {
  // The PostHog connector supplies VITE_LOVABLE_CONNECTOR_POSTHOG_*; the plain
  // VITE_POSTHOG_* vars stay supported as a manual override.
  const k =
    (import.meta.env.VITE_POSTHOG_KEY as string | undefined) ||
    (import.meta.env.VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY as string | undefined);
  return k && k.length > 0 ? k : undefined;
}

function host(): string {
  const explicit = import.meta.env.VITE_POSTHOG_HOST as string | undefined;
  if (explicit && explicit.length > 0) return explicit;
  const region = import.meta.env.VITE_LOVABLE_CONNECTOR_POSTHOG_REGION as string | undefined;
  return region === "eu" ? "https://eu.i.posthog.com" : "https://us.i.posthog.com";
}

/** Lazily boots posthog-js in the browser. Returns null when unconfigured. */
async function ensureClient(): Promise<PostHog | null> {
  if (typeof window === "undefined") return null;
  const apiKey = key();
  if (!apiKey) return null;
  if (client) return client;
  if (!loading) {
    loading = import("posthog-js").then(({ default: posthog }) => {
      posthog.init(apiKey, {
        api_host: host(),
        capture_pageview: false,
        person_profiles: "identified_only",
        autocapture: false,
      });
      client = posthog;
      return client;
    });
  }
  return loading;
}

/**
 * Fire-and-forget capture. Never throws and never blocks the UI — analytics
 * failures must not be user-visible. Fans out to GA4 as a mirror destination
 * and to the first-party store that backs the admin console, so there is only
 * one event vocabulary in the app.
 */
export function capture(event: string, props: Props = {}): void {
  gtagEvent(event, props);
  recordFirstParty(event, props);
  void ensureClient()
    .then((ph) => {
      ph?.capture(event, props);
    })
    .catch(() => {
      /* analytics must never surface to the user */
    });
}

/* ---------------- Insider Guides events (see docs/analytics/tracking-plan.md) */

export const trackGuideView = (slug: string, published: boolean) =>
  capture("guide_view", { slug, published });

export const trackGuideCardOpen = (slug: string, via: "pin" | "rotate" | "grid") =>
  capture("guide_card_open", { slug, via });

export const trackGuideClone = (
  slug: string,
  outcome: "started" | "completed" | "login_required" | "failed",
) => capture("guide_clone", { slug, outcome });

export const trackGuideFaqOpen = (slug: string, q: string) =>
  capture("guide_faq_open", { slug, q });

export const trackGuideCta = (slug: string, cta: "make_this_yours" | "start_from_scratch") =>
  capture("guide_cta_clicked", { slug, cta });

/* ---------------- Contact form events (see docs/analytics/tracking-plan.md) */

export const trackContactSubmitted = (category: string, messageLength: number) =>
  capture("contact_message_submitted", { category, message_length: messageLength });

export const trackContactFailed = (category: string, reason: string) =>
  capture("contact_message_failed", { category, reason });

/* ---------------- Access audit trail events (see docs/analytics/tracking-plan.md) */

export const trackAccessTrailOpened = (tripSlug: string, eventCount: number) =>
  capture("access_trail_opened", { trip_slug: tripSlug, event_count: eventCount });

/* ---------------- Compose flow events (see docs/analytics/tracking-plan.md) */

export const trackComposeOpened = (
  entry: "mobile_bar" | "dock" | "template_card",
  templateId: string | null,
) => capture("compose_opened", { entry, template_id: templateId });

/** Fired when a cover settles in the centre of the stage-1 carousel. */
export const trackTemplatePreviewed = (templateId: string) =>
  capture("template_previewed", { template_id: templateId });

export const trackTemplatePicked = (templateId: string, index: number) =>
  capture("template_picked", { template_id: templateId, index });

export const trackTemplateSwitched = (fromId: string | null, toId: string) =>
  capture("template_switched", { from_template_id: fromId, template_id: toId });

/* ---------------- Mint funnel events (see docs/analytics/tracking-plan.md)
 *
 * Counts and lengths only — never pasted itinerary text, prompts or block
 * content. `mint_completed` is ALSO captured server-side in
 * createTripFromIngestion; the client copy is the adblock-proof denominator. */

export type MintTab = "paste" | "transcript" | "generate";

/* Funnel step 1 is the existing `compose_opened` above — deliberately not
 * duplicated here, so the modal-open moment has exactly one event name. */

export const trackMintInputReady = (
  templateId: string,
  tab: MintTab,
  inputLength: number,
) => capture("mint_input_ready", { template_id: templateId, tab, input_length: inputLength });

export const trackMintSubmitted = (templateId: string, tab: MintTab, inputLength: number) =>
  capture("mint_submitted", { template_id: templateId, tab, input_length: inputLength });

export const trackMintLoginRequired = (templateId: string, tab: MintTab) =>
  capture("mint_login_required", { template_id: templateId, tab });

export const trackMintParseFailed = (templateId: string, tab: MintTab, reason: string) =>
  capture("mint_parse_failed", { template_id: templateId, tab, reason: reason.slice(0, 120) });

/**
 * `trip_id` and never `trip_slug`: the slug is a capability URL (possessing it
 * reads the dossier) and every capture fans out to GA, where path scrubbing
 * exists precisely to keep slugs out of Google.
 */
export const trackMintCompleted = (
  templateId: string,
  tripId: string,
  blockCount: number,
  dayCount: number,
) =>
  capture("mint_completed", {
    template_id: templateId,
    trip_id: tripId,
    block_count: blockCount,
    day_count: dayCount,
  });

export const trackMintFailed = (templateId: string, reason: string) =>
  capture("mint_failed", { template_id: templateId, reason: reason.slice(0, 120) });
