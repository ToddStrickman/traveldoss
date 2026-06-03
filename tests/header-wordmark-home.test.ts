import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * End-to-end regression test for the header wordmark navigation.
 *
 * Bug history: the TRAVELDOSS wordmark in the authenticated dashboard
 * header pointed at `/app` (the library) instead of `/` (the marketing
 * home), so clicking the brand never returned a signed-in user to the
 * home screen. The fix repointed the Link to `/`.
 *
 * This test asserts the full chain that makes "click the wordmark, land
 * on home with trip data" work — without spinning up a browser:
 *
 *   1. The dashboard header wordmark is a Link whose `to` is exactly "/".
 *   2. The `/` route file is registered via createFileRoute("/").
 *   3. The dashboard fetches the trip list via the `listTrips` server
 *      function and a `["trips"]` query, and renders `trip.destination`
 *      and `trip.slug` rows — the "expected trip list data" the user
 *      sees after navigating back to the dashboard.
 *
 * Together these guard against any future refactor silently breaking
 * the wordmark → home → trip-list round trip.
 */

const read = (rel: string) =>
  readFileSync(resolve(import.meta.dir, "..", rel), "utf8");

const dashboard = read("src/routes/_authenticated/app.tsx");
const home = read("src/routes/index.tsx");

describe("header wordmark → home → trip list", () => {
  test("wordmark Link in the dashboard header points to '/'", () => {
    // Match the <Link to="/" ...>…TravelDoss…</Link> wordmark anchor.
    // Use a non-greedy span across attributes so className order can change
    // without breaking the assertion.
    const wordmark = dashboard.match(
      /<Link\s+to="\/"[^>]*>[\s\S]*?TravelDoss[\s\S]*?<\/Link>/,
    );
    expect(wordmark).not.toBeNull();

    // Defensive: ensure no stray wordmark Link still points at /app.
    const stale = dashboard.match(
      /<Link\s+to="\/app"[^>]*>[\s\S]*?TravelDoss[\s\S]*?<\/Link>/,
    );
    expect(stale).toBeNull();
  });

  test("home route is registered at '/'", () => {
    expect(home).toMatch(/createFileRoute\(\s*"\/"\s*\)/);
  });

  test("dashboard fetches and renders the trip list", () => {
    // Server fn is imported and bound through useServerFn.
    expect(dashboard).toMatch(
      /import\s*\{[^}]*\blistTrips\b[^}]*\}\s*from\s*"@\/lib\/trips\.functions"/,
    );
    expect(dashboard).toMatch(/useServerFn\(\s*listTrips\s*\)/);

    // Query keyed on "trips" — invalidating or reading this key elsewhere
    // must keep working, so freeze the contract.
    expect(dashboard).toMatch(
      /useQuery\(\{\s*queryKey:\s*\[\s*"trips"\s*\][\s\S]*?queryFn:/,
    );

    // The rendered list maps over trips and surfaces destination + slug —
    // the visible "expected trip list data" after landing back on the
    // dashboard from the wordmark.
    expect(dashboard).toMatch(/tripsQ\.data\.trips\.map\(/);
    expect(dashboard).toMatch(/\{t\.destination\}/);
    expect(dashboard).toMatch(/\/t\/\$\{?t?\.?slug\}?|params=\{\{\s*slug:\s*t\.slug\s*\}\}/);
  });
});