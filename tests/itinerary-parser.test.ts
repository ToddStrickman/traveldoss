import { describe, expect, test } from "bun:test";
import {
  parseDropInWithMeta,
  suggestTripTitle,
} from "../src/lib/itinerary/parse";
import type { Block } from "../src/lib/skins/types";

/**
 * Regression tests for the local itinerary parser (the offline fallback
 * used when the AI gateway is unavailable). Each fixture is a real-world
 * "messy paste" pattern users have hit. We assert the parser still:
 *
 *  • picks the right destination from the first known place mention,
 *  • emits one `day` block per "Day N" — in order,
 *  • promotes each comma/sentence-separated stop into a `place`,
 *  • routes recognisable stops to the right loose category bucket
 *    (stay / eat / drink / see / other) so the UI's icon mapper has
 *    something coherent to work with even without AI enrichment.
 *
 * The AI parser (`parseItineraryAi`) is non-deterministic and costs
 * gateway credits per call, so it is NOT exercised here. Its system
 * prompt is covered by snapshot review during prompt edits.
 */

type Place = Extract<Block, { kind: "place" }>;
type Day = Extract<Block, { kind: "day" }>;

function days(blocks: Block[]): Day[] {
  return blocks.filter((b): b is Day => b.kind === "day");
}
function places(blocks: Block[]): Place[] {
  return blocks.filter((b): b is Place => b.kind === "place");
}
function placeNames(blocks: Block[]): string[] {
  return places(blocks).map((p) => p.name.toLowerCase());
}
function hasPlaceMatching(blocks: Block[], re: RegExp): boolean {
  return places(blocks).some((p) => re.test(p.name));
}

/* ------------------------------------------------------------------ */
/* Fixture 1 — ChatGPT-style multi-day Italy paste                     */
/* ------------------------------------------------------------------ */

describe("parser: ChatGPT-style Tuscany paste", () => {
  const raw = `
    Five days in Tuscany, mostly Florence + a day in Siena.
    Day 1: arrive Florence, check into Hotel Lungarno, sunset aperitivo on the Arno.
    Day 2: Uffizi Gallery in the morning, lunch at All'Antico Vinaio, Boboli Gardens.
    Day 3: train to Siena, walk the Piazza del Campo, dinner at Osteria Le Logge.
    Day 4: wine tasting in Chianti, drive back to Florence, cocktails at Locale.
    Day 5: Duomo climb, last gelato at Vivoli, taxi to airport.
  `;

  const parsed = parseDropInWithMeta(raw);

  test("recognises the destination region", () => {
    expect(parsed.destination).not.toBeNull();
    expect(parsed.destination!).toMatch(/italy|tuscany/i);
  });

  test("emits one day block per Day N, in order", () => {
    const ns = days(parsed.blocks).map((d) => d.n);
    expect(ns).toEqual([1, 2, 3, 4, 5]);
  });

  test("captures the hotel as an accommodation-style stop", () => {
    const hotel = places(parsed.blocks).find((p) =>
      /hotel lungarno/i.test(p.name),
    );
    expect(hotel).toBeDefined();
    expect(hotel!.category).toBe("stay");
  });

  test("captures dining stops with the eat category", () => {
    const vinaio = places(parsed.blocks).find((p) =>
      /vinaio/i.test(p.name),
    );
    expect(vinaio?.category).toBe("eat");
    const logge = places(parsed.blocks).find((p) => /le logge/i.test(p.name));
    expect(logge?.category).toBe("eat");
  });

  test("captures cultural sights with the see category", () => {
    expect(
      places(parsed.blocks).find((p) => /uffizi/i.test(p.name))?.category,
    ).toBe("see");
    expect(
      places(parsed.blocks).find((p) => /boboli/i.test(p.name))?.category,
    ).toBe("see");
  });

  test("captures a drink stop with the drink category", () => {
    const cocktails = places(parsed.blocks).find((p) =>
      /cocktails at locale/i.test(p.name),
    );
    expect(cocktails?.category).toBe("drink");
  });
});

