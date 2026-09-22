import { describe, expect, test } from "bun:test";
import {
  defaultPreferences,
  emptyDossier,
  type LiveSignal,
  type Reservation,
} from "../src/lib/adaptive/types";
import {
  demoEmail,
  demoScenario,
  demoState,
  DEMO_NOW,
  DEMO_TRIP,
  flightReservation,
} from "../src/lib/adaptive/demo";
import {
  matchCanonical,
  reconcileEmail,
  resolveReview,
  restoreVersion,
} from "../src/lib/adaptive/reconcile";
import {
  activeItems,
  applySignals,
  detectDependencies,
  lifecycle,
  preparationFor,
  pulse,
  setPhase,
  signalRelevant,
  suppression,
  assess,
} from "../src/lib/adaptive/live";
import { ConservativeTravelExtractor, cancellationDetected } from "../src/lib/adaptive/extract";
import { executeCommand } from "../src/lib/adaptive/commands";
import { eraseImportedAccount } from "../src/lib/adaptive/privacy";
import { awareTime, normalizeReservation, stable } from "../src/lib/adaptive/normalize";

const later = "2030-06-18T10:05:00.000Z";
function ingest(
  state: ReturnType<typeof demoState>,
  id: string,
  reservation: Partial<Reservation>,
  receivedAt = DEMO_NOW,
) {
  const e = demoEmail(id, reservation, receivedAt);
  return reconcileEmail(state, e.message, e.entities, later);
}
function liveState() {
  return setPhase(demoState(), DEMO_TRIP, "live", DEMO_NOW);
}
function signal(state = liveState(), patch: Partial<LiveSignal> = {}): LiveSignal {
  const item = state.items.find((i) => i.reservation.type === "flight")!;
  return {
    id: "provider-delay-1",
    itemId: item.id,
    category: "flights",
    kind: "delay",
    source: {
      id: "airline-status",
      name: "Airline operations",
      kind: "provider",
      authoritative: true,
    },
    observedAt: DEMO_NOW,
    validFrom: DEMO_NOW,
    validUntil: "2030-06-19T10:00:00.000Z",
    confidence: 0.99,
    summary: "Flight delayed by two hours",
    action: "Check your airport pickup.",
    severity: "meaningful",
    association: {
      startAt: item.reservation.startAt!,
      location: "JFK",
      provider: "Air France",
      confirmation: "PARIS7",
    },
    values: {
      departure: "2030-06-18T14:00:00.000Z",
      arrival: "2030-06-18T21:00:00.000Z",
      gate: "C4",
    },
    ...patch,
  };
}

