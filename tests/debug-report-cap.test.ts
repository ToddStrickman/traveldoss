/**
 * Size cap for stored parser diagnostics (backend audit, 2026-08-31).
 *
 * `parse_debug_reports.report` was written straight from `z.any()` with no
 * ceiling: every retry carried the full raw model response, so one bad
 * 7-day parse could persist 150 KB. `capDebugReport` bounds each report
 * before insert without touching the summary fields the list view shows.
 */
import { describe, expect, test } from "bun:test";
import {
  capDebugReport,
  DEBUG_REPORT_LIMITS,
  type DebugReport,
} from "../src/lib/itinerary/debug-report";

function report(overrides: Partial<DebugReport> = {}): DebugReport {
  return {
    source: "parse-ai",
    createdAt: "2026-09-01T00:00:00.000Z",
    model: "test-model",
    outcome: "success-after-retry",
    attempts: [],
    ...overrides,
  };
}

describe("capDebugReport", () => {
  test("leaves a small report untouched", () => {
    const r = report({ attempts: [{ attempt: 1, rawResponse: "ok" }] });
    expect(capDebugReport(r)).toEqual(r);
  });

  test("truncates oversized raw responses and says so", () => {
    const big = "x".repeat(DEBUG_REPORT_LIMITS.maxRawResponseChars + 500);
    const out = capDebugReport(report({ attempts: [{ attempt: 1, rawResponse: big }] }));
    const raw = out.attempts[0].rawResponse;
    expect(raw.length).toBeLessThan(big.length);
    expect(raw.startsWith("x".repeat(DEBUG_REPORT_LIMITS.maxRawResponseChars))).toBe(true);
    expect(raw).toContain("[truncated 500 chars]");
  });

  test("keeps only the first N attempts", () => {
    const attempts = Array.from({ length: DEBUG_REPORT_LIMITS.maxAttempts + 3 }, (_, i) => ({
      attempt: i + 1,
      rawResponse: "r",
    }));
    const out = capDebugReport(report({ attempts }));
    expect(out.attempts).toHaveLength(DEBUG_REPORT_LIMITS.maxAttempts);
    expect(out.attempts[0].attempt).toBe(1);
  });

  test("drops parsed payloads before it drops the raw text when still too big", () => {
    const filler = "y".repeat(DEBUG_REPORT_LIMITS.maxRawResponseChars);
    // ~270 KB serialized: over budget on its own, so parsedJson goes first and
    // finalParsed must go too.
    const hugeParsed = { blocks: Array.from({ length: 10_000 }, (_, i) => ({ i, t: "abcdefghij" })) };
    const out = capDebugReport(
      report({
        attempts: [{ attempt: 1, rawResponse: filler, parsedJson: hugeParsed }],
        finalParsed: hugeParsed,
      }),
    );
    expect(out.attempts[0].parsedJson).toBeUndefined();
    expect(out.finalParsed).toBeUndefined();
    expect(out.attempts[0].rawResponse).toBe(filler);
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(DEBUG_REPORT_LIMITS.maxTotalChars);
  });

  test("does not mutate its input", () => {
    const big = "x".repeat(DEBUG_REPORT_LIMITS.maxRawResponseChars + 1);
    const r = report({ attempts: [{ attempt: 1, rawResponse: big }] });
    capDebugReport(r);
    expect(r.attempts[0].rawResponse).toBe(big);
  });
});
