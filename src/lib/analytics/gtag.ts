/**
 * Google Analytics 4 (gtag.js) destination.
 *
 * Two jobs:
 *
 *   1. Page views. `gtagHeadScripts()` is spread into the root route's
 *      `head.scripts` — the framework's "first thing in <head>", and the ONLY
 *      place a Google tag is emitted. Automatic page views are off (this is a
 *      single-page app); `initAnalytics(router)` sends one scrubbed `page_view`
 *      per resolved navigation, including the first.
 *
 *   2. Product events. GA is a *mirror* of the PostHog vocabulary: every
 *      `capture()` in src/lib/analytics.ts fans out to `gtagEvent`, so there is
 *      one list of event names. PostHog has `capture_pageview: false`, so GA is
 *      the only page-view sender and nothing is double-counted.
 *
 * Privacy: `/t/<slug>` is a capability URL — possessing the slug is enough to
 * read the dossier — so every path and referrer goes through ./scrub before it
 * reaches Google. Everything here no-ops when the tag is absent or blocked;
 * analytics must never surface to the user.
 */

import { scrubPath, scrubUrl } from "./scrub";

/** GA4 data stream "TravelDoss Home". Publishable by design — it ships in the page. */
const DEFAULT_GA_MEASUREMENT_ID = "G-L84257MD4T";

/**
 * Per-environment override. Only a well-formed GA4 measurement id is accepted:
 * a connector API key or an empty string would otherwise load gtag.js with a
 * garbage id and report nothing, silently.
 */
function resolveMeasurementId(): string {
  const override = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
  return override && /^G-[A-Z0-9]{6,}$/.test(override) ? override : DEFAULT_GA_MEASUREMENT_ID;
}

export const GA_MEASUREMENT_ID: string = resolveMeasurementId();

/**
 * Master switch. Enabled only because Privacy Policy **v1.1** discloses it: §5
 * "Cookies and Analytics" names Google Analytics, the `_ga` cookie, what is
 * collected, what is withheld, and how to opt out
 * (src/content/legal/privacy-v1.1.md). If the policy ever regresses to text that
 * does not describe analytics, this goes back to `false` in the same commit.
 */
// Annotated as `boolean` (not the `true` literal) so flipping it does not
// require touching every consumer's narrowing.
export const ANALYTICS_ENABLED: boolean = true;

/**
 * Hosts that must never report into the production property.
 *
 * Lovable serves previews from `id-preview--<uuid>.lovable.app`, and
 * `traveldoss.lovable.app` 302s to traveldoss.com (see src/lib/site.ts). Neither
 * should inflate production sessions. Kept as data, not a hand-written
 * predicate, because the same rules are inlined into the bootstrap snippet
 * below and the two must not drift apart.
 */
const NON_MEASURABLE_EXACT = ["localhost", "127.0.0.1"];
const NON_MEASURABLE_PREFIXES = ["id-preview"];
const NON_MEASURABLE_SUFFIXES = [".lovable.app"];

export function isMeasurableHost(hostname: string): boolean {
  if (NON_MEASURABLE_EXACT.includes(hostname)) return false;
  if (NON_MEASURABLE_PREFIXES.some((p) => hostname.startsWith(p))) return false;
  if (NON_MEASURABLE_SUFFIXES.some((s) => hostname.endsWith(s))) return false;
  return true;
}

type Props = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    /** Set by the bootstrap snippet so re-execution is a no-op. */
    __tdGtagBooted?: boolean;
  }
}

/**
 * The inline half of Google's snippet, with three deliberate changes.
 *
 * `send_page_view: false` is the important one. Left at its default, `config`
 * immediately sends a page_view built from `document.location` — raw, before any
 * of our code runs. A visitor landing directly on a share link would hand Google
 * the dossier slug, and no amount of scrubbing on later navigations would undo
 * it. Turning it off means every page_view, including the first, is one we
 * construct and scrub.
 *
 * The host check is the second: gtag.js still loads on preview builds (it is
 * async and cached), but without a `config` call it sets no cookie and sends no
 * hit — and events pushed to the dataLayer go nowhere.
 *
 * The `__tdGtagBooted` guard is the third. TanStack Router removes and
 * re-appends route-managed inline head scripts on client-side navigation
 * (`Script` in @tanstack/react-router's Asset.js), which re-executes them.
 * Without the guard every navigation would push a second `js` + `config` onto
 * the dataLayer. The external gtag.js tag is deduplicated by `src` by the same
 * router code, so there is never a second Google tag.
 */
