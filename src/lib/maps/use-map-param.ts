/**
 * Live Map open/close state, shared between the chrome that opens it
 * (masthead button, view-switch segment, day-header pills) and SkinFrame,
 * which owns the overlay. The URL (`?map=1`, `?map=day-2`) is the
 * persistence: the dossier route syncs the search param into this store
 * and registers a navigator, so opening pushes history and the browser's
 * back button closes the map.
 *
 * Kept as a tiny external store rather than router hooks inside SkinFrame:
 * SkinFrame also renders in template previews and in tests with no router,
 * and it must not care where the request came from.
 */
import { useEffect, useSyncExternalStore } from "react";

export type MapEntry = "masthead" | "view_switch" | "day_header" | "deeplink";

export type MapRequest = {
  open: boolean;
  /** Focus on one day, or null for the whole trip. */
  day: number | null;
  entry: MapEntry | null;
};

type MapNavigator = {
  open: (day: number | null) => void;
  close: () => void;
};

const CLOSED: MapRequest = { open: false, day: null, entry: null };

let state: MapRequest = CLOSED;
let navigator: MapNavigator | null = null;
let opener: HTMLElement | null = null;
let pushed = false;
const listeners = new Set<() => void>();

function emit(next: MapRequest) {
  if (next.open === state.open && next.day === state.day && next.entry === state.entry) return;
  state = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useMapRequest(): MapRequest {
  return useSyncExternalStore(subscribe, () => state, () => CLOSED);
}

/** `"trip"` = whole trip, `"day-N"` = focused on day N. (Not a bare "1":
 *  the router JSON-encodes numeric-looking strings, which turns the URL into
 *  `?map=%221%22`.) */
export function serializeMapParam(day: number | null): string {
  return day == null ? "trip" : `day-${day}`;
}

export function parseMapParam(raw: unknown): { open: boolean; day: number | null } {
  if (raw === 1 || raw === true) return { open: true, day: null };
  if (typeof raw !== "string" || raw === "") return { open: false, day: null };
  const m = raw.match(/^day-(\d{1,3})$/);
  if (m) return { open: true, day: Number(m[1]) };
  return { open: true, day: null };
}

export function openMap(day: number | null = null, entry: MapEntry = "deeplink") {
  if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
    opener = document.activeElement;
  }
  if (navigator) {
    pushed = true;
    navigator.open(day);
  }
  emit({ open: true, day, entry });
}

export function closeMap() {
  const wasOpen = state.open;
  emit(CLOSED);
  if (navigator && wasOpen) {
    if (pushed && typeof window !== "undefined") {
      pushed = false;
      window.history.back();
    } else {
      navigator.close();
    }
  }
  const el = opener;
  opener = null;
  if (el && typeof window !== "undefined") {
    window.setTimeout(() => {
      if (el.isConnected) el.focus({ preventScroll: true });
    }, 0);
  }
}

/**
 * Route-side wiring. Call once in the dossier page with the current
 * `?map=` value and navigation callbacks; keeps the store and the URL in
 * step in both directions and cleans up on unmount.
 */
export function useMapUrlSync(param: string | undefined, nav: MapNavigator) {
  useEffect(() => {
    navigator = nav;
    return () => {
      if (navigator === nav) navigator = null;
    };
  }, [nav]);

  useEffect(() => {
    const parsed = parseMapParam(param);
    if (parsed.open) {
      // Preserve the entry the chrome recorded a moment ago; a fresh page
      // load with ?map= in the URL is a deep link.
      const entry = state.open && state.day === parsed.day && state.entry ? state.entry : "deeplink";
      emit({ open: true, day: parsed.day, entry });
    } else {
      pushed = false;
      emit(CLOSED);
    }
  }, [param]);
}

/* ── Locator: the owner's "Locate stops" capability ──────────────────────
 * The dossier route registers it when the viewer can edit; the overlay
 * shows the control and runs it. Viewers never see it. */

export type MapLocateResult = {
  configured: boolean;
  located: number;
  unresolved: number;
  remaining: number;
};

export type MapLocator = {
  locate: (opts?: { retryNeedsReview?: boolean }) => Promise<MapLocateResult>;
};

let locator: MapLocator | null = null;
const locatorListeners = new Set<() => void>();

export function registerMapLocator(next: MapLocator | null) {
  locator = next;
  for (const l of locatorListeners) l();
}

function subscribeLocator(l: () => void) {
  locatorListeners.add(l);
  return () => {
    locatorListeners.delete(l);
  };
}

export function useMapLocator(): MapLocator | null {
  return useSyncExternalStore(subscribeLocator, () => locator, () => null);
}

/** Test seam. */
export function __resetMapRequestForTests() {
  state = CLOSED;
  navigator = null;
  opener = null;
  pushed = false;
  locator = null;
}
