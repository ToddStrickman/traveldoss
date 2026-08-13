import type { GuideDef } from "./types";

/**
 * Insider Guide № 07 — Amalfi Coast. Editorial copy is preserved verbatim from
 * the founder-approved source; "verify before publish" notes live in
 * docs/guides-verification.md, never in rendered content.
 */
export const amalfiCoast: GuideDef = {
  slug: "amalfi-coast",
  destination: "Amalfi Coast",
  title: "Amalfi Coast: The Insider Guide",
  seoTitle: "Amalfi Coast Itinerary — 6 Days: The Insider Guide | TravelDoss",
  dek: "The most beautiful traffic jam in Europe — and how to never sit in it.",
  metaDescription:
    "A 6-day Amalfi Coast itinerary: one base, ferries as the road, the boat day, Path of the Gods and Capri done right — plus where to stay and when to go.",
  days: "6 days",
  season: "May–June · late September",
  no: "№ 07",
  chips: ["6 days", "Boat-first", "May–Jun · Sept"],
  skinId: "marcello",
  accent: "#F7DC6F",
  lat: 40.63,
  lon: 14.6,
  publishedAt: "2026-08-13",
  updatedAt: "2026-08-13",
  published: true,
  faq: [
    {
      q: "What's the best town to stay in on the Amalfi Coast?",
      a: "First trip: Positano. Repeat visits or better value: Praiano — central, quiet, sunset-facing. Ravello for culture and cool air over beach access.",
    },
    {
      q: "How many days do you need?",
      a: "Five to six nights, one base. Under four and you're commuting between transfers.",
    },
    {
      q: "Is Capri worth it?",
      a: "Yes — early by private boat or with an overnight. The midday group day trip is the one version of Capri everyone regrets.",
    },
  ],
  sources:
    "Sources: Porter/Net-a-Porter (2025 coast guide), Italy Segreta (local's guide), Peter Jon Lindberg, AFAR (best hotels '24–25), Michelin Guide (Alici, Glicine, Rossellinis; Michelin Keys), Earth Trekkers (Path of the Gods '26), Italy on Foot (Capri '26), The Road Reel ('26), A Luxury Travel Blog (September case).",
  blocks: [
    {
      kind: "hero",
      eyebrow: "Insider Guide № 07",
      title: "Amalfi Coast: The Insider Guide",
      subtitle:
        "The most beautiful traffic jam in Europe — and how to never sit in it.",
    },
    {
      kind: "paragraph",
      text: "The Amalfi Coast has no secrets left, only sequencing. The people who love it come in shoulder season, base once and stay put, treat the sea as their highway, and spend their money where the coast is still itself — Praiano, Atrani, Cetara — instead of queuing in Positano at noon. The coast rewards people who move by water and eat where the fishermen still work. This guide is that sequence.",
    },
    {
      kind: "paragraph",
      text: "Six days, one base. May–June or September–October. The ferry is the road.",
    },
    {
      kind: "note",
      text: "The base decision (make it once) — Positano if it's your first time and the postcard matters: walkable restaurants, the ferry dock, the amphitheater of pink houses. Praiano is the insider edit — midpoint on the coast, west-facing sunsets Positano never sees, half the price, zero coach tours. Ravello if you'd trade beach access for cool air and concerts. Do not hotel-hop; the coast punishes it with stairs and luggage.",
    },
    {
      kind: "day",
      n: 1,
      label: "Day 1 — Arrive by water",
      notes: "Naples → ferry (or driver). Evening passeggiata.",
    },
    {
      kind: "place",
      name: "Franco's Bar",
      time: "Sunset",
      category: "restaurant",
      note: "No reservations — join the queue at six. Or Praiano's Café Mirante with a lemon spritz locals pretend is a secret.",
    },
    {
      kind: "day",
      n: 2,
      label: "Day 2 — Positano, correctly",
    },
    {
      kind: "place",
      name: "The beachfront and Santa Maria Assunta before 9am",
      time: "Morning",
      category: "culture",
      note: "The only hours the town belongs to anyone.",
    },
    {
      kind: "place",
      name: "Fornillo Beach",
      time: "Midday",
      category: "walk",
      note: "The quieter cove a cliff-path away.",
    },
    {
      kind: "place",
      name: "Da Adolfo at Laurito",
      time: "Lunch",
      category: "restaurant",
      note: "Mozzarella grilled on lemon leaves, reached by the red-fish boat shuttle. Book weeks ahead; it's the hardest table on the coast.",
    },
    {
      kind: "place",
      name: "Sandal makers and Emporio Sirenuse",
      time: "Afternoon",
      category: "walk",
      note: "During siesta, when the streets thin.",
    },
    {
      kind: "day",
      n: 3,
      label: "Day 3 — The boat day (the day that justifies the trip)",
      notes:
        "Private charter west from 9am, before chop and crowds: the Furore fjord, the grottoes of Conca dei Marini, swim stops in water the color of bottle glass.",
    },
    {
      kind: "place",
      name: "Lo Scoglio",
      time: "Lunch",
      category: "restaurant",
      note: "Lunch by boat — spaghetti alla Nerano, sea urchin.",
    },
    {
      kind: "place",
      name: "La Tonnarella O' Bacchiss",
      time: "Lunch",
      category: "restaurant",
      tier: "shadow",
      note: "Plastic chairs on the sand, no reservations, perfect.",
    },
    {
      kind: "day",
      n: 4,
      label: "Day 4 — Ravello, then Atrani",
    },
    {
      kind: "place",
      name: "Villa Cimbrone's Terrazza dell'Infinito",
      time: "By 9am",
      category: "culture",
      note: "At opening, then Villa Rufolo.",
    },
    {
      kind: "place",
      name: "Ravello Festival",
      time: "Evening in summer",
      category: "event",
      tier: "shadow",
      note: "Long lunch; a concert if the calendar cooperates.",
    },
    {
      kind: "place",
      name: "Atrani",
      time: "Evening",
      category: "walk",
      note: "Descend via Atrani — Italy's smallest town, sixty seconds from Amalfi, zero coaches — for aperitivo and dinner at A'Paranza in its vaulted basement. Ferry home.",
    },
    {
      kind: "day",
      n: 5,
      label: "Day 5 — Path of the Gods",
    },
    {
      kind: "place",
      name: "Bomerano → Nocelle",
      time: "Start by 8am",
      category: "walk",
      note: "Downhill with the views in front of you. Finish with the 1,700 steps into Positano or the Nocelle bus, then earn the afternoon horizontal.",
    },
    {
      kind: "place",
      name: "Marisa Cuomo's cellar in Furore",
      time: "Detour",
      category: "restaurant",
      tier: "shadow",
      note: "Detour reward: wine grown on cliffs that shouldn't permit it.",
    },
    {
      kind: "day",
      n: 6,
      label: "Day 6 — The Capri verdict",
      notes:
        "Worth it — by private boat, early, or with one overnight. Never the 10-to-4 group day trip. Circle the island in morning light (Faraglioni, the grottoes), swim off Marina Piccola, lunch, and either leave by 4pm or stay the night to see the Piazzetta empty of day-trippers — the true insider move.",
    },
    {
      kind: "place",
      name: "Punta Carena lighthouse, Anacapri",
      time: "Sunset",
      category: "walk",
      tier: "shadow",
      note: "Where Capri itself watches the sunset.",
    },
    {
      kind: "note",
      text: "Skip list, said plainly: Amalfi town at midday (dip in for the Duomo and Amatruda paper, then out), the SITA bus after 10am in season, driving anything anywhere (€40–70/day parking and alternate-plate restrictions), and Positano's beachfront restaurants at dinner — Casa Mele and Da Vincenzo are where the town actually eats.",
    },
    {
      kind: "note",
      text: "Where to stay — Le Sirenuse, Positano — the flagship; World's 50 Best fixture, Michelin Keys, La Sponda by candlelight. Il San Pietro di Positano — Relais & Châteaux, cliff-lift to a private beach, starred Zass. Caruso, A Belmond Hotel, Ravello — the coast's most photographed infinity pool, 1,200 feet above the sea. Borgo Santandrea, Amalfi — the best new hardware (2022): Gio Ponti tiles, a rare sandy beach, starred Alici. Santa Caterina, Amalfi — family-run since 1904, starred Glicine, and the relative value among the greats. The Praiano plays: Casa Angelina (adults-only white-on-white) and seven-room Casa Privata — roughly half the Positano tariff, all of the coast. Price reality: peak-season entry rooms at the top four run €1,200–2,500+. Praiano cuts that in half; September cuts it again.",
    },
    {
      kind: "note",
      text: "When to go — Mid-May to mid-June and September to mid-October — warm sea (warmest in September), everything open, crowds survivable. July–August is 90°F stair-climbing at double the price. November–March the coast closes: hotels shut, ferries stop — don't build a trip then.",
    },
    {
      kind: "note",
      text: "The practical part — Ferries (Travelmar and friends) link Salerno–Amalfi–Positano–Capri April–October and beat every road option; the SITA bus is €2 and standing-room misery by 10am. No car. Book Da Adolfo, Lo Scoglio, and any starred room two to six weeks out in season. Pack shoes for stairs — the coast is a staircase with a sea view.",
    },
  ],
};
