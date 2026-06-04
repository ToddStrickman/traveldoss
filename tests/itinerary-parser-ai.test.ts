import { describe, expect, test } from "bun:test";

/**
 * AI parser regression suite. Skipped unless LOVABLE_API_KEY is set so
 * CI doesn't burn credits on every run. To execute locally:
 *
 *   LOVABLE_API_KEY=… bun test tests/itinerary-parser-ai.test.ts
 *
 * These assertions stress the reconstruction behaviour the system prompt
 * promises: chronological reordering, destination inference, per-day
 * structure, and a sub-0.85 confidence on any place the model recommends
 * rather than receives from the user.
 */

type AiResult = {
  destination: string | null;
  blocks: Array<{
    kind: string;
    n?: number;
    label?: string;
    name?: string;
    category?: string;
    confidence?: number;
  }>;
};

const HAS_KEY = !!process.env.LOVABLE_API_KEY;
const runOrSkip = HAS_KEY ? describe : describe.skip;

async function runParser(text: string): Promise<AiResult> {
  // Import lazily so the file can load even without the gateway helper
  // resolving its env at module init time.
  const mod = await import("../src/lib/itinerary/parse-ai.functions");
  const fn = mod.parseItineraryAi;
  // createServerFn returns a callable; invoke it directly in tests.
  return (await fn({ data: { text, source: "text" } })) as AiResult;
}

runOrSkip("AI parser: shuffled day order is renumbered chronologically", () => {
  const raw = `
    Day 3: Vatican Museums, dinner at Armando.
    Day 1: arrive Rome, Hotel Eden, gelato at Giolitti.
    Day 2: Colosseum, lunch at Roscioli.
  `;
  test(
    "days appear sequentially 1..N regardless of input order",
    async () => {
      const out = await runParser(raw);
      const days = out.blocks
        .filter((b) => b.kind === "day")
        .map((b) => b.n);
      expect(days.length).toBeGreaterThanOrEqual(3);
      // Strictly increasing.
      for (let i = 1; i < days.length; i++) {
        expect(days[i]!).toBeGreaterThan(days[i - 1]!);
      }
    },
    60_000,
  );
});

runOrSkip("AI parser: missing destination is inferred from body", () => {
  const raw = `
    Day 1: ramen at Ichiran, walk Shibuya, drinks in Golden Gai.
    Day 2: train to Kyoto, ryokan check-in, walk Pontocho.
    Day 3: temple visit, kaiseki, fly home.
  `;
  test(
    "destination is non-null and references Japan",
    async () => {
      const out = await runParser(raw);
      expect(out.destination).not.toBeNull();
      expect(out.destination!.toLowerCase()).toMatch(/japan|tokyo|kyoto/);
    },
    60_000,
  );
});

runOrSkip("AI parser: missing dates still produce structured days with categories", () => {
  const raw = `
    Quick Rome trip, no fixed dates yet.
    Day 1: arrive, drop bags at Hotel Eden, gelato at Giolitti.
    Day 2: Colosseum tour, lunch at Roscioli.
    Day 3: Vatican Museums, dinner at Armando al Pantheon.
  `;
  test(
    "each day has at least one place; every place has a category",
    async () => {
      const out = await runParser(raw);
      const placeByDay: Record<number, number> = {};
      let current = 0;
      for (const b of out.blocks) {
        if (b.kind === "day" && typeof b.n === "number") {
          current = b.n;
          placeByDay[current] = 0;
        } else if (b.kind === "place" && current > 0) {
          placeByDay[current] = (placeByDay[current] ?? 0) + 1;
          expect(b.category ?? "").not.toBe("");
        }
      }
      for (const n of Object.keys(placeByDay).map(Number)) {
        expect(placeByDay[n]).toBeGreaterThan(0);
      }
    },
    60_000,
  );
});

runOrSkip("AI parser: AI-recommended places carry < 0.85 confidence", () => {
  // Only one named vendor ("Hotel Eden"). Everything else should be
  // reconstructed by the model and therefore flagged as low-confidence.
  const raw = `
    Three days in Rome. Day 1: arrive, Hotel Eden. Day 2: morning sightseeing,
    nice dinner. Day 3: museum, fly out.
  `;
  test(
    "at least one place block is below the 0.85 confidence threshold",
    async () => {
      const out = await runParser(raw);
      const places = out.blocks.filter((b) => b.kind === "place");
      expect(places.length).toBeGreaterThan(1);
      const lowConf = places.filter(
        (p) => typeof p.confidence === "number" && p.confidence < 0.85,
      );
      expect(lowConf.length).toBeGreaterThan(0);
    },
    60_000,
  );
});