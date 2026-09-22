import {
  defaultPreferences,
  emptyDossier,
  type ExtractedTravelEntity,
  type ImportedEmailMessage,
  type LiveSignal,
  type Reservation,
  type TravelDossier,
} from "./types";
import { reconcileEmail } from "./reconcile";
import { applySignals } from "./live";

export const DEMO_NOW = "2030-06-18T10:00:00.000Z";
export const DEMO_TRIP = "11111111-1111-4111-8111-111111111111";
export function demoEmail(
  id: string,
  reservation: Partial<Reservation>,
  receivedAt = "2030-06-17T09:00:00.000Z",
): { message: ImportedEmailMessage; entities: ExtractedTravelEntity[] } {
  const r = {
    type: "flight" as const,
    title: "Air France AF007",
    provider: "Air France",
    status: "confirmed" as const,
    details: {},
    ...reservation,
  };
  return {
    message: {
      id,
      accountId: "demo-account",
      provider: "gmail",
      receivedAt,
      subject: `${r.title} · ${r.status === "cancelled" ? "Cancellation confirmed" : "Reservation update"}`,
      sender: "TravelDoss demo <demo@example.test>",
      text: "Fictional reservation evidence for the local demonstration. No connected inbox was read.",
      authenticatedSender: false,
    },
    entities: [
      {
        key: id,
        reservation: r,
        confidence: 0.99,
        rationale: "Labeled demonstration fixture; not verified external data.",
      },
    ],
  };
}
export const flightReservation: Reservation = {
  type: "flight",
  title: "Air France AF007",
  provider: "Air France",
  confirmation: "PARIS7",
  traveler: "Alex Traveler",
  startAt: "2030-06-18T12:00:00.000Z",
  endAt: "2030-06-18T19:00:00.000Z",
  timezone: "America/New_York",
  origin: "JFK",
  destination: "CDG",
  location: "Paris",
  status: "confirmed",
  details: { flightNumber: "AF007", gate: "B12", terminal: "4", destinationCity: "Paris" },
};
export function demoState(): TravelDossier {
  let state = emptyDossier();
  const preferences = defaultPreferences();
  preferences.autoActivate = false;
  state.trips.push({
    id: DEMO_TRIP,
    slug: "adaptive-demo",
    destination: "Paris",
    startDate: "2030-06-18",
    endDate: "2030-06-21",
    preferences,
    session: { phase: "planning" },
  });
  const reservations: Reservation[] = [
    flightReservation,
    {
      type: "transfer",
      title: "Airport pickup",
      provider: "Paris Transfer",
      confirmation: "CAR882",
      traveler: "Alex Traveler",
      startAt: "2030-06-18T20:00:00.000Z",
      endAt: "2030-06-18T21:00:00.000Z",
      timezone: "Europe/Paris",
      origin: "CDG",
      destination: "Paris",
      location: "Paris",
      status: "confirmed",
      details: {},
    },
    {
      type: "lodging",
      title: "Maison des Arts",
      provider: "Maison des Arts",
      confirmation: "STAY24",
      startAt: "2030-06-18T21:00:00.000Z",
      endAt: "2030-06-21T09:00:00.000Z",
      timezone: "Europe/Paris",
      location: "Paris",
      address: "Saint-Germain-des-Prés, Paris",
      lat: 48.8535,
      lng: 2.333,
      status: "confirmed",
      details: { access: "Demo check-in: reception at the main entrance." },
    },
    {
      type: "activity",
      title: "A walk along the Seine",
      provider: "Personal plan",
      confirmation: "WALK1",
      startAt: "2030-06-19T08:00:00.000Z",
      endAt: "2030-06-19T09:00:00.000Z",
      timezone: "Europe/Paris",
      location: "Paris",
      address: "Quai de Conti, Paris",
      lat: 48.8571,
      lng: 2.337,
      outdoor: true,
      status: "confirmed",
      details: {},
    },
  ];
  for (const [i, reservation] of reservations.entries()) {
    const e = demoEmail(`confirmation-${i}`, reservation);
    state = reconcileEmail(state, e.message, e.entities, DEMO_NOW);
  }
  return state;
}
export function demoScenario(
  state: TravelDossier,
  scenario: "schedule" | "cancel" | "unmatched" | "delay" | "weather",
): TravelDossier {
  if (scenario === "schedule") {
    const e = demoEmail(
      "schedule",
      {
        ...flightReservation,
        startAt: "2030-06-18T12:30:00.000Z",
        endAt: "2030-06-18T19:30:00.000Z",
      },
      DEMO_NOW,
    );
    return reconcileEmail(state, e.message, e.entities, DEMO_NOW);
  }
  if (scenario === "cancel" || scenario === "unmatched") {
    const e = demoEmail(
      scenario,
      {
        type: "transfer",
        title: "Airport pickup",
        provider: "Paris Transfer",
        confirmation: scenario === "cancel" ? "CAR882" : "UNKNOWN",
        status: "cancelled",
        details: {},
      },
      DEMO_NOW,
    );
    return reconcileEmail(state, e.message, e.entities, DEMO_NOW);
  }
  const item = state.items.find(
    (i) => i.reservation.type === (scenario === "weather" ? "activity" : "flight"),
  )!;
  const signal: LiveSignal = {
    id: `demo:${scenario}`,
    itemId: item.id,
    category: scenario === "weather" ? "weather" : "flights",
    kind: scenario === "weather" ? "weather" : "delay",
    source: {
      id: "demo-provider",
      name: "Demonstration provider",
      kind: "demo",
      authoritative: true,
    },
    observedAt: DEMO_NOW,
    validFrom: DEMO_NOW,
    validUntil: "2030-06-19T10:00:00.000Z",
    confidence: 0.99,
    summary:
      scenario === "weather"
        ? "Rain is forecast for your Seine walk."
        : "AF007 is delayed. Gate changed to C4.",
    action:
      scenario === "weather"
        ? "Consider checking the forecast before your walk."
        : "Review your airport pickup; the expected arrival is later than your reservation.",
    severity: "meaningful",
    association: {
      startAt: item.reservation.startAt!,
      location: scenario === "weather" ? "Paris" : "JFK",
      provider: item.reservation.provider,
      confirmation: item.reservation.confirmation,
    },
    values:
      scenario === "weather"
        ? { temperatureC: 14, rainProbability: 80, windKph: 18 }
        : {
            departure: "2030-06-18T17:25:00.000Z",
            arrival: "2030-06-19T00:25:00.000Z",
            gate: "C4",
          },
  };
  return applySignals(state, [signal], DEMO_NOW, true);
}