describe("canonical reconciliation", () => {
  test("one confirmation creates one canonical reservation with evidence", () => {
    const state = demoState();
    expect(state.items).toHaveLength(4);
    expect(state.sources).toHaveLength(4);
    expect(state.items[0].reservation.confirmation).toBe("PARIS7");
  });
  test("reprocessing an email changes nothing, including history and sources", () => {
    const state = demoState(),
      e = demoEmail("confirmation-0", flightReservation);
    expect(reconcileEmail(state, e.message, e.entities, later)).toEqual(state);
  });
  test("schedule change updates the same flight, preserving its original and version", () => {
    const state = demoState(),
      next = demoScenario(state, "schedule");
    expect(next.items).toHaveLength(4);
    expect(next.items[0].id).toBe(state.items[0].id);
    expect(next.items[0].reservation.startAt).toBe("2030-06-18T12:30:00.000Z");
    expect(next.items[0].original.startAt).toBe(flightReservation.startAt);
    expect(next.versions[0].reservation.startAt).toBe(flightReservation.startAt);
  });
  test("multiple equivalent emails attach evidence without duplicate versions", () => {
    const state = ingest(demoState(), "same-details", flightReservation);
    expect(state.items).toHaveLength(4);
    expect(state.items[0].sourceIds).toHaveLength(2);
    expect(state.versions).toHaveLength(0);
  });
  test("exact cancellation preserves history and leaves active timeline", () => {
    const state = demoScenario(demoState(), "cancel");
    expect(state.items).toHaveLength(4);
    expect(activeItems(state, DEMO_TRIP)).toHaveLength(3);
    expect(state.items.find((i) => i.reservation.type === "transfer")!.reservation.status).toBe(
      "cancelled",
    );
    expect(state.versions).toHaveLength(1);
  });
  test("unmatched cancellation only creates review evidence", () => {
    const state = demoScenario(demoState(), "unmatched");
    expect(state.items).toHaveLength(4);
    expect(state.reviews).toHaveLength(1);
    expect(state.reviews[0].reason).toContain("No reservation was created");
  });
  test("an older confirmation cannot reverse a cancellation", () => {
    let state = demoScenario(demoState(), "cancel");
    state = ingest(
      state,
      "old-transfer",
      { ...state.items[1].original },
      "2030-06-17T10:00:00.000Z",
    );
    expect(state.items[1].reservation.status).toBe("cancelled");
  });
  test("fresh confirmation cannot silently reactivate a cancelled booking", () => {
    let state = demoScenario(demoState(), "cancel");
    state = ingest(state, "fresh-transfer", { ...state.items[1].original }, later);
    expect(state.items[1].reservation.status).toBe("cancelled");
    expect(state.reviews).toHaveLength(1);
  });
  test("user edits survive a conflicting email and trigger Review", () => {
    let state = demoState();
    state = executeCommand(
      state,
      {
        kind: "edit",
        itemId: state.items[0].id,
        reservation: { ...flightReservation, startAt: "2030-06-18T13:00:00.000Z" },
      },
      DEMO_NOW,
    );
    state = demoScenario(state, "schedule");
    expect(state.items[0].reservation.startAt).toBe("2030-06-18T13:00:00.000Z");
    expect(state.reviews).toHaveLength(1);
  });
  test("ambiguous shared PNR never cancels multiple legs", () => {
    const state = demoState();
    state.items.push({
      ...structuredClone(state.items[0]),
      id: "return",
      reservation: { ...flightReservation, origin: "CDG", destination: "JFK" },
    });
    const next = ingest(state, "cancel-pnr", {
      type: "flight",
      title: "Travel reservation",
      provider: "Air France",
      confirmation: "PARIS7",
      status: "cancelled",
      details: {},
    });
    expect(next.reviews).toHaveLength(1);
    expect(next.items.filter((i) => i.reservation.status === "cancelled")).toHaveLength(0);
  });
  test("same reference from another provider cannot hijack a reservation", () => {
    const result = matchCanonical(demoState().items, {
      key: "x",
      reservation: { ...flightReservation, provider: "Another airline" },
      confidence: 1,
      rationale: "fixture",
    });
    expect(result.candidates).toHaveLength(0);
  });
  test("missing timezone or ambiguous trip goes to Review", () => {
    const state = ingest(demoState(), "unknown-time", {
      ...flightReservation,
      provider: "Another airline",
      confirmation: "NEW",
      timezone: undefined,
    });
    expect(state.items).toHaveLength(4);
    expect(state.reviews).toHaveLength(1);
  });
  test("Review cancellation requires a target, and dismissal is idempotent", () => {
    const state = demoScenario(demoState(), "unmatched"),
      review = state.reviews[0];
    expect(() =>
      resolveReview(state, review.id, "apply", later, {
        tripId: DEMO_TRIP,
        reservation: { ...flightReservation, status: "cancelled" },
      }),
    ).toThrow("existing reservation");
    const next = resolveReview(state, review.id, "dismiss", later);
    expect(resolveReview(next, review.id, "dismiss", later)).toEqual(next);
  });
  test("Review apply updates the selected owned item and records the decision", () => {
    const state = demoScenario(demoState(), "unmatched"),
      review = state.reviews[0];
    const next = resolveReview(state, review.id, "apply", later, {
      tripId: DEMO_TRIP,
      itemId: state.items[1].id,
      reservation: { ...state.items[1].reservation, status: "cancelled" },
    });
    expect(next.items[1].reservation.status).toBe("cancelled");
    expect(next.reviews[0].status).toBe("applied");
  });
  test("restore preserves the update in history and locks restored fields", () => {
    const state = demoScenario(demoState(), "schedule");
    const next = restoreVersion(state, state.versions[0].id, later);
    expect(next.items[0].reservation.startAt).toBe(flightReservation.startAt);
    expect(next.versions).toHaveLength(2);
    expect(next.items[0].userEditedFields).toContain("startAt");
  });
  test("explicit rebooking links a new reference to its cancelled predecessor", () => {
    let state = ingest(demoState(), "cancel-flight", { ...flightReservation, status: "cancelled" });
    const e = demoEmail(
      "rebook",
      {
        ...flightReservation,
        confirmation: "NEWPNR",
        startAt: "2030-06-19T12:00:00.000Z",
        endAt: "2030-06-19T19:00:00.000Z",
      },
      later,
    );
    e.entities[0].replacesConfirmation = "PARIS7";
    state = reconcileEmail(state, e.message, e.entities, later);
    expect(state.items).toHaveLength(5);
    expect(state.items[4].replacesItemId).toBe(state.items[0].id);
  });
});

