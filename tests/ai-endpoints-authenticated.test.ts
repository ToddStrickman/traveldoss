/**
 * Tripwire — every server function that spends money must be authenticated.
 *
 * These five endpoints call the Lovable AI gateway, Google Places, and/or
 * Firecrawl. They shipped unauthenticated once already: an anonymous POST to
 * `hardenItineraryAi` costs roughly $3 (three refine passes, each a full AI
 * parse plus up to PER_RUN_CAP=24 Places lookups). Without a gate that is
 * unbounded spend at zero revenue.
 *
 * Reads the source tree with node:fs rather than shelling out to `rg` — the
 * sibling guard in no-orientation-listeners.test.ts swallows a missing-binary
 * error as a pass, so those assertions are vacuous on machines without
 * ripgrep. Everything here fails loudly instead: a missing or renamed file is
 * an error, never a silent green.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** file → the exported server fn that must carry the auth middleware. */
const SPENDING_ENDPOINTS: Array<{ file: string; fn: string; spends: string }> = [
  {
    file: "src/lib/itinerary/generate.functions.ts",
    fn: "generateItineraryAi",
    spends: "AI gateway (1–14 model calls) + Firecrawl via nested research",
  },
  {
    file: "src/lib/itinerary/parse-ai.functions.ts",
    fn: "parseItineraryAi",
    spends: "AI gateway + up to 24 Google Places lookups",
  },
  {
    file: "src/lib/itinerary/refine.functions.ts",
    fn: "refineItineraryAi",
    spends: "AI gateway + Google Places (via parse)",
  },
  {
    file: "src/lib/itinerary/harden.functions.ts",
    fn: "hardenItineraryAi",
    spends: "3x refine ≈ $3/press — the single most expensive call",
  },
  {
    file: "src/lib/itinerary/research.functions.ts",
    fn: "researchDestination",
    spends: "Firecrawl (up to 16 scraped pages)",
  },
];

function read(file: string): string {
  // Throws if the file is missing or renamed — that must fail the suite,
  // not silently pass.
  return readFileSync(resolve(process.cwd(), file), "utf8");
}

describe("money-spending server functions are authenticated", () => {
  for (const { file, fn, spends } of SPENDING_ENDPOINTS) {
    it(`${fn} requires auth (spends: ${spends})`, () => {
      const src = read(file);

      const declIndex = src.indexOf(`export const ${fn} = createServerFn(`);
      expect(
        declIndex,
        `${file} no longer exports a createServerFn named '${fn}'. If it was ` +
          `renamed or removed, update this tripwire deliberately.`,
      ).toBeGreaterThan(-1);

      // Inspect only the builder chain: declaration → first `.handler(`.
      const handlerIndex = src.indexOf(".handler(", declIndex);
      expect(handlerIndex, `${fn} has no .handler()`).toBeGreaterThan(declIndex);
      const chain = src.slice(declIndex, handlerIndex);

      expect(
        chain.includes("requireSupabaseAuth"),
        `${fn} in ${file} is missing .middleware([requireSupabaseAuth]). It ` +
          `spends real money (${spends}) and would be callable by anyone who ` +
          `knows its server-function id.`,
      ).toBe(true);
    });
  }

  it("server-to-server callers use *Core helpers, never the wrapped server fn", () => {
    // Calling a wrapped server fn from server code runs its *client* middleware
    // chain; attachSupabaseAuth reads the session from localStorage, which is
    // undefined on the server, so no Bearer header is attached and
    // requireSupabaseAuth rejects. These callers must use the core functions.
    const cases: Array<{ file: string; mustNotCall: string; mustCall: string }> = [
      {
        file: "src/lib/itinerary/harden.functions.ts",
        mustNotCall: "refineItineraryAi({",
        mustCall: "refineItineraryAiCore(",
      },
      {
        file: "src/lib/itinerary/refine.functions.ts",
        mustNotCall: "parseItineraryAi({",
        mustCall: "parseItineraryAiCore(",
      },
      {
        file: "src/lib/itinerary/generate.functions.ts",
        mustNotCall: "researchDestination({",
        mustCall: "researchDestinationCore(",
      },
      {
        file: "src/lib/gmail-import.functions.ts",
        mustNotCall: "parseItineraryAi({",
        mustCall: "parseItineraryAiCore(",
      },
    ];

    for (const { file, mustNotCall, mustCall } of cases) {
      const src = read(file);
      expect(
        src.includes(mustCall),
        `${file} should call ${mustCall} for its server-to-server hop.`,
      ).toBe(true);
      expect(
        src.includes(mustNotCall),
        `${file} calls the wrapped server fn (${mustNotCall}) from server ` +
          `code. That routes through the client middleware path, which has no ` +
          `session on the server, so the nested call will fail auth. Use ` +
          `${mustCall} instead.`,
      ).toBe(false);
    }
  });
});
