import type { GuideDef } from "./types";

/**
 * Insider Guide № 08 — Lisbon. Editorial copy is preserved verbatim from the
 * founder-approved source; "verify before publish" notes live in
 * docs/guides-verification.md, never in rendered content.
 */
export const lisbon: GuideDef = {
  slug: "lisbon",
  destination: "Lisbon",
  displayName: "Lisbon Ahead of the Crowd",
  title: "Lisbon: The Insider Guide",
  seoTitle: "Lisbon Itinerary — 5 Days: The Insider Guide | TravelDoss",
  dek: "The city moved. The crowds haven't noticed yet.",
  metaDescription:
    "A 4-day Lisbon itinerary: Marvila, Príncipe Real and Campo de Ourique over the postcard core — plus the nata verdict, where to stay and the Sintra call.",
  days: "5 days",
  season: "May–June · September–October",
  no: "№ 08",
  chips: ["5 days", "Walkable", "Shoulder season"],
  skinId: "calliope",
  accent: "#6FB4E8",
  lat: 38.72,
  lon: -9.14,
  publishedAt: "2026-08-13",
  updatedAt: "2026-08-13",
  published: true,
  faq: [
    {
      q: "How many days do you need in Lisbon?",
      a: "Four full days for the city done this way; five with Sintra or Arrábida. Two days only covers the saturated core.",
    },
    {
      q: "Is Sintra worth it?",
      a: "Yes — midweek, first Pena slot pre-booked, or skip Pena for Monserrate and Regaleira. As a 10-to-4 summer swarm, no.",
    },
    {
      q: "What's the best neighborhood to stay in?",
      a: "The Príncipe Real–Chiado border: walkable, calm, alive. Campo de Ourique for a local-life week. Avoid Baixa ground-zero and steep Alfama with luggage.",
    },
  ],
  sources:
    "Sources: Time Out Lisboa (2026 restaurant list), Monocle (Lisbon guide), Eater-orbit + Ola Daniela (2025 booking intel), Michelin Guide Portugal 2026, AFAR + Indagare (Embaixada), The Mediterranean Insider (2025 hotel openings), Devour Tours (Marvila taprooms), Wonderful Wanderings / ET Food Voyage (nata testing), Lisbon Lounge (Santos Populares).",
  blocks: [
    {
      kind: "hero",
      eyebrow: "Insider Guide № 08",
      title: "Lisbon: The Insider Guide",
      subtitle: "The city moved. The crowds haven't noticed yet.",
    },
    {
      kind: "paragraph",
      text: "Lisbon past peak hype is a better city than Lisbon during it. While the tram-28 corridor performs itself for the cruise ships, the real life migrated: east to post-industrial Marvila's breweries and galleries, uphill to villagey Campo de Ourique, into the gardened calm of Príncipe Real, riverside to Alcântara. The premium move is simple — sleep and eat where lisboetas do, dip into the postcard core early and briefly, and get the day-trip call right. Five days. Real shoes. The hills are not a metaphor.",
    },
    {
      kind: "day",
      n: 1,
      label: "Day 1 — The core, early and briefly",
    },
    {
      kind: "place",
      name: "Alfama and the Castelo before 9am",
      time: "Dawn start",
      category: "walk",
      note: "The hour the old city is still a neighborhood. Miradouros, the Sé, laundry lines.",
    },
    {
      kind: "place",
      name: "O Velho Eurico",
      time: "Lunch",
      category: "restaurant",
      note: "The modern tasca that rebooted Lisbon lunch. No reservations culture; queue for the first seating.",
    },
    {
      kind: "place",
      name: "Chiado and Baixa after 5pm",
      time: "Late afternoon",
      category: "walk",
      note: "When the coaches leave.",
    },
    {
      kind: "place",
      name: "Fado in Mouraria",
      time: "Late night",
      category: "event",
      note: "A small house like Tasca do Chico, not a dinner show.",
    },
    {
      kind: "day",
      n: 2,
      label: "Day 2 — Príncipe Real & Santos",
    },
    {
      kind: "place",
      name: "Jardim do Príncipe Real & Embaixada",
      time: "Late morning",
      category: "walk",
      note: "Jardim do Príncipe Real and the Embaixada concept palace, plus the botanical garden next door.",
    },
    {
      kind: "place",
      name: "Manteigaria",
      time: "Any hour",
      category: "restaurant",
      note: "The nata verdict: Manteigaria beats Pastéis de Belém on the tart itself — crispier, hotter, no queue theater. Belém keeps the history; Aloma in Campo de Ourique is the local dark horse.",
    },
    {
      kind: "place",
      name: "Parra, then Prado or SEM",
      time: "Evening",
      category: "restaurant",
      note: "Parra in Santos for natural wine, then dinner at Prado (farm-to-table) or SEM (zero-waste tasting menu that doesn't price like one).",
    },
    {
      kind: "day",
      n: 3,
      label: "Day 3 — Marvila & the east",
    },
    {
      kind: "place",
      name: "Museu Nacional do Azulejo",
      time: "Morning",
      category: "culture",
      note: "The tile museum that explains every wall you've walked past.",
    },
    {
      kind: "place",
      name: "Marvila proper from mid-afternoon",
      time: "Afternoon → late",
      category: "walk",
      note: "This is a warehouse district that wakes late: Dois Corvos and Musa taprooms, the galleries on Rua do Açúcar, 8 Marvila's container yard, and Fábrica Braço de Prata — a former arms factory now a bookshop-bar-venue — by night. This is the Lisbon that hasn't been photographed to death.",
    },
    {
      kind: "day",
      n: 4,
      label: "Day 4 — Campo de Ourique to the river",
    },
    {
      kind: "place",
      name: "Mercado de Campo de Ourique",
      time: "Morning",
      category: "restaurant",
      note: "What Time Out Market was before the tour groups. Casa Fernando Pessoa, Prazeres Cemetery, and the trick nobody uses: board tram 28 at its empty Campo de Ourique terminus and ride it backwards.",
    },
    {
      kind: "place",
      name: "LX Factory",
      time: "Afternoon",
      category: "culture",
      note: "Under the bridge — Ler Devagar's book cathedral, rooftop vermouth at Rio Maravilha.",
    },
    {
      kind: "place",
      name: "Belém at 5pm",
      time: "Evening",
      category: "culture",
      note: "Monastery cloisters in gold light, no coaches. Dinner at Canalha, João Rodrigues' neighborhood-priced hit.",
    },
    {
      kind: "place",
      name: "Ponto Final",
      time: "Optional",
      category: "restaurant",
      tier: "shadow",
      note: "Alternative pilgrimage: the ferry to Cacilhas for Ponto Final — yellow chairs on the water's edge facing the whole city. Books out months ahead; the crossing itself is half the point.",
    },
    {
      kind: "day",
      n: 5,
      label: "Day 5 — The day-trip decision",
    },
    {
      kind: "place",
      name: "Sintra, done surgically",
      time: "Full day",
      category: "culture",
      note: "Midweek, Rossio train by 8:30, first timed slot at Pena — or the connoisseur's swap: skip Pena entirely for Monserrate and Quinta da Regaleira, near-empty and stranger. Piriquita travesseiros, out by 3pm.",
    },
    {
      kind: "place",
      name: "Arrábida",
      time: "Full day",
      category: "walk",
      tier: "shadow",
      note: "Or the contrarian call: 45 minutes to Portinho's white-sand coves, fried cuttlefish in Setúbal, Azeitão wine cellars. Closer, emptier, and better swimming than the Comporta pilgrimage (which deserves an overnight, not a day).",
    },
    {
      kind: "note",
      text: "Where to stay — Bairro Alto Hotel: Leading Hotels of the World, Souto de Moura renovation, on the Chiado hinge. The Ivens (Autograph): Chiado; a fixture on world's-best lists. Palácio Príncipe Real: 28-room garden palace in this guide's favorite neighborhood. MACAM (opened 2025): palace-plus-contemporary-art-museum hybrid on the Alcântara corridor; the new-opening story. Four Seasons Ritz: the grande dame, Gulbenkian-adjacent. Value: 1908 Lisboa — award-winning Art Nouveau in Intendente at half the price, in a genuinely local zone.",
    },
    {
      kind: "note",
      text: "When to go — May–June and September–October. July–August is hot and cruise-saturated; winter is mild, moody, and cheap. June is Santos Populares — the city's month-long party, peaking June 12–13: grilled sardines, basil pots, all-night street arraiais. Book far ahead and embrace it, or avoid mid-June entirely. There's no third option.",
    },
    {
      kind: "note",
      text: "The practical part — Lisbon is a cardio city — cobbles, 45-degree grades; use the funiculars and taxis strategically. Tram 28 at midday is a pickpocket-dense theme ride with hour-long queues: ride at 7am, board at the far terminus, or take tram 24 instead. Hot restaurants (Bar Alimentar, Canalha) book out weeks ahead; tascas are queue-not-book. The Gulbenkian's gardens are the city's best midday-heat escape.",
    },
  ],
};