describe("conservative extraction and time", () => {
  test("cancellation policy and quoted old cancellation do not cancel a booking", () => {
    expect(
      cancellationDetected(
        "Reservation confirmed",
        "Free cancellation until Friday\nCancellation policy: cancelled bookings may have fees",
      ),
    ).toBe(false);
    expect(
      cancellationDetected(
        "Reservation confirmed",
        "Confirmed.\nOn Monday someone wrote:\nYour flight was cancelled",
      ),
    ).toBe(false);
  });
  test("explicit status and provider cancellation language are recognized", () => {
    for (const status of [
      "cancelled",
      "canceled",
      "voided",
      "refunded",
      "expired",
      "no longer confirmed",
    ])
      expect(cancellationDetected("", "", status)).toBe(true);
    expect(cancellationDetected("Your flight has been cancelled", "")).toBe(true);
  });
  test("unrecognized sender is never high-confidence automation", () => {
    const e = demoEmail("generic", flightReservation).message;
    e.text =
      "Provider: Air France\nConfirmation: PARIS7\nDeparture: 2030-06-18T12:00:00Z\nTimezone: Europe/Paris";
    expect(new ConservativeTravelExtractor().extract(e)[0].confidence).toBeLessThan(0.95);
  });
  test("authenticated known provider with explicit fields is extractable", () => {
    const e = demoEmail("known", flightReservation).message;
    e.sender = "reservations@airfrance.com";
    e.authenticatedSender = true;
    e.text =
      "Type: flight\nTitle: Flight to Paris\nProvider: Air France\nConfirmation: PARIS7\nDeparture: 2030-06-18T08:00:00-04:00\nTimezone: America/New_York\nFrom: JFK\nTo: CDG\nDestination city: Paris";
    const entity = new ConservativeTravelExtractor().extract(e)[0];
    expect(entity.confidence).toBeGreaterThanOrEqual(0.95);
    expect(entity.reservation.startAt).toBe(flightReservation.startAt);
  });
  test("unsupported PDF booking evidence routes to Review", () => {
    const e = demoEmail("pdf", flightReservation).message;
    e.sender = "reservations@airfrance.com";
    e.authenticatedSender = true;
    e.text = "Provider: Air France\nConfirmation: PARIS7";
    e.attachments = [{ name: "cancellation.pdf", mimeType: "application/pdf" }];
    expect(new ConservativeTravelExtractor().extract(e)[0].confidence).toBeLessThan(0.95);
  });
  test("unrelated mail produces no retained evidence", () => {
    const e = demoEmail("hello", flightReservation).message;
    e.subject = "Lunch with Sam";
    e.text = "See you soon.";
    expect(new ConservativeTravelExtractor().extract(e)).toEqual([]);
  });
  test("timezone normalization is server-zone independent", () => {
    expect(awareTime("2030-06-18T08:00:00-04:00")).toBe(flightReservation.startAt);
    expect(awareTime("2030-06-18 08:00")).toBeUndefined();
    expect(awareTime("2030-06-18")).toBeUndefined();
    expect(normalizeReservation({ confirmation: " ab-12 3 " }).confirmation).toBe("AB123");
  });
});

