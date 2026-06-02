import type { Block, TripView } from "./types";

/**
 * Single shared demo fixture rendered by every skin's gallery tile,
 * so users are comparing chrome — not content.
 */
export const DEMO_TRIP: TripView = {
  destination: "Lisbon",
  subtitle: "Three slow days along the Tagus.",
  slug: "demo-lisbon",
  start_date: "2026-06-12",
  end_date: "2026-06-14",
  days: 3,
};

export const DEMO_BLOCKS: Block[] = [
  { kind: "hero", title: "Lisbon", subtitle: "Three slow days along the Tagus.", eyebrow: "June · 2026" },
  { kind: "section", title: "Trip Overview" },
  {
    kind: "paragraph",
    text:
      "Land Friday. Two nights in Príncipe Real, one in Alfama. Pastel de nata as religion. Trams when they make sense, feet when they don't.",
  },
  {
    kind: "flight",
    direction: "outbound",
    airline: "TAP Air Portugal",
    flightNumber: "TP204",
    confirmation: "ABC123",
    from: "JFK",
    to: "LIS",
    fromCity: "New York",
    toCity: "Lisbon",
    date: "Jun 12, 2026",
    arriveDate: "Jun 13, 2026",
    departTime: "20:50",
    arriveTime: "08:35",
    passenger: "Jordan Rivera",
    seat: "14C",
    boardingGroup: "Group 3",
    boardingTime: "20:05",
    fareClass: "Main Cabin",
    baggage: "1 carry-on + 1 checked (23kg)",
    price: "$612.40",
    note: "Direct overnight from JFK. Aisle seat.",
  },
  { kind: "place", name: "Memmo Príncipe Real", category: "hotel", note: "Quiet courtyard, rooftop bar." },
  { kind: "place", name: "Cervejaria Ramiro", category: "food", address: "Av. Almirante Reis 1", note: "Tiger prawns. Get the steak sandwich after." },
  { kind: "place", name: "Alfama Loop", category: "walking", note: "Roughly 5km, mostly downhill after the castle." },
  { kind: "place", name: "Euro · EUR", category: "currency", note: "≈ 1 USD = 0.92 EUR. Most tascas are cash only." },
  { kind: "day", n: 1, label: "Arrival & Aperitivo", notes: "Drop bags. Walk down to Bairro Alto. Sunset at Miradouro de São Pedro de Alcântara." },
  { kind: "day", n: 2, label: "The Long Walk", notes: "Coffee at Hello Kristof. Tile museum. Lunch at Time Out Market. Nap. Fado in Alfama after dark." },
  { kind: "place", name: "Museu Nacional do Azulejo", category: "see" },
  { kind: "quote", text: "Everything is worthwhile if the soul is not small.", attribution: "Pessoa" },
  { kind: "day", n: 3, label: "Slow Departure", notes: "Pastel from Manteigaria. LX Factory. Train to airport at four." },
  {
    kind: "flight",
    direction: "inbound",
    airline: "TAP Air Portugal",
    flightNumber: "TP203",
    confirmation: "DEF456",
    from: "LIS",
    to: "JFK",
    fromCity: "Lisbon",
    toCity: "New York",
    date: "Jun 14, 2026",
    departTime: "17:30",
    arriveTime: "20:15",
    passenger: "Jordan Rivera",
    note: "Window. Arrive same day NYC. Seat and boarding details not yet assigned.",
  },
  { kind: "note", text: "Tip the fado singers. Cash only at most tascas." },
];