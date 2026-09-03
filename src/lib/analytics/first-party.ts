/**
 * First-party analytics sink.
 *
 * GA4 owns page views for marketing reporting, but GA's data cannot be read
 * back into the app, and PostHog has no key configured — so the admin console
 * reads from our own database. Every `capture()` in src/lib/analytics.ts also
 * lands here, batched, and is flushed to the `recordEvents` server function.
 *
 * Rules that hold for this file:
 *   - Anonymous. A per-tab random session id (never a user id, never an email)
 *     is the only identifier, so a funnel can be counted without identifying
 *     anyone. User-level truth comes from the tables we already own.
 *   - Counts and lengths only. Props are shallow primitives; the path is
 *     scrubbed by ./scrub so a dossier slug can never be stored.
 *   - Never throws, never blocks, never surfaces to the user.
 */

import { recordEvents } from "@/lib/product-events.functions";
import { scrubPath } from "./scrub";

type Props = Record<string, string | number | boolean | null | undefined>;

interface QueuedEvent {
  event: string;
  occurred_at: string;
  session_id: string;
  path: string | null;
  props: Record<string, string | number | boolean>;
}

const SESSION_KEY = "td_sid_v1";
const FLUSH_DELAY_MS = 2000;
const MAX_BATCH = 20;

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

/** Per-tab anonymous id. sessionStorage, so it is not a durable tracker. */
function sessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.sessionStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    // Private mode / storage disabled: still count the event, unattributed.
    return "no-storage";
  }
}

/** Drops undefined/null and anything that is not a shallow primitive. */
function cleanProps(props: Props): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string") out[k] = v.slice(0, 200);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

function schedule(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushFirstParty();
  }, FLUSH_DELAY_MS);
}

function bindFlushListeners(): void {
  if (listenersBound || typeof document === "undefined") return;
  listenersBound = true;
  // pagehide covers iOS Safari, where visibilitychange alone is unreliable.
  const flush = () => void flushFirstParty();
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

/** Send everything queued. Safe to call at any time. */
export async function flushFirstParty(): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(batch.length);
  try {
    await recordEvents({ data: { events: batch } });
  } catch {
    // A dropped analytics batch must never become a user-visible failure.
  }
  if (queue.length > 0) schedule();
}

/** Queue one event for the first-party store. */
export function recordFirstParty(event: string, props: Props = {}): void {
  if (typeof window === "undefined") return;
  bindFlushListeners();
  const clean = cleanProps(props);
  queue.push({
    event,
    occurred_at: new Date().toISOString(),
    session_id: sessionId(),
    path: scrubPath(window.location.pathname),
    props: clean,
  });
  if (queue.length >= MAX_BATCH) void flushFirstParty();
  else schedule();
}

/** The slice of the TanStack router this module needs. */
interface AnalyticsRouter {
  subscribe: (
    eventType: "onResolved",
    fn: (event: { toLocation: { pathname: string }; pathChanged: boolean }) => void,
  ) => () => void;
}

/**
 * Record one first-party `page_viewed` per resolved navigation, including the
 * entry one. This is what makes "landed" and "browsed templates" countable —
 * GA4 has the same numbers but they cannot be queried from the app.
 */
export function initFirstPartyAnalytics(router: AnalyticsRouter): () => void {
  if (typeof window === "undefined") return () => {};

  recordFirstParty("page_viewed", { entry: true });

  return router.subscribe("onResolved", (event) => {
    if (!event.pathChanged) return;
    recordFirstParty("page_viewed", { entry: false });
  });
}
