import type { GuideDef } from "./types";

/**
 * Insider Guide № 06 — Japan's Golden Route. Editorial copy is preserved
 * verbatim from the founder-approved source; "verify before publish" notes
 * live in docs/guides-verification.md, never in rendered content.
 */
export const japanGoldenRoute: GuideDef = {
  slug: "japan-golden-route",
  destination: "Japan",
  title: "Japan's Golden Route: The Insider Guide",
  seoTitle: "Japan Golden Route Itinerary — 8 Days: The Insider Guide | TravelDoss",
  dek: "Tokyo to Kyoto, off-peak and off-axis.",
  metaDescription:
    "A Tokyo-to-Kyoto Golden Route itinerary run on an inverted clock: dawn shrines, shitamachi Tokyo, machiya Kyoto — plus where to stay and when to go.",
  days: "8 days",
  season: "Late October–December · January–February",
  no: "№ 06",
  chips: ["8 days", "Rail-first", "Momiji · winter light"],
  skinId: "shishu",
  accent: "#E8B44A",
  lat: 35.0,
  lon: 135.77,
  publishedAt: "2026-08-13",
  updatedAt: "2026-08-13",
  published: true,
  faq: [
    {
      q: "How many days do you need for Tokyo and Kyoto?",
      a: "Eight to ten: four in Tokyo, three in Kyoto, one day trip (Nara), and a travel day. Fewer than seven forces the checklist version of the trip.",
    },
    {
      q: "When is the best time to go?",
      a: "Late October–early December for autumn color; January–February for space and clarity. Sakura season is beautiful and doubles hotel prices — commit six months ahead or choose another window.",
    },
    {
      q: "Is the JR Pass worth it?",
      a: "For Tokyo + Kyoto alone, no — individual shinkansen tickets cost roughly half the pass. The pass only pays if you add Hiroshima or beyond within seven days.",
    },
  ],
  sources:
    "Sources: Time Out Tokyo (2026 list), Monocle (Tokyo \"city of villages\"), Roadbook Kyoto (2025), AFAR, Michelin Guide (Bird Land, Tempura Motoyoshi; Michelin Keys Japan 2025), Travel + Leisure (Trunk It List 2024), CNT Readers' Choice 2025 (Park Hyatt Kyoto), Inside Kyoto (JR Pass math), Magdalena Roze (Kyoto insider guide 2025).",
  blocks: [
    {
      kind: "hero",
      eyebrow: "Insider Guide № 06",
      title: "Japan's Golden Route: The Insider Guide",
      subtitle: "Tokyo to Kyoto, off-peak and off-axis.",
    },
    {
      kind: "paragraph",
      text: "Everyone runs the Golden Route. Almost nobody runs it diagonally: sleeping in the residential-edge neighborhoods where the cities actually live, hitting the marquee sights at seven in the morning or after five, and spending the saved hours in Tokyo's village streets and Kyoto's machiya bars. Same route. Inverted clock. That inversion is the entire difference between the trip everyone posts and the trip you'll actually remember.",
    },
    {
      kind: "paragraph",
      text: "Eight days: Tokyo four, Kyoto three, one day trip. Fly into Haneda if you can choose.",
    },
    {
      kind: "day",
      n: 1,
      label: "Days 1–2 — Tokyo West (base: Tomigaya / Yoyogi edge)",
      notes:
        "Sleep on Shibuya's quiet side — village Tokyo, ten minutes from the scramble you'll cross exactly once.",
    },
    {
      kind: "place",
      name: "Meiji Jingu",
      time: "Dawn",
      category: "culture",
      note: "The forest reset. Enter at 6–8am when the gravel is yours and the cedar torii still has mist on it.",
    },
    {
      kind: "place",
      name: "Tomigaya coffee crawl",
      time: "Morning",
      category: "restaurant",
      note: "The neighborhood that taught Tokyo third-wave.",
    },
    {
      kind: "place",
      name: "Shibuya proper",
      time: "Midday",
      category: "walk",
      note: "Cross the crossing, ascend nothing, leave. The insider move is knowing one visit is enough.",
    },
    {
      kind: "place",
      name: "Shimokitazawa by night",
      time: "Evening",
      category: "walk",
      note: "Vinyl listening bars, vintage dens, No Room for Squares with a whisky. This is the Tokyo the daytime tours never see.",
    },
    {
      kind: "day",
      n: 3,
      label: "Day 3 — Tokyo East (the shitamachi day)",
      notes:
        "The old low city along the river — the day aggregator itineraries always skip, and the one people thank you for.",
    },
    {
      kind: "place",
      name: "Yanaka",
      time: "Morning",
      category: "walk",
      note: "Pre-war lanes, temple cats, Kayaba Coffee (an 80-year-old kissaten; queue by 10) and Ueno Sakuragi Atari, three 1930s houses turned beer bar and bakery.",
    },
    {
      kind: "place",
      name: "Kuramae",
      time: "Afternoon",
      category: "walk",
      note: "Tokyo's craft quarter: leather, notebooks, Mia Mia café in a 120-year-old rice shop.",
    },
    {
      kind: "place",
      name: "Koganeyu sento",
      time: "Evening",
      category: "culture",
      note: "A tattoo-friendly public bath with a craft-beer taproom attached. End the day like a local ends theirs.",
    },
    {
      kind: "day",
      n: 4,
      label: "Day 4 — Ginza & Marunouchi",
    },
    {
      kind: "place",
      name: "Depachika",
      time: "Late morning",
      category: "restaurant",
      note: "The basement food halls of Mitsukoshi and Isetan. Assemble a picnic that outclasses most restaurants.",
    },
    {
      kind: "place",
      name: "Bird Land",
      time: "Dinner",
      category: "restaurant",
      note: "Michelin-starred yakitori under Ginza. Book about a month out.",
    },
    {
      kind: "place",
      name: "teamLab",
      category: "culture",
      tier: "shadow",
      note: "Only if you pre-booked; never as a walk-up. If you didn't, the Palace Hotel bar is the better evening.",
    },
    {
      kind: "day",
      n: 5,
      label: "Day 5 — Shinkansen → Kyoto (base: Nakagyo, not Gion)",
      notes:
        "The Nozomi does Tokyo–Kyoto in 2h15. Sleep in the merchant grid — Nakagyo or Sakyo — where Kyoto goes about its business; Gion after dark is a photo set with fine enforcement (the private alleys now carry ¥10,000 fines).",
    },
    {
      kind: "place",
      name: "Nishiki Market edges",
      time: "Before 10am",
      category: "walk",
      note: "At opening — and Aritsugu, forging knives since 1560.",
    },
    {
      kind: "place",
      name: "Weekenders Coffee",
      time: "Afternoon",
      category: "restaurant",
      note: "The parking-lot kissaten heir.",
    },
    {
      kind: "place",
      name: "Rocking Chair",
      time: "Night",
      category: "restaurant",
      note: "Kyoto cocktails in a converted machiya.",
    },
    {
      kind: "day",
      n: 6,
      label: "Day 6 — Kyoto North",
    },
    {
      kind: "place",
      name: "Daitoku-ji subtemples",
      time: "Morning",
      category: "culture",
      note: "The Zen gardens without Ryoan-ji's queue. Pick two, sit, stop optimizing.",
    },
    {
      kind: "place",
      name: "Nishijin",
      time: "Midday",
      category: "walk",
      note: "The weaving district's lanes and textile ateliers.",
    },
    {
      kind: "place",
      name: "Wife & Husband",
      time: "Afternoon",
      category: "restaurant",
      note: "Coffee, then picnic baskets by the Kamo River.",
    },
    {
      kind: "place",
      name: "Dupree",
      time: "Evening",
      category: "restaurant",
      note: "Natural wine in a renovated Sakyo home.",
    },
    {
      kind: "day",
      n: 7,
      label: "Day 7 — Higashiyama, inverted",
    },
    {
      kind: "place",
      name: "Fushimi Inari at 7am or the Philosopher's Path at dusk",
      category: "culture",
      note: "The two legal ways to have Kyoto's icons to yourself. Kiyomizu-dera opens at 6; be the person who knows that.",
    },
    {
      kind: "place",
      name: "POJ Studio",
      time: "Afternoon",
      category: "culture",
      note: "Kintsugi and serious craft to carry home.",
    },
    {
      kind: "place",
      name: "Monk",
      time: "Dinner (or breakfast)",
      category: "restaurant",
      note: "14 seats by the Philosopher's Path; books out in seconds two months ahead, noon JST. Win it or book Choshoku Kishin's breakfast kaiseki instead — the same reverence, an accessible reservation.",
    },
    {
      kind: "day",
      n: 8,
      label: "Day 8 — Nara, then home",
      notes:
        "45 minutes, no luggage gymnastics: Todai-ji's Great Buddha before 9am, deer bowing in the park, Kasuga Taisha's lantern corridors. Back to Kyoto by mid-afternoon.",
    },
    {
      kind: "place",
      name: "Hakone overnight",
      category: "accommodation",
      tier: "shadow",
      note: "Hakone? It works as an overnight between the cities — Gora Kadan holds three Michelin Keys — not as a day trip from either.",
    },
    {
      kind: "note",
      text: "Where to stay — Tokyo flagship: Palace Hotel Tokyo or Four Seasons Otemachi — both hold three Michelin Keys. Tokyo design pick: Trunk (Hotel) Yoyogi Park — T+L It List 2024, AHEAD Asia Hotel of the Year; park-facing infinity pool in this guide's own neighborhood. Kyoto flagship: Hotel The Mitsui (three Keys, onsen in the city center) or Park Hyatt Kyoto (readers' #1 hotel in Japan, CNT 2025). Kyoto character/value: Ace Hotel Kyoto (Kengo Kuma conversion) or Maana Kiyomizu machiya suites.",
    },
    {
      kind: "note",
      text: "When to go — Late October–early December for color — Kyoto's most beautiful and most crowded non-sakura window; book four to six months out. Cherry blossom (late March–early April) is the most expensive, most crowded fortnight of the year — go only with six months' lead, or take February's plum blossoms and empty temples instead. January–February and June are the honest sweet spots.",
    },
    {
      kind: "note",
      text: "The practical part — Skip the JR Pass. At ¥50,000 for seven days, you'd need nearly two Tokyo–Kyoto round trips to break even — buy point-to-point Nozomi tickets via SmartEX (~¥14,000 each way). Suica on your phone for everything else. Reserve the big tables (Bird Land, Monk) when you book flights. Cash still matters at kissaten and shrines.",
    },
  ],
};
