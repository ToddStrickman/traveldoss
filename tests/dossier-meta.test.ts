/**
 * Regression guard for the harden-pass cost bug (backend audit, 2026-08-31).
 *
 * `updateDossier` validates `meta` with a Zod object. Zod v4 strips unknown
 * keys, and `hardenedAt` (the "background hardening already ran" marker) was
 * not in that object, so it never reached the database and the ~$3 pipeline
 * re-ran on every dossier load. These tests pin both halves of the fix: the
 * key survives validation, and a save merges into stored meta rather than
 * replacing it.
 */
import { describe, expect, test } from "bun:test";
import { DossierMetaSchema, mergeDossierMeta } from "../src/lib/dossier-meta";

describe("DossierMetaSchema", () => {
  test("keeps hardenedAt through validation", () => {
    const parsed = DossierMetaSchema.parse({
      travelers: "2 adults",
      hardenedAt: "2026-08-31T12:00:00.000Z",
    });
    expect(parsed.hardenedAt).toBe("2026-08-31T12:00:00.000Z");
    expect(parsed.travelers).toBe("2 adults");
  });

  test("still rejects values outside the enums", () => {
    expect(() => DossierMetaSchema.parse({ pace: "frantic" })).toThrow();
    expect(() => DossierMetaSchema.parse({ budget: "infinite" })).toThrow();
  });
});

describe("mergeDossierMeta", () => {
  test("a marker-only save does not wipe user fields", () => {
    const prev = { travelers: "2 adults", pace: "relaxed" as const };
    expect(mergeDossierMeta(prev, { hardenedAt: "t1" })).toEqual({
      travelers: "2 adults",
      pace: "relaxed",
      hardenedAt: "t1",
    });
  });

  test("a user save does not wipe the marker", () => {
    const prev = { travelers: "2 adults", hardenedAt: "t1" };
    expect(mergeDossierMeta(prev, { travelers: "3 adults" })).toEqual({
      travelers: "3 adults",
      hardenedAt: "t1",
    });
  });

  test("an explicit empty string still clears a field", () => {
    expect(mergeDossierMeta({ travelers: "2 adults" }, { travelers: "" }).travelers).toBe("");
  });

  test("tolerates missing or malformed stored meta", () => {
    expect(mergeDossierMeta(null, { travelers: "a" })).toEqual({ travelers: "a" });
    expect(mergeDossierMeta(undefined, { travelers: "a" })).toEqual({ travelers: "a" });
    expect(mergeDossierMeta("nope", { travelers: "a" })).toEqual({ travelers: "a" });
    expect(mergeDossierMeta([1, 2], { travelers: "a" })).toEqual({ travelers: "a" });
  });
});