/* ------------------------------------------------------------------ */
/* Fixture 2 — Japan multi-day paste                                   */
/* ------------------------------------------------------------------ */

describe("parser: messy Japan notes paste", () => {
  const raw = [
    "Tokyo + Kyoto, eight days in late October.",
    "Day 1: land at Haneda, taxi to the hotel, ramen at Ichiran for the first meal",
    "Day 2: TeamLab Planets, lunch at a casual cafe, Shibuya crossing at dusk",
    "Day 3: shinkansen to Kyoto, check into Hoshinoya Kyoto, walk Pontocho",
    "Day 4: tea ceremony in the morning, temple visit, kaiseki at Kikunoi",
    "Day 5: bullet train to Nara to see the deer, back to Kyoto",
    "Day 6: walk the Philosopher's Path, beer at a kissaten",
    "Day 7: shinkansen back to Tokyo, cocktails in Golden Gai",
    "Day 8: fly home from Narita",
  ].join("\n");

  const parsed = parseDropInWithMeta(raw);

  test("destination is Japan", () => {
    expect(parsed.destination).toMatch(/japan/i);
  });

  test("all 8 days present and ordered", () => {
    expect(days(parsed.blocks).map((d) => d.n)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  test("named hotel routes to the stay bucket", () => {
    const hoshinoya = places(parsed.blocks).find((p) =>
      /hoshinoya/i.test(p.name),
    );
    expect(hoshinoya?.category).toBe("stay");
    // "taxi to the hotel" should at least register the word hotel → stay.
    const taxiHotel = places(parsed.blocks).find((p) =>
      /taxi to the hotel/i.test(p.name),
    );
    expect(taxiHotel?.category).toBe("stay");
  });

  test("dining stops with eat keywords route to the eat bucket", () => {
    // "casual cafe" → eat via the `cafe` keyword in guessCategory.
    expect(
      places(parsed.blocks).find((p) => /casual cafe/i.test(p.name))?.category,
    ).toBe("eat");
  });

  test("cultural / sight stops with visit-keywords route to see", () => {
    expect(
      places(parsed.blocks).find((p) => /temple visit/i.test(p.name))
        ?.category,
    ).toBe("see");
    expect(
      places(parsed.blocks).find((p) => /deer/i.test(p.name))?.category,
    ).toBe("see");
  });

  test("cocktail/wine/coffee stops route to drink", () => {
    expect(
      places(parsed.blocks).find((p) => /golden gai/i.test(p.name))?.category,
    ).toBe("drink");
  });

  test("DOCUMENTED QUIRK: single-clause days fold their only stop into the day label", () => {
    // 'Day 8: fly home from Narita' has no commas, so the lone clause
    // is promoted to the day's label and no place block is emitted.
    // The AI parser handles richer structure; the offline parser pins
    // this behavior so a future refactor is intentional.
    const day8 = days(parsed.blocks).find((d) => d.n === 8);
    expect(day8?.label.toLowerCase()).toContain("fly home");
    const day8Names = places(parsed.blocks).filter((p) =>
      /narita/i.test(p.name),
    );
    expect(day8Names.length).toBe(0);
  });

  test("DOCUMENTED QUIRK: stops without category keywords fall back to 'other'", () => {
    // 'Ramen at Ichiran for the first meal' has no eat keyword like
    // breakfast/lunch/dinner/cafe — only the word 'ramen'. The offline
    // parser routes it to 'other'. AI enrichment normalises this.
    expect(
      places(parsed.blocks).find((p) => /ichiran/i.test(p.name))?.category,
    ).toBe("other");
    expect(
      places(parsed.blocks).find((p) => /shibuya crossing/i.test(p.name))
        ?.category,
    ).toBe("other");
  });
});

/* ------------------------------------------------------------------ */
/* Fixture 3 — Voice-transcript style (one long run-on line)           */
/* ------------------------------------------------------------------ */

describe("parser: voice-transcript Lisbon run-on", () => {
  // Commas matter — the parser splits stops on `,` and `.`. A real
  // transcript paste with no punctuation degrades gracefully into
  // one big "day label" per Day N; that path is covered separately.
  const raw =
    "Lisbon trip. day 1 land in Lisbon, check into Memmo Alfama, dinner somewhere in Alfama. " +
    "day 2 tram 28, walk Bairro Alto, coffee at A Brasileira. " +
    "day 3 train to Sintra, Pena Palace, lunch at Tascantiga, back to Lisbon.";

  const parsed = parseDropInWithMeta(raw, "transcript");

  test("inline 'day N' tokens still split into day blocks", () => {
    expect(days(parsed.blocks).map((d) => d.n)).toEqual([1, 2, 3]);
  });

  test("destination is Portugal/Lisbon", () => {
    expect(parsed.destination).toMatch(/portugal|lisbon/i);
  });

  test("the hotel is captured and tagged as stay", () => {
    expect(hasPlaceMatching(parsed.blocks, /memmo alfama/i)).toBe(true);
    const stay = places(parsed.blocks).find((p) =>
      /memmo|check into/i.test(p.name),
    );
    expect(stay?.category).toBe("stay");
  });

  test("DOCUMENTED QUIRK: the day-3 transit clause becomes the day label", () => {
    // Day 3's first clause 'train to Sintra' is ≤48 chars, so it is
    // promoted to the day label rather than emitted as a transit place.
    // The remaining clauses (Pena Palace, Tascantiga, back to Lisbon)
    // are emitted as places.
    const day3 = days(parsed.blocks).find((d) => d.n === 3);
    expect(day3?.label.toLowerCase()).toContain("train to sintra");
    expect(hasPlaceMatching(parsed.blocks, /pena palace/i)).toBe(true);
  });

  test("named restaurants survive the run-on split", () => {
    const names = placeNames(parsed.blocks).join(" | ");
    expect(names).toMatch(/tascantiga/);
  });

  test("a coffee stop routes to drink", () => {
    const coffee = places(parsed.blocks).find((p) =>
      /a brasileira/i.test(p.name),
    );
    expect(coffee?.category).toBe("drink");
  });
});

/* ------------------------------------------------------------------ */
/* Fixture 4 — Pre-amble note before any "Day N"                       */
/* ------------------------------------------------------------------ */

describe("parser: free-prose preamble", () => {
  const raw = `
    Couples trip, slow pace, no early mornings. Budget for one splurge dinner.
    Day 1: arrive Barcelona, walk the Gothic Quarter, tapas at Quimet & Quimet.
    Day 2: Sagrada Familia, beach, dinner at Disfrutar.
  `;

  const parsed = parseDropInWithMeta(raw);

  test("preamble is preserved as a paragraph block before the days", () => {
    const first = parsed.blocks[0];
    expect(first.kind).toBe("paragraph");
    if (first.kind === "paragraph") {
      expect(first.text.toLowerCase()).toContain("slow pace");
    }
  });

  test("destination is Spain/Barcelona despite the preamble", () => {
    expect(parsed.destination).toMatch(/spain|barcelona/i);
  });

  test("Gothic Quarter area registers as a place", () => {
    expect(hasPlaceMatching(parsed.blocks, /gothic quarter/i)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Fixture 5 — suggestTripTitle convenience helper                     */
/* ------------------------------------------------------------------ */

describe("suggestTripTitle", () => {
  test("returns null for inputs with no recognisable place", () => {
    expect(suggestTripTitle("just some thoughts about a trip maybe")).toBeNull();
  });

  test("composes a 'Place Vibe' title for known destinations", () => {
    const title = suggestTripTitle(
      "wine tasting in Tuscany, charcuterie, truffle hunt",
    );
    expect(title).not.toBeNull();
    expect(title!).toMatch(/italy|tasting/i);
    expect(title!.length).toBeLessThanOrEqual(24);
  });

  test("ignores Day-N preamble when picking the destination", () => {
    const title = suggestTripTitle(
      "Day 1: fly. Day 2: explore. Day 3: Kyoto temples.",
    );
    expect(title).toMatch(/japan/i);
  });
});