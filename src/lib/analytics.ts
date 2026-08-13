/**
 * Client analytics. Every capture call in the app goes through this module:
 * inline posthog.* calls elsewhere are forbidden so the event vocabulary stays
 * auditable in one file. No-ops gracefully when the env keys are absent, so
 * previews and tests never need a PostHog project.
 */
import type { PostHog } from "posthog-js";

type Props = Record<string, string | number | boolean | null | undefined>;

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;

function key(): string | undefined {
  const k = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  return k && k.length > 0 ? k : undefined;
}

function host(): string {
  return (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";
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
 * failures must not be user-visible.
 */
export function capture(event: string, props: Props = {}): void {
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
