import {
  SignalSchema,
  type CanonicalItineraryItem,
  type ItineraryDependency,
  type ItineraryImpactAssessment,
  type LiveSignal,
  type NotificationEvent,
  type Phase,
  type TravelDossier,
  type Trip,
  type TripPulseStatus,
} from "./types";
import { instant, locationMatches, providerName, reference, stable } from "./normalize";
import { recordChange } from "./reconcile";

export const effectiveStart = (state: TravelDossier, item: CanonicalItineraryItem) =>
  state.live.find((s) => s.itemId === item.id)?.values.departure ?? item.reservation.startAt;
export const effectiveEnd = (state: TravelDossier, item: CanonicalItineraryItem) =>
  state.live.find((s) => s.itemId === item.id)?.values.arrival ??
  item.reservation.endAt ??
  effectiveStart(state, item);
export function activeItems(state: TravelDossier, tripId: string) {
  return state.items
    .filter(
      (i) =>
        i.tripId === tripId &&
        i.reservation.status !== "cancelled" &&
        !state.live.find((s) => s.itemId === i.id)?.cancelled,
    )
    .sort(
      (a, b) =>
        (instant(effectiveStart(state, a)) || Infinity) -
        (instant(effectiveStart(state, b)) || Infinity),
    );
}
export function lifecycle(input: TravelDossier, now: string): TravelDossier {
  const state = structuredClone(input),
    time = instant(now);
  for (const trip of state.trips) {
    const active = activeItems(state, trip.id),
      timed = active.filter((i) => Number.isFinite(instant(effectiveStart(state, i))));
    const first = Math.min(...timed.map((i) => instant(effectiveStart(state, i))));
    const last = Math.max(...timed.map((i) => instant(effectiveEnd(state, i))));
    let next = trip.session.phase;
    if (
      next === "planning" &&
      trip.preferences.autoActivate &&
      timed.length &&
      time >= first - trip.preferences.activationHours * 3600_000 &&
      time <= last
    )
      next = "live";
    // Missing times cannot safely establish the end; all-cancelled trips retain their disruption dashboard.
    if (
      next === "live" &&
      timed.length &&
      timed.length === active.length &&
      time > Math.max(last, instant(trip.session.extendedUntil) || 0)
    )
      next = "ended";
    if (next !== trip.session.phase) {
      trip.session = {
        ...trip.session,
        phase: next,
        automatic: true,
        ...(next === "live" ? { startedAt: now } : { endedAt: now }),
      };
      recordChange(state, {
        id: `${trip.id}:phase:${next}:${now}`,
        tripId: trip.id,
        at: now,
        actor: "system",
        kind: "phase",
        summary: next === "live" ? "Live Trip started automatically" : "Live Trip ended",
        rationale:
          next === "live"
            ? `Within ${trip.preferences.activationHours} hours of the first active reservation.`
            : "The final active reservation has ended.",
      });
    }
  }
  return state;
}
export function setPhase(
  input: TravelDossier,
  tripId: string,
  phase: Phase,
  now: string,
  extendedUntil?: string,
): TravelDossier {
  const state = structuredClone(input),
    trip = state.trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Trip not found.");
  if (
    extendedUntil &&
    (!Number.isFinite(instant(extendedUntil)) || instant(extendedUntil) <= instant(now))
  )
    throw new Error("Choose an extension in the future.");
  trip.session = {
    ...trip.session,
    phase,
    automatic: false,
    ...(phase === "live" ? { startedAt: now, endedAt: undefined } : {}),
    ...(phase === "ended" ? { endedAt: now } : {}),
    ...(extendedUntil ? { extendedUntil } : {}),
  };
  recordChange(state, {
    id: `${tripId}:phase:${phase}:${now}`,
    tripId,
    at: now,
    actor: "user",
    kind: "phase",
    summary: `Live Trip ${phase === "live" ? "activated" : phase}`,
    rationale: "Changed by the traveler. Email sync continues independently.",
  });
  return state;
}

