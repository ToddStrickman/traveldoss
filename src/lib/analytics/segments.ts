/**
 * Session segmentation: where a visit came from, and what it is browsing on.
 *
 * These three coarse labels ride along on every first-party event so the admin
 * console can cut the mint funnel by traffic source, device and browser without
 * storing anything identifying. Deliberately coarse:
 *   - source is a bucket name ("search", "instagram", "referral"), never a full
 *     referring URL, never a query string (OAuth callbacks park tokens there);
 *   - device is mobile / tablet / desktop, never a screen fingerprint;
 *   - browser is a family name, never a version string.
 * First-touch per tab: the labels are frozen on the first event of a session, so
 * an internal navigation cannot overwrite the acquisition source.
 */

export interface SessionSegments {
  src: string;
  device: string;
  browser: string;
}

const STORE_KEY = "td_seg_v1";

const SOCIAL: Array<[RegExp, string]> = [
  [/(^|\.)instagram\./, "instagram"],
  [/(^|\.)(facebook|fb)\./, "facebook"],
  [/(^|\.)tiktok\./, "tiktok"],
  [/(^|\.)(twitter|x)\.com$/, "x"],
  [/(^|\.)linkedin\./, "linkedin"],
  [/(^|\.)pinterest\./, "pinterest"],
  [/(^|\.)reddit\./, "reddit"],
  [/(^|\.)(youtube|youtu)\./, "youtube"],
  [/(^|\.)threads\./, "threads"],
  [/(^|\.)whatsapp\./, "whatsapp"],
];

const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|brave|baidu|yandex)\./;

/** Bucket a referrer host + utm_source into one short label. */
export function sourceLabel(referrer: string, utmSource: string | null, selfHost: string): string {
  const utm = (utmSource ?? "").trim().toLowerCase();
  if (utm) return utm.slice(0, 24);
  if (!referrer) return "direct";
  let host = "";
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "direct";
  }
  if (!host || host === selfHost.toLowerCase()) return "direct";
  for (const [re, label] of SOCIAL) if (re.test(host)) return label;
  if (SEARCH.test(host)) return "search";
  return `referral: ${host.replace(/^www\./, "").slice(0, 32)}`;
}

/** mobile / tablet / desktop from the UA string — no screen measurements. */
export function deviceLabel(ua: string): string {
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(s)) return "tablet";
  if (/iphone|ipod|android|mobile|windows phone/.test(s)) return "mobile";
  return "desktop";
}

/** Browser family from the UA string — family only, never a version. */
export function browserLabel(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung";
  if (/Firefox\/|FxiOS/.test(ua)) return "Firefox";
  if (/CriOS/.test(ua)) return "Chrome";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "other";
}

function compute(): SessionSegments {
  const params = new URLSearchParams(window.location.search);
  const utm = params.get("utm_source") || params.get("ref");
  const ua = window.navigator.userAgent || "";
  return {
    src: sourceLabel(document.referrer || "", utm, window.location.hostname),
    device: deviceLabel(ua),
    browser: browserLabel(ua),
  };
}

/** First-touch segments for this tab. Recomputed only if storage is unavailable. */
export function sessionSegments(): SessionSegments {
  if (typeof window === "undefined") {
    return { src: "direct", device: "desktop", browser: "other" };
  }
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SessionSegments>;
      if (parsed && typeof parsed.src === "string") {
        return {
          src: parsed.src,
          device: parsed.device ?? "desktop",
          browser: parsed.browser ?? "other",
        };
      }
    }
    const fresh = compute();
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    return compute();
  }
}
