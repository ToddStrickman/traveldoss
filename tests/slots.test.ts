import { describe, expect, test } from "bun:test";
import { bucketFor } from "../src/lib/itinerary/slots";

describe("bucketFor", () => {
  test("clock times bucket on hour", () => {
    expect(bucketFor("06:30")).toBe("morning");
    expect(bucketFor("11:59")).toBe("morning");
    expect(bucketFor("12:00")).toBe("afternoon");
    expect(bucketFor("16:59")).toBe("afternoon");
    expect(bucketFor("17:00")).toBe("evening");
    expect(bucketFor("23:30")).toBe("evening");
  });

  test("12-hour times bucket correctly", () => {
    expect(bucketFor("8am")).toBe("morning");
    expect(bucketFor("12pm")).toBe("afternoon");
    expect(bucketFor("3:15pm")).toBe("afternoon");
    expect(bucketFor("9pm")).toBe("evening");
  });

  test("late afternoon falls into afternoon bucket", () => {
    expect(bucketFor(null, "late afternoon")).toBe("afternoon");
    expect(bucketFor("late afternoon")).toBe("afternoon");
  });

  test("period words route to slots", () => {
    expect(bucketFor(null, "morning coffee")).toBe("morning");
    expect(bucketFor(null, "evening cocktails")).toBe("evening");
    expect(bucketFor(null, "late night ramen")).toBe("evening");
    expect(bucketFor(null, "midday market visit")).toBe("afternoon");
  });

  test("falls back to morning when nothing is parseable", () => {
    expect(bucketFor()).toBe("morning");
    expect(bucketFor("")).toBe("morning");
    expect(bucketFor(null, "wander around")).toBe("morning");
  });
});