describe("Live Trip lifecycle and contextual decisions", () => {
  test("defaults are planning, optional location, and no push", () => {
    const prefs = defaultPreferences();
    expect(prefs.activationHours).toBe(24);
    expect(prefs.location).toBe("unknown");
    expect(prefs.notifications.push).toBe(false);
    expect(prefs.notifications.criticalBeforeDeparture).toBe(false);
    expect(prefs.notifications.tiers.helpful).toBe(false);
  });
  test("automatic activation starts at exactly the configured window", () => {
    const state = demoState();
    state.trips[0].preferences.autoActivate = true;
    expect(lifecycle(state, "2030-06-17T11:59:59Z").trips[0].session.phase).toBe("planning");
    expect(lifecycle(state, "2030-06-17T12:00:00Z").trips[0].session.phase).toBe("live");
  });
  test("pause/end persist and extension prevents automatic end", () => {
    const paused = setPhase(liveState(), DEMO_TRIP, "paused", DEMO_NOW);
    expect(lifecycle(paused, later).trips[0].session.phase).toBe("paused");
    expect(lifecycle(liveState(), "2030-06-22T12:00:00Z").trips[0].session.phase).toBe("ended");
    const extended = setPhase(liveState(), DEMO_TRIP, "live", DEMO_NOW, "2030-06-23T12:00:00Z");
    expect(lifecycle(extended, "2030-06-22T12:00:00Z").trips[0].session.phase).toBe("live");
  });
  test("planning and paused trips do not consume weather or flight feeds", () => {
    const state = demoState();
    const update = signal(state);
    expect(applySignals(state, [update], DEMO_NOW).signals).toHaveLength(0);
    expect(
      applySignals(setPhase(state, DEMO_TRIP, "paused", DEMO_NOW), [update], DEMO_NOW)
        .notifications,
    ).toHaveLength(0);
  });
  test("live delay changes operational data, not the original reservation", () => {
    const state = liveState(),
      next = applySignals(state, [signal(state)], DEMO_NOW);
    expect(next.items[0].reservation).toEqual(flightReservation);
    expect(next.live[0].values.gate).toBe("C4");
    expect(next.audit).toHaveLength(1);
    expect(next.assessments[0].downstream.length).toBeGreaterThan(0);
  });
  test("context requires exact date, place, identity, authority, and freshness", () => {
    const state = liveState(),
      item = state.items[0],
      valid = signal(state);
    expect(signalRelevant(item, valid, DEMO_NOW)).toBe(true);
    for (const bad of [
      { ...valid, association: { ...valid.association, location: "LAX" } },
      { ...valid, association: { ...valid.association, confirmation: "WRONG" } },
      { ...valid, association: { ...valid.association, startAt: "2030-06-19T12:00:00Z" } },
      { ...valid, source: { ...valid.source, authoritative: false } },
      { ...valid, observedAt: "2030-06-18T08:00:00Z" },
      { ...valid, validUntil: "2030-06-18T09:00:00Z" },
    ])
      expect(signalRelevant(item, bad, DEMO_NOW)).toBe(false);
  });
  test("same signal replay creates no duplicate status, history, audit, or alert", () => {
    const state = liveState(),
      update = signal(state),
      once = applySignals(state, [update], DEMO_NOW);
    expect(applySignals(once, [update], later)).toEqual(once);
  });
  test("new provider ID with unchanged facts suppresses duplicate notification", () => {
    const state = liveState(),
      first = signal(state);
    const once = applySignals(state, [first], DEMO_NOW);
    const twice = applySignals(once, [{ ...first, id: "repeat", observedAt: later }], later);
    expect(twice.notifications[1].status).toBe("suppressed");
  });
  test("delay affects nearby connected reservations, not unrelated trips or distant places", () => {
    const state = liveState(),
      edges = detectDependencies(state.items);
    expect(edges.some((e) => e.toId === state.items[1].id)).toBe(true);
    state.items[1].tripId = "another-trip";
    state.items[2].reservation.location = "Tokyo";
    expect(
      detectDependencies(state.items).some(
        (e) => e.toId === state.items[1].id || e.toId === state.items[2].id,
      ),
    ).toBe(false);
  });
  test("quiet hours honor the explicit critical exception", () => {
    const state = liveState(),
      trip = state.trips[0],
      update = signal(state);
    state.dependencies = detectDependencies(state.items);
    const assessment = assess(state, state.items[0], update, DEMO_NOW);
    trip.preferences.notifications.push = true;
    trip.preferences.notifications.quietHours = {
      enabled: true,
      start: 9,
      end: 12,
      timezone: "UTC",
      criticalException: false,
    };
    expect(suppression(trip, update, assessment, DEMO_NOW)).toBe("Quiet hours");
    trip.preferences.notifications.quietHours.criticalException = true;
    expect(suppression(trip, update, assessment, DEMO_NOW)).toBeUndefined();
  });
  test("muted categories suppress pushes and non-actionable information stays quiet", () => {
    const state = liveState(),
      update = signal(state),
      trip = state.trips[0];
    trip.preferences.notifications.push = true;
    trip.preferences.notifications.categories.flights = false;
    expect(
      suppression(trip, update, assess(state, state.items[0], update, DEMO_NOW), DEMO_NOW),
    ).toContain("muted");
    trip.preferences.notifications.categories.flights = true;
    update.action = undefined;
    expect(
      suppression(trip, update, assess(state, state.items[0], update, DEMO_NOW), DEMO_NOW),
    ).toContain("No timely action");
  });
  test("preparation is tied to outdoor items; advice stays supportive", () => {
    const state = demoScenario(liveState(), "weather"),
      weather = state.signals[0],
      outdoor = state.items[3];
    expect(preparationFor(outdoor, weather).join(" ")).toContain("Consider");
    expect(preparationFor(state.items[2], weather)).toEqual([]);
    expect(state.recommendations.every((r) => r.generated)).toBe(true);
  });
  test("live cancellation disappears from active timeline and retains original", () => {
    const state = liveState(),
      update = signal(state, { kind: "cancellation", severity: "severe", values: {} });
    const next = applySignals(state, [update], DEMO_NOW);
    expect(activeItems(next, DEMO_TRIP)).toHaveLength(3);
    expect(next.items).toHaveLength(4);
    expect(next.items[0].original.status).toBe("confirmed");
    expect(pulse(next, DEMO_TRIP, DEMO_NOW)).toBe("Disrupted");
  });
  test("demo provider never emits a real push", () => {
    const state = liveState();
    state.trips[0].preferences.notifications.push = true;
    const next = demoScenario(state, "delay");
    expect(next.notifications[0].suppression).toContain("Demonstration");
    expect(
      applySignals(
        state,
        [
          signal(state, {
            source: { id: "demo", name: "demo", kind: "demo", authoritative: true },
          }),
        ],
        DEMO_NOW,
      ).signals,
    ).toHaveLength(0);
  });
  test("explicit imported-data deletion erases linked histories but preserves independent user items", () => {
    const state = executeCommand(
      demoScenario(demoState(), "schedule"),
      {
        kind: "add",
        tripId: DEMO_TRIP,
        reservation: { ...flightReservation, provider: "Independent", confirmation: "PERSONAL" },
      },
      DEMO_NOW,
    );
    const next = eraseImportedAccount(state, "demo-account", later);
    expect(next.sources).toHaveLength(0);
    expect(next.versions).toHaveLength(0);
    expect(next.items).toHaveLength(1);
    expect(next.items[0].sourceKind).toBe("user");
    expect(next.changes.at(-1)?.kind).toBe("privacy");
  });
});