export function bootstrapSnippet(): string {
  const exact = JSON.stringify(NON_MEASURABLE_EXACT);
  const prefixes = JSON.stringify(NON_MEASURABLE_PREFIXES);
  const suffixes = JSON.stringify(NON_MEASURABLE_SUFFIXES);

  return [
    "if(!window.__tdGtagBooted){",
    "window.__tdGtagBooted=true;",
    "window.dataLayer=window.dataLayer||[];",
    "window.gtag=function(){window.dataLayer.push(arguments);};",
    "window.gtag('js',new Date());",
    "var h=location.hostname;",
    `var skip=${exact}.indexOf(h)!==-1`,
    `||${prefixes}.some(function(p){return h.indexOf(p)===0;})`,
    `||${suffixes}.some(function(s){return h.slice(-s.length)===s;});`,
    `if(!skip){window.gtag('config',${JSON.stringify(GA_MEASUREMENT_ID)},{send_page_view:false});}`,
    "}",
  ].join("");
}

/**
 * The two head entries that install gtag.js. Rendered by the root route only.
 *
 * Empty when analytics is off or the build is not a production build, so
 * nothing about GA reaches the dev server or a disabled deployment.
 */
export function gtagHeadScripts(): Array<{
  src?: string;
  async?: boolean;
  children?: string;
}> {
  if (!ANALYTICS_ENABLED || !import.meta.env.PROD) return [];

  return [
    {
      src: `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`,
      async: true,
    },
    { children: bootstrapSnippet() },
  ];
}

function gtag(): ((...args: unknown[]) => void) | null {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return null;
  return typeof window.gtag === "function" ? window.gtag : null;
}

/**
 * Last path handed to GA, so the initial page_view is not double-counted when
 * the router also emits `onResolved` for the entry route.
 */
let lastTrackedPath: string | null = null;

/** Test seam: reset the dedupe guard between cases. */
export function resetPageviewDedupe(): void {
  lastTrackedPath = null;
}

/**
 * Send one `page_view`.
 *
 * `page_location` matters as much as `page_path`: GA4 treats the full URL as
 * canonical and falls back to `document.location` for it. Setting only
 * `page_path` would leave the unscrubbed slug in the hit.
 */
export function trackPageview(path: string, referrer?: string): void {
  const g = gtag();
  if (!g) return;

  const safePath = scrubPath(path);
  if (safePath === lastTrackedPath) return;
  lastTrackedPath = safePath;

  try {
    g("event", "page_view", {
      page_path: safePath,
      page_location: `${window.location.origin}${safePath}`,
      page_title: document.title,
      ...(referrer ? { page_referrer: scrubUrl(referrer) } : {}),
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

/** The slice of the TanStack router this module needs. Keeps the import light. */
interface AnalyticsRouter {
  subscribe: (
    eventType: "onResolved",
    fn: (event: {
      toLocation: { pathname: string };
      fromLocation?: { pathname: string };
      pathChanged: boolean;
    }) => void,
  ) => () => void;
}

/**
 * Start reporting page views. Returns an unsubscribe function.
 *
 * Called explicitly from src/router.tsx rather than run as module side effects:
 * package.json declares `"sideEffects": false`, so Rollup drops any import whose
 * exports are never referenced. A bare `import "./gtag"` would be deleted from
 * the client bundle with no build error.
 */
export function initAnalytics(router: AnalyticsRouter): () => void {
  const noop = () => {};

  if (!ANALYTICS_ENABLED || typeof window === "undefined") return noop;
  if (!isMeasurableHost(window.location.hostname)) return noop;

  // The entry page view. gtag.js is async, so window.gtag may not exist yet;
  // the bootstrap snippet defines it synchronously, but a blocked or failed
  // request would leave it undefined, so retry once on load rather than
  // silently losing the landing hit.
  const sendInitial = () => trackPageview(window.location.pathname, document.referrer);
  if (typeof window.gtag === "function") {
    sendInitial();
  } else {
    window.addEventListener("load", sendInitial, { once: true });
  }

  return router.subscribe("onResolved", (event) => {
    if (!event.pathChanged) return;
    trackPageview(event.toLocation.pathname, event.fromLocation?.pathname);
  });
}
