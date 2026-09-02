/**
 * Google Analytics 4 (gtag.js) destination.
 *
 * GA is a *mirror* of the existing PostHog vocabulary: every capture() in
 * src/lib/analytics.ts fans out here, so there is no second list of event
 * names to keep in sync. Automatic page views are disabled — this is a single
 * page app, so the router sends one scrubbed page_view per navigation.
 *
 * Everything here no-ops when the tag is absent or blocked; analytics must
 * never surface to the user.
 */
import { scrubPath } from "./scrub";

/** GA4 measurement id. Publishable by design; overridable per environment. */
export const GA_MEASUREMENT_ID: string =
  (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) ||
  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY as string | undefined) ||
  "G-L84257MD4T";

type Props = Record<string, string | number | boolean | null | undefined>;

type Gtag = (...args: unknown[]) => void;

interface GtagWindow extends Window {
  dataLayer?: unknown[];
  gtag?: Gtag;
}

/** The two head entries that install gtag.js. Rendered by the root route only. */
export function gtagHeadScripts(): Array<Record<string, string>> {
  if (!GA_MEASUREMENT_ID) return [];
  return [
    { async: "true", src: `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}` },
    {
      children: [
        "window.dataLayer=window.dataLayer||[];",
        "function gtag(){dataLayer.push(arguments);}",
        "window.gtag=gtag;",
        "gtag('js', new Date());",
        `gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });`,
      ].join(""),
    },
  ];
}

function gtag(): Gtag | null {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return null;
  const w = window as GtagWindow;
  if (typeof w.gtag === "function") return w.gtag;
  // The loader script may not have executed yet (or was blocked): queueing on
  // dataLayer still works once/if it does.
  if (Array.isArray(w.dataLayer)) {
    return (...args: unknown[]) => {
      w.dataLayer!.push(args);
    };
  }
  return null;
}

/** Sends one page_view with a scrubbed path. */
export function gtagPageView(pathname: string): void {
  try {
    const g = gtag();
    if (!g) return;
    const path = scrubPath(pathname);
    g("event", "page_view", {
      page_path: path,
      page_location:
        typeof window !== "undefined" ? `${window.location.origin}${path}` : undefined,
      page_title: typeof document !== "undefined" ? document.title : undefined,
    });
  } catch {
    /* analytics must never surface to the user */
  }
}

/** Mirrors a product event to GA. Same snake_case name and props as PostHog. */
export function gtagEvent(event: string, props: Props = {}): void {
  try {
    gtag()?.("event", event, props);
  } catch {
    /* analytics must never surface to the user */
  }
}