describe("recovery and notification regressions", () => {
  test("cancellation arriving before its confirmation reconciles when the booking appears", () => {
    const base = demoState();
    base.items = [];
    base.sources = [];
    base.changes = [];
    base.processed = [];
    let state = ingest(
      base,
      "early-cancel",
      { ...flightReservation, status: "cancelled" },
      DEMO_NOW,
    );
    expect(state.items).toHaveLength(0);
    expect(state.reviews[0].status).toBe("open");
    state = ingest(state, "late-confirmation", flightReservation, "2030-06-17T09:00:00Z");
    expect(state.items).toHaveLength(1);
    expect(state.items[0].reservation.status).toBe("cancelled");
    expect(state.reviews[0].status).toBe("applied");
    expect(activeItems(state, DEMO_TRIP)).toHaveLength(0);
  });
  test("same-day explicit rebooking does not reuse the cancelled record", () => {
    let state = ingest(demoState(), "cancel-before-rebook", {
      ...flightReservation,
      status: "cancelled",
    });
    const e = demoEmail(
      "same-day-rebook",
      {
        ...flightReservation,
        confirmation: "REBOOK1",
        startAt: "2030-06-18T15:00:00Z",
        endAt: "2030-06-18T22:00:00Z",
      },
      later,
    );
    e.entities[0].replacesConfirmation = flightReservation.confirmation;
    state = reconcileEmail(state, e.message, e.entities, later);
    expect(state.items).toHaveLength(5);
    expect(state.items[4].replacesItemId).toBe(state.items[0].id);
  });
  test("conflicting explicit references need review instead of rewriting identity", () => {
    const state = ingest(demoState(), "different-reference", {
      ...flightReservation,
      confirmation: "DIFFERENT",
    });
    expect(state.items).toHaveLength(4);
    expect(state.items[0].reservation.confirmation).toBe("PARIS7");
    expect(state.reviews).toHaveLength(1);
  });
  test("older schedule signal cannot overwrite a newer delay from another kind", () => {
    let state = liveState();
    const first = signal(state, { observedAt: later });
    state = applySignals(state, [first], later);
    state = applySignals(
      state,
      [
        signal(state, {
          id: "older-schedule",
          kind: "schedule",
          observedAt: DEMO_NOW,
          values: { departure: flightReservation.startAt },
        }),
      ],
      later,
    );
    expect(state.live[0].values.departure).toBe(first.values.departure);
  });
  test("a materially changed status supersedes the earlier alert", () => {
    let state = liveState();
    state = applySignals(state, [signal(state)], DEMO_NOW);
    state = applySignals(
      state,
      [
        signal(state, {
          id: "delay-new",
          observedAt: later,
          summary: "Flight delayed by three hours",
          values: { arrival: "2030-06-18T22:00:00Z" },
        }),
      ],
      later,
    );
    expect(state.notifications[0].status).toBe("suppressed");
    expect(state.notifications[1].status).toBe("dashboard");
  });
  test("critical email changes in Planning require the narrow opt-in", () => {
    const state = demoState(),
      trip = state.trips[0],
      update = signal(state, {
        kind: "cancellation",
        source: { id: "gmail", name: "Provider email", kind: "email", authoritative: true },
      });
    trip.preferences.notifications.push = true;
    const a = assess(state, state.items[0], update, DEMO_NOW);
    expect(suppression(trip, update, a, DEMO_NOW)).toBe("Live Trip is not active");
    trip.preferences.notifications.criticalBeforeDeparture = true;
    expect(suppression(trip, update, a, DEMO_NOW)).toBeUndefined();
    expect(suppression(trip, signal(state), a, DEMO_NOW)).toBe("Live Trip is not active");
  });
  test("invalid calendar dates never normalize into a different day", () => {
    expect(awareTime("2030-02-31T10:00:00Z")).toBeUndefined();
  });
});

