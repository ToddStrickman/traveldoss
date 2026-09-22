import { SignalSchema, type CanonicalItineraryItem, type LiveSignal, type Trip } from "./types";
import type { LiveProviderAdapter, NotificationDeliveryAdapter } from "./providers";
import { instant } from "./normalize";

/** Authenticated provider gateways return the documented normalized contract, never arbitrary actions. */
export class GatewayLiveProvider implements LiveProviderAdapter {
  constructor(
    public id: string,
    public label: string,
    private envPrefix: string,
  ) {}
  get supported() {
    return !!process.env[`${this.envPrefix}_URL`] && !!process.env[`${this.envPrefix}_TOKEN`];
  }
  async poll(items: CanonicalItineraryItem[], _trip: Trip, _now: string): Promise<LiveSignal[]> {
    if (!this.supported || !items.length) return [];
    const url = new URL(process.env[`${this.envPrefix}_URL`]!);
    if (url.protocol !== "https:")
      throw new Error(`${this.label} requires an HTTPS provider endpoint.`);
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env[`${this.envPrefix}_TOKEN`]}`,
      },
      // No email bodies, traveler names, or credentials are sent to operational providers.
      body: JSON.stringify({
        items: items.map(({ id, reservation: r }) => ({
          id,
          type: r.type,
          provider: r.provider,
          startAt: r.startAt,
          endAt: r.endAt,
          origin: r.origin,
          destination: r.destination,
          location: r.location,
          lat: r.lat,
          lng: r.lng,
          flightNumber: r.details.flightNumber,
        })),
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok)
      throw new Error(`${this.label} is unavailable (${response.status}); status was not assumed.`);
    const body = await response.text();
    if (body.length > 500_000) throw new Error(`${this.label} response exceeded the safety limit.`);
    const parsed = SignalSchema.array().max(100).parse(JSON.parse(body));
    return parsed.filter((s) => items.some((i) => i.id === s.itemId) && s.source.kind !== "demo");
  }
}
export class OpenMeteoProvider implements LiveProviderAdapter {
  id = "open-meteo";
  label = "Open-Meteo forecast";
  get supported() {
    return process.env.ADAPTIVE_WEATHER_ENABLED === "true";
  }
  async poll(items: CanonicalItineraryItem[], _trip: Trip, now: string): Promise<LiveSignal[]> {
    if (!this.supported) return [];
    const signals: LiveSignal[] = [];
    for (const item of items
      .filter(
        (i) =>
          i.reservation.lat != null &&
          i.reservation.lng != null &&
          i.reservation.startAt &&
          instant(i.reservation.startAt) >= instant(now) &&
          instant(i.reservation.startAt) - instant(now) <= 48 * 3600_000,
      )
      .slice(0, 8)) {
      const r = item.reservation;
      const params = new URLSearchParams({
        latitude: String(r.lat),
        longitude: String(r.lng),
        hourly: "temperature_2m,precipitation_probability,wind_speed_10m,weather_code,uv_index",
        timezone: "UTC",
        timeformat: "unixtime",
        forecast_days: "3",
      });
      const paid = process.env.OPEN_METEO_API_KEY;
      if (paid) params.set("apikey", paid);
      const response = await fetch(
        `https://${paid ? "customer-api" : "api"}.open-meteo.com/v1/forecast?${params}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!response.ok)
        throw new Error("Weather forecast is unavailable; no clear-weather assumption was made.");
      const data = await response.json(),
        h = data.hourly;
      const index = h?.time?.findIndex(
        (t: number) => Math.abs(t * 1000 - instant(r.startAt)) < 3600_000,
      );
      if (index == null || index < 0 || h.temperature_2m?.[index] == null) continue;
      const temp = Number(h.temperature_2m[index]),
        rain = Number(h.precipitation_probability?.[index] ?? 0),
        wind = Number(h.wind_speed_10m?.[index] ?? 0),
        code = Number(h.weather_code?.[index] ?? 0);
      const severe = r.outdoor === true && (code >= 95 || wind >= 65 || temp >= 40 || temp <= -15);
      const meaningful = r.outdoor === true && (rain >= 60 || wind >= 40 || temp >= 33);
      const hour = new Date(h.time[index] * 1000).toISOString();
      signals.push({
        id: `weather:${item.id}:${hour}:${temp}:${rain}:${wind}:${code}`,
        itemId: item.id,
        category: "weather",
        kind: "weather",
        source: {
          id: this.id,
          name: "Open-Meteo model forecast (retrieved time; model issue time unavailable)",
          kind: "provider",
          authoritative: true,
          url: "https://open-meteo.com/",
        },
        observedAt: now,
        validFrom: hour,
        validUntil: new Date(h.time[index] * 1000 + 3600_000).toISOString(),
        confidence: 0.88,
        summary: `${temp}°C and ${rain}% precipitation probability for ${r.title}.`,
        severity: severe ? "severe" : meaningful ? "meaningful" : "minor",
        action: severe
          ? "Check the provider and official local guidance before setting out; consider an indoor alternative."
          : meaningful
            ? "Consider adjusting your outdoor plan and checking with the provider."
            : undefined,
        association: { startAt: r.startAt!, location: r.location ?? r.address ?? r.origin ?? "" },
        values: {
          temperatureC: temp,
          rainProbability: rain,
          windKph: wind,
          uv: Number(h.uv_index?.[index] ?? 0),
        },
      });
    }
    return signals;
  }
}
export function liveProviders(): LiveProviderAdapter[] {
  return [
    new GatewayLiveProvider("flights", "Flight status", "ADAPTIVE_FLIGHTS"),
    new OpenMeteoProvider(),
    new GatewayLiveProvider("transit", "Traffic and transit", "ADAPTIVE_TRANSIT"),
    new GatewayLiveProvider("local", "Official destination notices", "ADAPTIVE_LOCAL"),
  ];
}
export class PushRelay implements NotificationDeliveryAdapter {
  async send(
    eventId: string,
    subscription: unknown,
    payload: { title: string; body: string; url: string; tag: string },
  ): Promise<"sent" | "expired"> {
    const url = process.env.ADAPTIVE_PUSH_RELAY_URL,
      token = process.env.ADAPTIVE_PUSH_RELAY_TOKEN;
    if (!url || !token || new URL(url).protocol !== "https:")
      throw new Error("Push delivery is not configured.");
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": eventId,
      },
      body: JSON.stringify({ subscription, payload }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 410) return "expired";
    if (!response.ok) throw new Error("Push delivery failed; the event remains queued for retry.");
    return "sent";
  }
}
