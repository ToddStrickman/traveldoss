import { ZonedTime, type Reservation } from "./types";

export const normalized = (s?: string) =>
  (s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export const reference = (s?: string) => normalized(s).replace(/ /g, "").toUpperCase();
const aliases: Record<string, string> = {
  "air france": "airfrance",
  af: "airfrance",
  "delta air lines": "delta",
  "delta airlines": "delta",
  dl: "delta",
  "united airlines": "united",
  ua: "united",
  "american airlines": "american",
  aa: "american",
  "british airways": "britishairways",
  ba: "britishairways",
  "new york jfk": "jfk",
  "john f kennedy international airport": "jfk",
  "paris charles de gaulle": "cdg",
  "charles de gaulle airport": "cdg",
};
export const providerName = (s?: string) =>
  aliases[normalized(s)] ??
  normalized(s)
    .replace(/\b(inc|llc|ltd)\b/g, "")
    .trim();
export const placeName = (s?: string) => aliases[normalized(s)] ?? normalized(s);
export function locationMatches(a?: string, b?: string): boolean {
  const x = placeName(a),
    y = placeName(b);
  return !!x && !!y && x === y;
}
export function instant(s?: string): number {
  return s ? Date.parse(s) : NaN;
}
export function sameDay(a?: string, b?: string): boolean {
  return !!a && !!b && Math.abs(instant(a) - instant(b)) < 18 * 3600_000;
}
export function sameRoute(a: Partial<Reservation>, b: Partial<Reservation>): boolean {
  if (a.origin && a.destination && b.origin && b.destination)
    return locationMatches(a.origin, b.origin) && locationMatches(a.destination, b.destination);
  return locationMatches(a.address || a.location, b.address || b.location);
}
export function normalizeReservation<T extends Partial<Reservation>>(r: T): T {
  return {
    ...r,
    ...(r.confirmation ? { confirmation: reference(r.confirmation) } : {}),
    details: Object.fromEntries(
      Object.entries(r.details ?? {}).map(([k, v]) => [
        k,
        k === "flightNumber" ? reference(v) : v.trim(),
      ]),
    ),
    ...(r.startAt ? { startAt: new Date(r.startAt).toISOString() } : {}),
    ...(r.endAt ? { endAt: new Date(r.endAt).toISOString() } : {}),
  };
}
// Deterministic JSON serialization for semantic deduplication, independent of key order.
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

/** Offset-bearing ISO only: date-only/local strings never silently become the server's zone. */
export function awareTime(value?: string): string | undefined {
  if (
    !value ||
    !ZonedTime.safeParse(value).success ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(Z|[+-]\d\d:\d\d)$/.test(value)
  )
    return undefined;
  return Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
}