describe("uncertain operational evidence", () => {
  test("plausible but low-confidence live data goes to Review without changing status", () => {
    const state = liveState(),
      update = signal(state, { confidence: 0.6 });
    const next = applySignals(state, [update], DEMO_NOW);
    expect(next.live).toHaveLength(0);
    expect(next.notifications).toHaveLength(0);
    expect(next.reviews).toHaveLength(1);
    expect(next.reviews[0].signal?.confidence).toBe(0.6);
    expect(applySignals(next, [update], later).reviews).toHaveLength(1);
    expect(() => resolveReview(next, next.reviews[0].id, "apply", later)).toThrow("Verify");
  });
  test("an irrelevant low-confidence signal does not create Review noise", () => {
    const state = liveState(),
      update = signal(state);
    update.confidence = 0.6;
    update.association.location = "Tokyo";
    expect(applySignals(state, [update], DEMO_NOW).reviews).toHaveLength(0);
  });
  test("a cancellation attachment cannot become an active reservation", () => {
    const e = demoEmail("attached", flightReservation).message;
    e.subject = "Your document";
    e.text = "Please see attachment.";
    e.attachments = [{ name: "flight-cancellation.pdf", mimeType: "application/pdf" }];
    const entities = new ConservativeTravelExtractor().extract(e);
    expect(entities[0].reservation.status).toBe("cancelled");
    const next = reconcileEmail(demoState(), e, entities, later);
    expect(next.items).toHaveLength(4);
    expect(next.reviews).toHaveLength(1);
  });
  test("travel newsletters do not create reservation noise", () => {
    const e = demoEmail("promo", flightReservation).message;
    e.subject = "Summer flight sale";
    e.text = "Book a flight and save.";
    expect(new ConservativeTravelExtractor().extract(e)).toEqual([]);
  });
});

