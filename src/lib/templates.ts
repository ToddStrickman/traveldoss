export type CrawlSource = "Gmail" | "Drive" | "Calendar" | "Maps" | "Photos" | "Contacts";

export type DocBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string };

export type Template = {
  id: string;
  title: string;
  subtitle: string;
  days: number;
  tone: string;
  accent: string; // hex hint for ember bar
  crawl: CrawlSource[];
  doc: DocBlock[];
};

const tpl = (
  id: string,
  title: string,
  subtitle: string,
  days: number,
  tone: string,
  accent: string,
  crawl: CrawlSource[],
  doc: DocBlock[],
): Template => ({ id, title, subtitle, days, tone, accent, crawl, doc });

const dayHeader = (n: number, label: string): DocBlock => ({
  kind: "heading",
  level: 2,
  text: `Day ${n} — ${label}`,
});

export const TEMPLATES: Template[] = [
  tpl(
    "weekend-city-break",
    "Weekend City Break",
    "Two nights, one city, zero excuses.",
    3,
    "Brisk · urban · café-led",
    "#8c2b1f",
    ["Gmail", "Maps", "Calendar"],
    [
      { kind: "heading", level: 1, text: "Weekend City Break" },
      { kind: "paragraph", text: "A loose sketch for a three-day reset. Add cafés, museums, and one unreasonable meal." },
      dayHeader(1, "Arrival & Wander"),
      { kind: "paragraph", text: "Drop bags. Walk the old quarter. Aperitivo at a corner bar. Early dinner." },
      dayHeader(2, "The Long Walk"),
      { kind: "paragraph", text: "Coffee. One museum. A market lunch. A park nap. A bookshop." },
      dayHeader(3, "Slow Departure"),
      { kind: "paragraph", text: "Pastry. The neighborhood you missed. Train at four." },
    ],
  ),
  tpl(
    "seven-day-road-trip",
    "7-Day Road Trip",
    "A week on the highway with seven good stops.",
    7,
    "Open road · diners · golden hour",
    "#a04428",
    ["Maps", "Gmail", "Photos"],
    [
      { kind: "heading", level: 1, text: "7-Day Road Trip" },
      { kind: "paragraph", text: "One car, seven nights, a playlist that earns its name." },
      ...Array.from({ length: 7 }, (_, i) => dayHeader(i + 1, `Leg ${i + 1}`)),
    ],
  ),
  tpl(
    "two-week-eurail",
    "Two-Week Eurail",
    "Fourteen days, six countries, one rail pass.",
    14,
    "Trains · platforms · pastries",
    "#3a5a40",
    ["Gmail", "Calendar", "Maps"],
    [
      { kind: "heading", level: 1, text: "Two-Week Eurail" },
      { kind: "paragraph", text: "Pin your trains here; the map will route the rest." },
      dayHeader(1, "Paris"),
      dayHeader(3, "Lyon"),
      dayHeader(5, "Geneva"),
      dayHeader(7, "Milan"),
      dayHeader(9, "Florence"),
      dayHeader(11, "Vienna"),
      dayHeader(13, "Berlin"),
    ],
  ),
  tpl(
    "honeymoon",
    "Honeymoon Itinerary",
    "Ten quiet days for two.",
    10,
    "Slow · linen · candlelight",
    "#7a2e3b",
    ["Gmail", "Drive", "Calendar"],
    [
      { kind: "heading", level: 1, text: "Honeymoon" },
      { kind: "paragraph", text: "Reservations, addresses, and the one restaurant you booked six months out." },
      dayHeader(1, "Arrival"),
      dayHeader(4, "The Coast"),
      dayHeader(7, "Inland Vineyard"),
      dayHeader(10, "Last Morning"),
    ],
  ),
  tpl(
    "family-beach",
    "Family Beach Holiday",
    "A week by the water with kids who notice everything.",
    7,
    "Salt · sunscreen · slow mornings",
    "#1e6091",
    ["Gmail", "Maps", "Photos"],
    [
      { kind: "heading", level: 1, text: "Family Beach Holiday" },
      { kind: "paragraph", text: "Pool, beach, ice cream, repeat. Plus one rainy-day plan." },
      ...Array.from({ length: 7 }, (_, i) => dayHeader(i + 1, `Beach Day ${i + 1}`)),
    ],
  ),
  tpl(
    "solo-backpacking",
    "Solo Backpacking Trail",
    "Three weeks, one backpack, no fixed plan.",
    21,
    "Hostels · buses · notebooks",
    "#5c4033",
    ["Maps", "Photos", "Contacts"],
    [
      { kind: "heading", level: 1, text: "Solo Backpacking" },
      { kind: "paragraph", text: "Write loose. The Doc is the plan; the plan can change at any bus station." },
      dayHeader(1, "Land & Hostel"),
      dayHeader(7, "Coast Week"),
      dayHeader(14, "Mountain Week"),
      dayHeader(21, "Last City"),
    ],
  ),
  tpl(
    "foodie-pilgrimage",
    "Foodie Pilgrimage",
    "Five days plotted around restaurants you wrote down a year ago.",
    5,
    "Counters · cellars · long lunches",
    "#b8860b",
    ["Gmail", "Maps", "Calendar"],
    [
      { kind: "heading", level: 1, text: "Foodie Pilgrimage" },
      { kind: "paragraph", text: "Every reservation, every walk-in. The map will route by neighborhood." },
      dayHeader(1, "Markets & Counters"),
      dayHeader(2, "The Tasting"),
      dayHeader(3, "Neighborhood Bars"),
      dayHeader(4, "The Big One"),
      dayHeader(5, "Bakery Goodbye"),
    ],
  ),
  tpl(
    "ski-week",
    "Ski Week",
    "Six days of lift tickets and one rest day.",
    7,
    "Snow · wax · fondue",
    "#264653",
    ["Gmail", "Drive", "Calendar"],
    [
      { kind: "heading", level: 1, text: "Ski Week" },
      { kind: "paragraph", text: "Chalet address, rental confirmation, lift pass codes." },
      ...Array.from({ length: 7 }, (_, i) => dayHeader(i + 1, i === 3 ? "Rest Day" : `Ski Day ${i < 3 ? i + 1 : i}`)),
    ],
  ),
  tpl(
    "safari-bush",
    "Safari + Bush",
    "Ten days of early mornings and long drives.",
    10,
    "Dust · binoculars · campfire",
    "#6a4423",
    ["Gmail", "Drive", "Photos"],
    [
      { kind: "heading", level: 1, text: "Safari + Bush" },
      { kind: "paragraph", text: "Camp confirmations, ranger contacts, charter flight times." },
      dayHeader(1, "Land in Nairobi"),
      dayHeader(3, "Masai Mara"),
      dayHeader(6, "Serengeti"),
      dayHeader(9, "Zanzibar Decompress"),
    ],
  ),
  tpl(
    "multi-city-conference",
    "Multi-City Conference Trip",
    "Four cities, three talks, one carry-on.",
    9,
    "Lanyards · lobbies · airport lounges",
    "#1a1a1a",
    ["Gmail", "Calendar", "Contacts"],
    [
      { kind: "heading", level: 1, text: "Multi-City Conference Trip" },
      { kind: "paragraph", text: "Flights, hotels, talk times. The Doc handles the rest." },
      dayHeader(1, "City A — Arrival"),
      dayHeader(3, "City B — Keynote"),
      dayHeader(5, "City C — Workshop"),
      dayHeader(8, "City D — Wrap"),
    ],
  ),
];

export const getTemplate = (id: string) => TEMPLATES.find((t) => t.id === id);