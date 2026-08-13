import type { GuideDef } from "./types";

/**
 * Insider Guide № 02 — Crete. Editorial copy is preserved verbatim from the
 * founder-approved source; "verify before publish" notes live in
 * docs/guides-verification.md, never in rendered content.
 */
export const crete: GuideDef = {
  slug: "crete",
  destination: "Crete",
  title: "Crete: The Insider Guide",
  seoTitle: "Crete Itinerary — 6 Days: The Insider Guide | TravelDoss",
  dek: "Greece's great food island — and the wild west is its kitchen.",
  metaDescription:
    "A 6-day Crete itinerary: Chania's food scene, Balos and Elafonisi, the roadless south coast and Peza wine country — plus where to stay and when to go.",
  days: "6 days",
  season: "April–June · September–October",
  no: "№ 02",
  chips: ["6 days", "Food-first", "Open-jaw"],
  skinId: "marcello",
  accent: "#FF9A62",
  lat: 35.3,
  lon: 24.5,
  publishedAt: "2026-08-13",
  updatedAt: "2026-08-13",
  published: true,
  faq: [
    {
      q: "How many days do you need in Crete?",
      a: "Six, done open-jaw (Chania in, Heraklion out): two for Chania and its food villages, two for the west's beaches, one for the south coast, one for wine country.",
    },
    {
      q: "What's the best part of Crete to stay in?",
      a: "The west — Chania and its coast — for food, beaches, and character. The Elounda resort strip east is a different (also valid) trip.",
    },
    {
      q: "When is the best time to visit Crete?",
      a: "May–June and September–October. The sea stays warm into October; July–August works only with dawn starts at the famous beaches.",
    },
  ],
  sources:
    "Sources: National Geographic (Chania food guide; Best of the World Food 2026), Eater (\"An Eater's Guide to Crete,\" 2024), travel.gr (Chania restaurants 2026), Indagare (Crete hotels), Condé Nast Traveller (Greek-islands hotels 2024; Readers' Choice 2025; beach picks), The Luxury Travel Expert (top Crete hotels), Luxury Travel Magazine (Elounda), AFAR (Chania), Greece Moments (Western Crete), The Boutique Vibe (Chania), Carpe Travel (Crete wine), Time Out Crete, Thrillist (2022), Marriott press (JW Crete, 2025).",
  blocks: [
    {
      kind: "hero",
      eyebrow: "Insider Guide № 02",
      title: "Crete: The Insider Guide",
      subtitle:
        "Greece's great food island — and the wild west is its kitchen.",
    },
    {
      kind: "paragraph",
      text: "National Geographic just named Crete one of the world's top food destinations for 2026, which locals will tell you is about forty years late. This guide takes the island the right way: land in Chania, eat outward from its Venetian harbor into farm villages and mountain gorges, hit the two famous beaches before the boats arrive, cross the roadless south coast by ferry, and finish in wine country outside Heraklion drinking grapes that exist nowhere else on earth. Fly out of Heraklion. Never backtrack.",
    },
    {
      kind: "paragraph",
      text: "Six days, open-jaw: Chania in, Heraklion out. The resort strip between them is somebody else's vacation.",
    },
    {
      kind: "day",
      n: 1,
      label: "Days 1–2 — Chania",
      notes:
        "Arguably Greece's best food town, wrapped around a 5,000-year-old harbor. Day one is the old town; day two is the reason you came.",
    },
    {
      kind: "place",
      name: "Venetian Harbour and the back alleys of Splanzia",
      time: "Morning",
      category: "walk",
      note: "Early morning, before the day-trippers, when the light is Venetian and the streets are yours.",
    },
    {
      kind: "place",
      name: "Iordanis",
      time: "Morning",
      category: "restaurant",
      note: "A century-old shop that makes one thing: bougatsa with pichtogalo Chanion, the local PDO cheese. Breakfast, from the oven.",
    },
    {
      kind: "place",
      name: "Tabakaria",
      time: "Lunch",
      category: "culture",
      note: "The ruined tannery quarter east of the port. Lunch at Thalassino Ageri, catch-of-the-day fish where the leather workshops used to be.",
    },
    {
      kind: "place",
      name: "Red Jane",
      time: "Morning, day two",
      category: "restaurant",
      note: "Sourdough bakery built into an abandoned interwar foundry. Worth it for the building alone; the bread settles the argument.",
    },
    {
      kind: "place",
      name: "Day 2 inland food loop",
      time: "Lunch",
      category: "restaurant",
      note: "Drive the plane-tree gorge road to Theriso (rebel-history village; antikristo lamb at Taverna Antartis), then Dounias in Drakona — a farm-taverna where everything is cooked over live fire from its own land. The fried potatoes have a reputation that crosses oceans. Reserve; go for lunch; drive it in daylight. Finish at Manousakis Winery in Vatolakkos.",
    },
    {
      kind: "place",
      name: "Dinner options that end arguments",
      time: "Dinner",
      category: "restaurant",
      note: "Chrisostomos (the benchmark Cretan kitchen — tsigariasto lamb, snails, wood oven), Tamam (rabbit in sweet wine inside a 15th-century bathhouse), Salis on the harbor (the modern take), or Maiami — a brasserie-gallery where the artist serves lemon-feta pasta on ceramics she made herself.",
    },
    {
      kind: "place",
      name: "Minoos Street farmers' market",
      time: "Saturday",
      category: "culture",
      tier: "shadow",
      note: "Saturday? Wild greens, mountain tea, graviera from the producer. Buy the olive oil. Check the bag weight limit later.",
    },
    {
      kind: "day",
      n: 3,
      label: "Day 3 — The Northwest",
    },
    {
      kind: "place",
      name: "Balos Lagoon",
      time: "Morning",
      category: "walk",
      note: "The turquoise sweep everyone has seen a photo of. Two ways in: the early boat from Kissamos, or the gravel toll road and a walk down. Either way, be there before 10am; by noon it's a franchise.",
    },
    {
      kind: "place",
      name: "Falassarna",
      time: "Late afternoon",
      category: "walk",
      note: "For the second act — a kilometer of golden sand, the clearest water on the island, and the sunset that ends the day properly.",
    },
    {
      kind: "place",
      name: "Komolithi clay pyramids",
      time: "Golden hour",
      category: "culture",
      tier: "shadow",
      note: "Detour if time allows: at Potamida — fifteen meters of eroded moonscape, usually empty.",
    },
    {
      kind: "day",
      n: 4,
      label: "Day 4 — The Southwest",
    },
    {
      kind: "place",
      name: "Elafonisi at opening",
      time: "Dawn start",
      category: "walk",
      note: "Pink sand, a wadeable lagoon, and Crete's second-biggest crowd after Knossos — the entire experience depends on beating it. Before 9am it's a nature reserve; after 11 it's a parking problem.",
    },
    {
      kind: "place",
      name: "Chrysoskalitissa Monastery",
      time: "Midday",
      category: "culture",
      note: "On the cliff above, and the Voulolimni rock pool nearby — a natural saltwater pool most Elafonisi traffic drives straight past.",
    },
    {
      kind: "place",
      name: "Overnight in Paleochora",
      time: "Evening",
      category: "accommodation",
      note: "A south-coast town mass tourism forgot, tamarisk trees over the beach. Gyaliskari, just east, is the local's Elafonisi. No queue.",
    },
    {
      kind: "day",
      n: 5,
      label: "Day 5 — The South Coast",
      notes: "The south coast has no through-road. That's the feature.",
    },
    {
      kind: "place",
      name: "Option A, the classic: Samaria Gorge",
      time: "7am start",
      category: "walk",
      note: "16km down Europe's longest gorge, 7am start, exit at Agia Roumeli and leave by ferry. In July–August you'll share it with 4,000 people; in shoulder season it's a cathedral.",
    },
    {
      kind: "place",
      name: "Option B, the insider's day: coast ferry to Loutro",
      time: "Morning",
      category: "transit",
      note: "Skip the gorge. Ferry from Paleochora or Chora Sfakion along the coast, stop at Loutro — a white hamlet reachable only by boat or on foot — for a swim and a photograph, then onward. Have lunch elsewhere; Loutro's beauty has outpaced its kitchens. Sfakia's reward is sfakiani pita — thin cheese pie with honey — eaten where it was invented.",
    },
    {
      kind: "place",
      name: "Overnight Chora Sfakion",
      time: "Evening",
      category: "accommodation",
      note: "Or drive back through the mountains to Chania.",
    },
    {
      kind: "day",
      n: 6,
      label: "Day 6 — Wine Country and Out",
      notes:
        "Drive east to Heraklion (~2.5 hours), then twenty minutes south into the Peza and Archanes valleys — the oldest wine country in Europe, working grapes the rest of the world forgot: Vidiano, Liatiko, Kotsifali, Plyto.",
    },
    {
      kind: "place",
      name: "Lyrarakis",
      time: "Late morning",
      category: "restaurant",
      note: "The family that rescued two varieties from extinction. Tastings under the pergola.",
    },
    {
      kind: "place",
      name: "Domaine Paterianakis",
      time: "Midday",
      category: "restaurant",
      note: "Sisters-run, organic, terrace over the vines.",
    },
    {
      kind: "place",
      name: "Knossos at opening or the Heraklion Archaeological Museum",
      time: "Midday",
      category: "culture",
      tier: "shadow",
      note: "If antiquity calls: Knossos at opening or the museum in the midday heat. The museum wins.",
    },
    {
      kind: "place",
      name: "Fly out of Heraklion",
      time: "Departure",
      category: "transit",
    },
    {
      kind: "note",
      text: "Where to stay — The flagship resorts are all east, around Elounda. This guide trades them for the west's landscapes — but the west's beds are better than its reputation. Chania Old Town: Casa Delfino — a 17th-century Venetian mansion, Indagare's pick, courtyard breakfast included in the argument. Ammos Hotel, ten minutes west on the sand, for design-hotel ease with kids or without. Resort softness without leaving the west: Domes Zeen, just south of Chania — Condé Nast Traveller's Greek-islands list. The JW Marriott Crete (opened 2025 on the Marathi peninsula) is the region's big new opening if brand comfort wins. The agrarian thread: Metohi Kindelis — a three-suite organic farm-stay inside Chania's orchards; pairs with the Dounias day like a set menu. Paleochora: simple rooms, sea sounds, no luxury stock — the charm is the point. Set expectations accordingly or take the south-coast night in Sfakia. Pre-flight, Heraklion side: ACRO Suites on the Agia Pelagia cliffs — Condé Nast Traveller Readers' Choice 2025 — twenty minutes from the airport and the wine valleys.",
    },
    {
      kind: "note",
      text: "The Elounda sidebar: if the trip ever becomes a resort trip, the east's heavyweights — Phāea Blue Palace (relaunched 2024), Elounda Beach, Elounda Peninsula, St Nicolas Bay — are where Crete's Readers' Choice hardware lives. Different trip, worth knowing.",
    },
    {
      kind: "note",
      text: "When to go — May–June and September–October, unanimously. Warm sea into October, crowds halved, White Mountains still snowcapped through May. July–August works only with dawn starts. Late February brings Chania's Carnival; October–January is olive-harvest season if the mills tempt you.",
    },
    {
      kind: "note",
      text: "The practical part — A car is non-negotiable, and the open-jaw rental (Chania in, Heraklion out) saves a half-day backtrack. Balos road is rough gravel — go slow, ignore the rental agreement's feelings. Mountain roads want daylight. Loutro has no road at all — plan the ferry times. Reserve Dounias, Chrisostomos, and Salis ahead in season. Goats have right of way, legally or not.",
    },
  ],
};