describe("user-controlled live history restore", () => {
  test("restores prior operational values without deleting evidence or changing the reservation", () => {
    const original = liveState(),
      updated = applySignals(original, [signal(original)], DEMO_NOW);
    const restored = executeCommand(
      updated,
      { kind: "restore-live", auditId: updated.audit[0].id },
      later,
    );
    expect(restored.live[0].values).toEqual({});
    expect(restored.items[0].reservation).toEqual(original.items[0].reservation);
    expect(restored.audit).toHaveLength(2);
    expect(restored.signals).toHaveLength(1);
    expect(restored.notifications[0].status).toBe("suppressed");
    expect(restored.changes.at(-1)?.actor).toBe("user");
  });
  test("a mistaken operational cancellation can be reversed in the dossier", () => {
    const state = liveState(),
      update = signal(state, { kind: "cancellation", severity: "severe", values: {} });
    const cancelled = applySignals(state, [update], DEMO_NOW);
    expect(activeItems(cancelled, DEMO_TRIP)).toHaveLength(3);
    const restored = executeCommand(
      cancelled,
      { kind: "restore-live", auditId: cancelled.audit[0].id },
      later,
    );
    expect(activeItems(restored, DEMO_TRIP)).toHaveLength(4);
    expect(restored.audit).toHaveLength(2);
  });
});

test("dashboard pulse stops treating an old source observation as a fresh alert", () => {
  const initial = liveState();
  const updated = applySignals(
    initial,
    [signal(initial, { validUntil: "2030-06-19T10:00:00Z" })],
    DEMO_NOW,
  );
  expect(pulse(updated, DEMO_TRIP, DEMO_NOW)).toBe("Disrupted");
  expect(pulse(updated, DEMO_TRIP, "2030-06-18T11:00:00Z")).toBe("All clear");
  expect(updated.audit).toHaveLength(1);
});