export function detectDependencies(items: CanonicalItineraryItem[]): ItineraryDependency[] {
  const edges: ItineraryDependency[] = [];
  const transport = new Set(["flight", "rail", "bus", "ferry", "transfer"]);
  for (const from of items) {
    if (!transport.has(from.reservation.type) || !from.reservation.endAt) continue;
    for (const to of items) {
      if (from.id === to.id || from.tripId !== to.tripId) continue;
      const gap = (instant(to.reservation.startAt) - instant(from.reservation.endAt)) / 60_000;
      const arrival = from.reservation.destination ?? from.reservation.location;
      const nextPlace = to.reservation.origin ?? to.reservation.location;
      const city = from.reservation.details.destinationCity;
      if (
        gap >= 0 &&
        gap <= 12 * 60 &&
        (locationMatches(arrival, nextPlace) || locationMatches(city, to.reservation.location))
      ) {
        edges.push({
          fromId: from.id,
          toId: to.id,
          bufferMinutes: to.reservation.type === "flight" ? 90 : 30,
          confidence: 0.85,
          explicit: false,
          reason: `Arrival at ${arrival} precedes ${to.reservation.title} in the same airport or destination. Allow ${to.reservation.type === "flight" ? "90" : "30"} minutes (an estimate).`,
        });
      }
    }
  }
  return edges;
}
export function signalFresh(signal: LiveSignal, now: string): boolean {
  const time = instant(now);
  const maxAge =
    signal.category === "weather" || signal.category === "preparation" ? 3 * 3600_000 : 30 * 60_000;
  return (
    instant(signal.observedAt) <= time + 60_000 &&
    time - instant(signal.observedAt) <= maxAge &&
    instant(signal.validUntil) > time &&
    instant(signal.validFrom) <= instant(signal.validUntil)
  );
}
export function signalRelevant(
  item: CanonicalItineraryItem,
  signal: LiveSignal,
  now: string,
): boolean {
  const r = item.reservation,
    time = instant(now),
    start = instant(r.startAt);
  if (
    (r.status === "cancelled" &&
      !(signal.source.kind === "email" && signal.kind === "cancellation")) ||
    signal.itemId !== item.id ||
    signal.confidence < 0.85 ||
    !signal.source.authoritative
  )
    return false;
  if (!Number.isFinite(start) || !signalFresh(signal, now)) return false;
  if (Math.abs(instant(signal.association.startAt) - start) > 60_000) return false;
  if (
    ![r.origin, r.destination, r.location, r.address].some((v) =>
      locationMatches(v, signal.association.location),
    )
  )
    return false;
  if (signal.category === "flights") {
    if (
      r.type !== "flight" ||
      !signal.association.provider ||
      providerName(signal.association.provider) !== providerName(r.provider)
    )
      return false;
    if (
      !(
        (r.confirmation &&
          reference(signal.association.confirmation) === reference(r.confirmation)) ||
        (r.details.flightNumber &&
          reference(signal.association.flightNumber) === reference(r.details.flightNumber))
      )
    )
      return false;
  }
  if (
    (signal.kind === "weather" || signal.kind === "preparation") &&
    (start < instant(signal.validFrom) || start > instant(signal.validUntil))
  )
    return false;
  if (
    signal.category === "transit" &&
    !["flight", "rail", "bus", "ferry", "car", "transfer", "parking", "activity", "event"].includes(
      r.type,
    )
  )
    return false;
  return true;
}
export function assess(
  state: TravelDossier,
  item: CanonicalItineraryItem,
  signal: LiveSignal,
  now: string,
): ItineraryImpactAssessment {
  const minutes = (instant(effectiveStart(state, item)) - instant(now)) / 60_000;
  const downstream = state.dependencies
    .filter((d) => d.fromId === item.id)
    .flatMap((d) => {
      const next = state.items.find((i) => i.id === d.toId && i.reservation.status !== "cancelled");
      if (!next) return [];
      const arrival = signal.values.arrival;
      const conflict =
        signal.kind === "cancellation" ||
        (arrival &&
          instant(arrival) + d.bufferMinutes * 60_000 > instant(effectiveStart(state, next)));
      return conflict
        ? [{ itemId: next.id, reason: `${next.reservation.title} may be affected. ${d.reason}` }]
        : [];
    });
  const outdoor = item.reservation.outdoor === true;
  const contextualWeather =
    signal.category !== "weather" || outdoor || signal.severity === "severe";
  const critical =
    signal.kind === "cancellation" ||
    signal.kind === "closure" ||
    downstream.length > 0 ||
    ((signal.kind === "gate" || signal.kind === "terminal") && minutes <= 180) ||
    (signal.severity === "severe" && minutes <= 360);
  const actionable =
    !!signal.action &&
    contextualWeather &&
    minutes <= (critical ? 48 * 60 : 24 * 60) &&
    minutes >= -180;
  const tier = critical
    ? "critical"
    : signal.severity === "meaningful" && contextualWeather
      ? "important"
      : "helpful";
  return {
    signalId: signal.id,
    itemId: item.id,
    relevance: 1,
    urgency: minutes <= 180 ? "now" : minutes <= 24 * 60 ? "soon" : "informational",
    impact: critical ? "disrupting" : tier === "important" ? "meaningful" : "minor",
    actionability: actionable ? 1 : 0,
    confidence: signal.confidence,
    tier,
    rationale: `${signal.summary} Applies to ${item.reservation.title} at ${item.reservation.startAt}, ${signal.association.location}.${downstream.length ? ` ${downstream.length} later reservation(s) may be affected.` : ""}`,
    downstream,
  };
}
export function preparationFor(item: CanonicalItineraryItem, signal: LiveSignal): string[] {
  if (item.reservation.outdoor !== true || signal.category !== "weather") return [];
  const v = signal.values,
    advice: string[] = [];
  if ((v.rainProbability ?? 0) >= 40)
    advice.push("Consider bringing a compact rain layer or an umbrella.");
  if ((v.temperatureC ?? 20) >= 28 || (v.uv ?? 0) >= 6)
    advice.push("You may want water, sunscreen, sunglasses, and a hat.");
  if ((v.temperatureC ?? 20) < 15)
    advice.push("Temperatures may feel cool; consider a light jacket.");
  if ((v.windKph ?? 0) >= 30)
    advice.push("Wind may affect exposed areas; consider a windproof layer.");
  if ((v.airQuality ?? 0) >= 100)
    advice.push(
      "Air quality may affect outdoor exertion; consider an indoor alternative and check official guidance.",
    );
  return advice;
}
export function suppression(
  trip: Trip,
  signal: LiveSignal,
  assessment: ItineraryImpactAssessment,
  now: string,
): string | undefined {
  const p = trip.preferences.notifications;
  if (
    trip.session.phase !== "live" &&
    !(
      trip.session.phase === "planning" &&
      p.criticalBeforeDeparture &&
      signal.source.kind === "email" &&
      assessment.tier === "critical"
    )
  )
    return "Live Trip is not active";
  if (!p.push) return "Push notifications are off";
  if (!p.tiers[assessment.tier] || !p.categories[signal.category])
    return "This tier or category is muted";
  if (!assessment.actionability) return "No timely action is needed";
  if (assessment.tier === "helpful" && !p.tiers.helpful)
    return "Helpful updates stay in the dashboard";
  if (signal.source.kind === "demo") return "Demonstration data never sends a real push";
  if (p.quietHours.enabled) {
    const q = p.quietHours,
      hour = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: q.timezone,
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date(now)),
      );
    const quiet =
      q.start === q.end ||
      (q.start < q.end ? hour >= q.start && hour < q.end : hour >= q.start || hour < q.end);
    if (quiet && !(assessment.tier === "critical" && q.criticalException)) return "Quiet hours";
  }
  return undefined;
}

