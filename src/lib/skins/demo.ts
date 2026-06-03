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

/** Structured Lisbon demo. The new view engine reads this as:
 *  flights → preface (hotel + currency) → 3 days × {morning, afternoon, evening}
 *  with rich place metadata (address, phone, website, hours, reservation). */
export const DEMO_BLOCKS: Block[] = [
  // ---- Outbound flight ----
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

  // ---- Trip essentials (preface) ----
  {
    kind: "place",
    name: "Memmo Príncipe Real",
    category: "hotel",
    address: "Rua D. Pedro V 56, 1250-094 Lisboa",
    phone: "+351 21 901 6800",
    website: "https://www.memmohotels.com/principereal",
    hours: "Check-in 15:00 · Check-out 12:00",
    reservation: "Conf #MPR-44218 · 2 nights",
    note: "Quiet courtyard, rooftop bar.",
  },
  {
    kind: "place",
    name: "Euro · EUR",
    category: "currency",
    note: "≈ 1 USD = 0.92 EUR. Most tascas are cash only.",
  },

  // ============================================================
  // DAY 1
  // ============================================================
  {
    kind: "day",
    n: 1,
    label: "Arrival & Aperitivo",
    notes: "Land, drop bags, ease into the city. Sunset at the miradouro.",
  },
  { kind: "section", title: "Morning", partOfDay: "morning" },
  {
    kind: "place",
    name: "Taxi · Lisbon Airport → Príncipe Real",
    category: "do",
    time: "09:15",
    phone: "+351 21 811 9000",
    note: "Cooltra Taxi · ~€18 · 25 min",
  },
  {
    kind: "place",
    name: "Hello, Kristof",
    category: "eat",
    time: "10:30",
    address: "R. do Poço dos Negros 103",
    phone: "+351 21 802 0103",
    website: "https://hellokristof.com",
    hours: "Mon–Sun 09:00–18:00",
    note: "Flat white + carrot cake.",
  },
  { kind: "section", title: "Afternoon", partOfDay: "afternoon" },
  {
    kind: "place",
    name: "Lunch · Time Out Market",
    category: "eat",
    time: "13:00",
    address: "Av. 24 de Julho 49",
    website: "https://www.timeoutmarket.com/lisboa",
    hours: "10:00–24:00",
  },
  {
    kind: "place",
    name: "Walk · Príncipe Real → Bairro Alto",
    category: "walking",
    time: "15:00",
    note: "About 25 min. Stop at bookshop Ler Devagar if it's open.",
  },
  { kind: "section", title: "Evening", partOfDay: "evening" },
  {
    kind: "place",
    name: "Aperitivo · Pensão Amor",
    category: "drink",
    time: "19:00",
    address: "R. do Alecrim 19",
    phone: "+351 21 314 3399",
  },
  {
    kind: "place",
    name: "Dinner · Belcanto",
    category: "eat",
    time: "21:00",
    address: "Largo de São Carlos 10",
    phone: "+351 21 342 0607",
    website: "https://belcanto.pt",
    reservation: "Conf #BEL-882 · party of 2",
    note: "Tasting menu · jacket not required.",
  },

  // ============================================================
  // DAY 2
  // ============================================================
  {
    kind: "day",
    n: 2,
    label: "The Long Walk",
    notes: "Tile museum, market lunch, nap, fado after dark.",
  },
  { kind: "section", title: "Morning", partOfDay: "morning" },
  {
    kind: "place",
    name: "Museu Nacional do Azulejo",
    category: "see",
    time: "10:00",
    address: "R. Madre de Deus 4",
    phone: "+351 21 810 0340",
    website: "https://www.museudoazulejo.gov.pt",
    hours: "Tue–Sun 10:00–18:00 · closed Mon",
  },
  { kind: "section", title: "Afternoon", partOfDay: "afternoon" },
  {
    kind: "place",
    name: "Lunch · A Cevicheria",
    category: "eat",
    time: "13:30",
    address: "R. Dom Pedro V 129",
    phone: "+351 21 803 8815",
    note: "Walk-in only. Octopus tiradito.",
  },
  {
    kind: "place",
    name: "Castelo de São Jorge",
    category: "see",
    time: "16:00",
    address: "R. de Santa Cruz do Castelo",
    hours: "09:00–21:00",
  },
  { kind: "section", title: "Evening", partOfDay: "evening" },
  {
    kind: "place",
    name: "Fado · Mesa de Frades",
    category: "do",
    time: "21:30",
    address: "R. dos Remédios 139",
    phone: "+351 91 702 9436",
    reservation: "Conf #MDF-117 · two seatings",
  },

  // ============================================================
  // DAY 3
  // ============================================================
  {
    kind: "day",
    n: 3,
    label: "Slow Departure",
    notes: "Pastel from Manteigaria. LX Factory. Train to airport at four.",
  },
  { kind: "section", title: "Morning", partOfDay: "morning" },
  {
    kind: "place",
    name: "Pastéis · Manteigaria",
    category: "eat",
    time: "09:00",
    address: "R. do Loreto 2",
    hours: "08:00–24:00",
  },
  { kind: "section", title: "Afternoon", partOfDay: "afternoon" },
  {
    kind: "place",
    name: "LX Factory",
    category: "see",
    time: "13:00",
    address: "R. Rodrigues de Faria 103",
    note: "Lunch at A Praça. Browse Ler Devagar.",
  },
  {
    kind: "place",
    name: "Aerobus · Cais do Sodré → LIS",
    category: "do",
    time: "16:00",
    note: "€4 · 35 min · last stop is Terminal 1.",
  },
  { kind: "section", title: "Evening", partOfDay: "evening" },
  {
    kind: "place",
    name: "Airport · TAP check-in",
    category: "do",
    time: "17:30",
    note: "Skip kiosk; counters open 3h before departure.",
  },

  // ---- Inbound flight ----
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
    departTime: "20:30",
    arriveTime: "23:15",
    passenger: "Jordan Rivera",
    note: "Window. Arrive same day NYC.",
  },
];