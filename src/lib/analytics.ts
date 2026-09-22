/**
 * Client analytics. Every capture call in the app goes through this module:
 * inline posthog.* calls elsewhere are forbidden so the event vocabulary stays
 * auditable in one file. No-ops gracefully when the env keys are absent, so
 * previews and tests never need a PostHog project.
 */
import type { PostHog } from "posthog-js";
import { gtagEvent } from "./analytics/gtag";
import { recordFirstParty } from "./analytics/first-party";
import { scrubPath, scrubUrl } from "./analytics/scrub";

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
        // Private reservation and email evidence must never enter session replay.
        disable_session_recording: true,
        before_send: (event) => {
          if (!event) return event;
          for (const field of ["$current_url", "$referrer"]) {
            if (typeof event.properties[field] === "string")
              event.properties[field] = scrubUrl(event.properties[field]);
          }
          if (typeof event.properties.$pathname === "string")
            event.properties.$pathname = scrubPath(event.properties.$pathname);
          return event;
        },
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

// ── Live Map ─────────────────────────────────────────────────────────────
// Counts and kinds only: never a place name, a coordinate, or a slug.

export const trackMapOpened = (p: {
  entry: string;
  surface: "mobile" | "desktop";
  located_count: number;
  unlocated_count: number;
  day_count: number;
  focused_day: boolean;
  renderer: "maplibre" | "parchment";
}) => capture("map_opened", p);

export const trackMapClosed = (p: { duration_ms: number; pins_selected: number }) =>
  capture("map_closed", p);

export const trackMapPinSelected = (p: {
  kind: string;
  via: "click" | "keyboard";
  has_image: boolean;
  has_reservation: boolean;
}) => capture("map_pin_selected", p);

export const trackMapDayToggled = (on: boolean, dayCountVisible: number) =>
  capture("map_day_toggled", { on, day_count_visible: dayCountVisible });

export const trackMapRouteToggled = (on: boolean) => capture("map_route_toggled", { on });

export const trackMapPlanBToggled = (on: boolean) => capture("map_planb_toggled", { on });

export const trackMapTilesFailed = (source: string) => capture("map_tiles_failed", { source });

export const trackMapLocateRequested = (p: {
  auto: boolean;
  requested: number;
  located: number;
  unresolved: number;
  configured: boolean;
}) => capture("map_locate_requested", p);

/* ---------------- Stop location editor (see docs/analytics/tracking-plan.md)
 *
 * The escape hatch for a stop no provider can find. Counts and outcomes only:
 * never an address, a place name or a coordinate. */

export const trackStopLocationLookupRequested = (p: {
  outcome: "found" | "not_found" | "unavailable";
  had_address: boolean;
  surface: "edit_sheet" | "map";
}) => capture("stop_location_lookup_requested", p);

export const trackStopLocationEdited = (p: {
  field: "coords" | "map_hidden";
  /** How the owner set it: typed the numbers, dragged the pin, or cleared it. */
  via: "typed" | "drag" | "cleared";
}) => capture("stop_location_edited", p);

/* ---------------- Hotels quick reference
 *
 * First use of the accommodation dashboard. A count only — never a hotel
 * name, address or booking reference. */

export const trackHotelsQuickRefOpened = (p: { hotel_count: number }) =>
  capture("hotels_quickref_opened", p);

/* ---------------- Calendar quick reference
 *
 * First use of the calendar panel and each date jump. Counts only — never a
 * date, stop name or any trip content. */

export const trackCalendarQuickRefOpened = (p: { day_count: number; has_flights: boolean }) =>
  capture("calendar_quickref_opened", p);

export const trackCalendarDayJumped = () => capture("calendar_day_jumped", {});

/** Sharing decision in the private workspace. No reservation content, counts only. */
export const trackDossierShareChosen = (p: { mode: "once" | "always" | "off" }) =>
  capture("dossier_share_chosen", p);

export const trackDossierShareApplied = (p: { added: number; updated: number }) =>
  capture("dossier_share_applied", p);

export const trackDossierShareUndone = () => capture("dossier_share_undone", {});

/**
 * Shared editing (Directive 08). Counts and enum values only — never an
 * address, a name, or any block content.
 */
export const trackInviteSent = (p: { source: "creator" | "member" | "named_traveler"; count: number }) =>
  capture("invite_sent", p);

export const trackInviteRevoked = () => capture("invite_revoked", {});

export const trackInviteAccepted = (p: { source: "creator" | "member" | "named_traveler"; days_to_accept: number }) =>
  capture("invite_accepted", p);

export const trackMemberRemoved = () => capture("member_removed", {});

export const trackTeamPanelOpened = () => capture("team_panel_opened", {});

export const trackHistoryPanelOpened = (p: { change_count: number }) =>
  capture("history_panel_opened", p);

export const trackChangeRestored = (p: { mode: "single" | "point_in_time" }) =>
  capture("change_restored", p);

/* ---------------- View-native logistics (Directive 09, Amendment 1)
 * Enum only: never a carrier, property, route, date, or booking reference. */
export const trackLaneItemExpanded = (kind: "flight" | "stay") =>
  capture("lane_item_expanded", { kind });
