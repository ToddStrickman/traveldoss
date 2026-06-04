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
/* Fixture 2 — Japan bullet-list paste from a notes app                */
/* ------------------------------------------------------------------ */

describe("parser: messy Japan notes paste", () => {
  const raw = [
    "Tokyo + Kyoto 8 days, late October",
    "Day 1: land Haneda, taxi to hotel, dinner at Sushi Saito if we're lucky",
    "Day 2: TeamLab Planets, lunch ramen at Ichiran, Shibuya crossing at dusk",
    "Day 3: shinkansen to Kyoto, check into Hoshinoya Kyoto, walk Pontocho",
    "Day 4: Fushimi Inari at sunrise, tea ceremony, kaiseki dinner at Kikunoi",
    "Day 5: temple morning, train to Nara to see the deer, back to Kyoto",
    "Day 6: cycle the Philosopher's Path, lunch somewhere along Higashiyama",
    "Day 7: shinkansen back to Tokyo, last night drinks in Golden Gai",
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

  test("hotels (Hoshinoya, generic 'hotel') route to the stay bucket", () => {
    const hoshinoya = places(parsed.blocks).find((p) =>
      /hoshinoya/i.test(p.name),
    );
    expect(hoshinoya?.category).toBe("stay");
    // "taxi to hotel" should at least register the word hotel → stay.
    const taxiHotel = places(parsed.blocks).find((p) =>
      /taxi to hotel/i.test(p.name),
    );
    expect(taxiHotel?.category).toBe("stay");
  });

  test("named dining stops are recognised as eat", () => {
    expect(
      places(parsed.blocks).find((p) => /sushi saito/i.test(p.name))?.category,
    ).toBe("eat");
    expect(
      places(parsed.blocks).find((p) => /ichiran/i.test(p.name))?.category,
    ).toBe("eat");
    expect(
      places(parsed.blocks).find((p) => /kikunoi/i.test(p.name))?.category,
    ).toBe("eat");
  });

  test("cultural / sight stops are recognised as see", () => {
    expect(
      places(parsed.blocks).find((p) => /fushimi inari/i.test(p.name))
        ?.category,
    ).toBe("see");
    expect(
      places(parsed.blocks).find((p) => /deer/i.test(p.name))?.category,
    ).toBe("see");
  });

  test("a drink-heavy stop is recognised as drink", () => {
    expect(
      places(parsed.blocks).find((p) => /golden gai/i.test(p.name))?.category,
    ).toBe("drink");
  });

  test("every day has at least one place stop following it", () => {
    // Each Day block should be followed by ≥1 place before the next Day.
    const seq = parsed.blocks;
    for (let i = 0; i < seq.length; i++) {
      if (seq[i].kind !== "day") continue;
      let foundPlace = false;
      for (let j = i + 1; j < seq.length && seq[j].kind !== "day"; j++) {
        if (seq[j].kind === "place") {
          foundPlace = true;
          break;
        }
      }
      expect(foundPlace).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Fixture 3 — Voice-transcript style (one long run-on line)           */
/* ------------------------------------------------------------------ */

describe("parser: voice-transcript Lisbon run-on", () => {
  const raw =
    "ok so day 1 land in Lisbon check into Memmo Alfama have dinner somewhere in Alfama maybe Ramiro " +
    "day 2 tram 28 walk Bairro Alto coffee at Copenhagen Coffee Lab port tasting day 3 " +
    "train to Sintra Pena Palace lunch at Tascantiga back to Lisbon late dinner";

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

  test("a transit-flavoured stop ('train to Sintra') is captured as a place", () => {
    expect(hasPlaceMatching(parsed.blocks, /train to sintra/i)).toBe(true);
  });

  test("named restaurants survive the run-on split", () => {
    const names = placeNames(parsed.blocks).join(" | ");
    expect(names).toMatch(/ramiro/);
    expect(names).toMatch(/tascantiga/);
  });

  test("a coffee stop routes to drink", () => {
    const coffee = places(parsed.blocks).find((p) =>
      /copenhagen coffee/i.test(p.name),
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