export function applySignals(
  input: TravelDossier,
  signals: LiveSignal[],
  now: string,
  allowDemo = false,
): TravelDossier {
  const state = lifecycle(input, now);
  state.dependencies = [
    ...state.dependencies.filter((d) => d.explicit),
    ...detectDependencies(state.items),
  ];
  for (const raw of signals) {
    const parsed = SignalSchema.safeParse(raw);
    if (!parsed.success) continue;
    const signal = parsed.data;
    if (
      (signal.source.kind === "demo" && !allowDemo) ||
      state.signals.some((s) => s.id === signal.id && s.source.id === signal.source.id)
    )
      continue;
    const item = state.items.find((i) => i.id === signal.itemId),
      trip = state.trips.find((t) => t.id === item?.tripId);
    if (!item || !trip) continue;
    if (!signalRelevant(item, signal, now)) {
      const plausible =
        trip.session.phase === "live" &&
        signalRelevant(
          item,
          { ...signal, confidence: 1, source: { ...signal.source, authoritative: true } },
          now,
        );
      const reviewId = "live-review:" + signal.source.id + ":" + signal.id;
      if (plausible && !state.reviews.some((q) => q.id === reviewId)) {
        state.reviews.push({
          id: reviewId,
          signal,
          tripId: trip.id,
          candidateIds: [item.id],
          reason:
            "This update matches your itinerary, but source authority or confidence is insufficient. Verify it with the provider before changing plans.",
          status: "open",
          at: now,
        });
        recordChange(state, {
          id: reviewId + ":change",
          tripId: trip.id,
          itemId: item.id,
          at: now,
          actor: "live",
          kind: "review",
          summary: "Live information needs review",
          rationale: signal.source.name + ": " + signal.summary,
        });
      }
      continue;
    }
    const prior = state.signals
      .filter(
        (s) => s.itemId === item.id && s.source.id === signal.source.id && s.kind === signal.kind,
      )
      .at(-1);
    if (prior && instant(prior.observedAt) >= instant(signal.observedAt)) continue;
    if (trip.session.phase !== "live" && signal.source.kind !== "email") continue;
    state.signals.push(signal);
    const before = state.live.find((s) => s.itemId === item.id);
    // Only operational sources change operational fields. Weather cannot rewrite a flight schedule.
    const operational =
      signal.category === "flights" ||
      signal.category === "transit" ||
      signal.category === "reservations";
    const values = operational
      ? Object.fromEntries(
          Object.entries(signal.values).filter(
            ([key]) =>
              [
                "departure",
                "arrival",
                "gate",
                "terminal",
                "boarding",
                "baggage",
                "departureBy",
              ].includes(key) &&
              !state.signals.some(
                (s) =>
                  s !== signal &&
                  s.itemId === item.id &&
                  s.values[key as keyof LiveSignal["values"]] !== undefined &&
                  instant(s.observedAt) > instant(signal.observedAt),
              ),
          ),
        )
      : {};
    const after = {
      itemId: item.id,
      updatedAt: now,
      signalIds: [...(before?.signalIds ?? []), signal.id],
      cancelled: signal.kind === "cancellation" || (before?.cancelled ?? false),
      values: { ...before?.values, ...values },
    };
    if (before) state.live[state.live.indexOf(before)] = after;
    else state.live.push(after);
    const assessment = assess(state, item, signal, now);
    state.assessments.push(assessment);
    state.audit.push({
      id: `${signal.source.id}:${signal.id}:audit`,
      itemId: item.id,
      signalId: signal.id,
      at: now,
      before,
      after: structuredClone(after),
      rationale: assessment.rationale,
    });
    recordChange(state, {
      id: `${signal.source.id}:${signal.id}:change`,
      tripId: trip.id,
      itemId: item.id,
      sourceId: signal.source.id,
      at: now,
      actor: "live",
      kind: "live",
      summary: signal.summary,
      rationale: assessment.rationale,
    });
    if (signal.action)
      state.recommendations.push({
        id: `${signal.id}:action`,
        itemId: item.id,
        signalId: signal.id,
        text: signal.action,
        kind: "action",
        generated: true,
      });
    if (trip.preferences.preparation && trip.preferences.notifications.categories.preparation)
      preparationFor(item, signal).forEach((text, i) =>
        state.recommendations.push({
          id: `${signal.id}:prep:${i}`,
          itemId: item.id,
          signalId: signal.id,
          text,
          kind: "preparation",
          generated: true,
        }),
      );
    const fingerprint = stable([
      item.id,
      signal.kind,
      signal.values,
      signal.summary,
      assessment.tier,
    ]);
    const duplicate = state.notifications.some(
      (n) => n.fingerprint === fingerprint && instant(now) - instant(n.at) < 24 * 3600_000,
    );
    if (!duplicate) {
      for (const old of state.notifications.filter(
        (n) => n.itemId === item.id && n.status !== "suppressed",
      )) {
        const oldSignal = state.signals.find((s) => s.id === old.signalId);
        if (oldSignal?.kind === signal.kind || signal.kind === "cancellation") {
          old.status = "suppressed";
          old.suppression = "Superseded by a newer update";
        }
      }
    }
    const reason = duplicate
      ? "Already shown; no material change"
      : suppression(trip, signal, assessment, now);
    const event: NotificationEvent = {
      id: `${signal.source.id}:${signal.id}:notification`,
      tripId: trip.id,
      itemId: item.id,
      signalId: signal.id,
      sourceId: signal.source.id,
      at: now,
      expiresAt: signal.validUntil,
      tier: assessment.tier,
      category: signal.category,
      text: signal.summary,
      rationale: assessment.rationale,
      fingerprint,
      status: !reason ? "pending" : duplicate ? "suppressed" : "dashboard",
      suppression: reason,
    };
    state.notifications.push(event);
  }
  return state;
}
export function pulse(state: TravelDossier, tripId: string, now: string): TripPulseStatus {
  const fresh = state.notifications.filter(
    (n) =>
      n.tripId === tripId &&
      !n.dismissedAt &&
      n.status !== "suppressed" &&
      instant(n.expiresAt) > instant(now) &&
      state.signals.some((s) => s.id === n.signalId && signalFresh(s, now)),
  );
  if (fresh.some((n) => n.tier === "critical")) return "Disrupted";
  if (state.reviews.some((r) => r.status === "open" && (r.tripId === tripId || !r.tripId)))
    return "Needs review";
  if (fresh.some((n) => n.tier === "important")) return "Attention needed";
  if (fresh.length) return "Updated";
  return "All clear";
}
