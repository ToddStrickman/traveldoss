import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression test for the trip-list loading + error states that the user
 * sees after clicking the header wordmark and landing on the dashboard.
 *
 * We can't mount the React tree without a DOM testing harness in this
 * project, so we assert the structural contract directly on the source:
 *
 *   1. While `listTrips` is in flight, the dashboard renders the
 *      "Retrieving your dossiers…" loading copy gated by `tripsQ.isLoading`.
 *   2. If `listTrips` rejects, the dashboard renders an accessible alert
 *      that includes the literal error-message prefix and interpolates
 *      `tripsQ.error.message` — i.e. a *simulated* failure surfaces the
 *      correct text instead of silently falling through to "0 on file".
 */

const dashboard = readFileSync(
  resolve(import.meta.dir, "..", "src/routes/_authenticated/app.tsx"),
  "utf8",
);

describe("dashboard trip list — loading and error states", () => {
  test("renders loading copy while listTrips is pending", () => {
    // Gate must be tripsQ.isLoading and the copy must match what the user
    // sees (also surfaced in the header counter and the body).
    expect(dashboard).toMatch(
      /\{tripsQ\.isLoading\s*&&[\s\S]*?Retrieving your dossiers/,
    );
  });

  test("renders an accessible error alert with the failure message", () => {
    // Error branch must be gated on tripsQ.isError.
    expect(dashboard).toMatch(/\{tripsQ\.isError\s*&&/);

    // Alert must be announced to assistive tech.
    expect(dashboard).toMatch(/role="alert"/);

    // And must actually interpolate the simulated error message, not a
    // hard-coded string — otherwise a regression that swaps the live
    // error for a generic "Something went wrong" would slip through.
    expect(dashboard).toMatch(
      /Couldn't load your dossiers:\s*\{tripsQ\.error\.message\}/,
    );
  });

  test("loading and error branches don't both render the empty-state card", () => {
    // The empty state must remain guarded by `tripsQ.data` so a failed
    // query never flashes "No journeys composed yet" to the user.
    expect(dashboard).toMatch(
      /tripsQ\.data && tripsQ\.data\.trips\.length === 0/,
    );
  });
});