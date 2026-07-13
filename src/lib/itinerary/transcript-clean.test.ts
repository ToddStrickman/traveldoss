import { describe, expect, it } from "bun:test";
import { looksLikeTranscript, stripTranscriptCues } from "./transcript-clean";

const VTT = `WEBVTT
Kind: captions

NOTE this file was auto-generated

1
00:00:01.000 --> 00:00:04.000
<v Todd>Day one we land in Rome around eight.</v>

2
00:00:04.000 --> 00:00:07.500
Day one we land in Rome around eight.

3
00:00:07.500 --> 00:00:11.000
Then the train down to Palermo on Sunday.
`;

const SRT = `1
00:00:01,000 --> 00:00:04,000
Dinner at Roscioli, then the Colosseum at night.

2
00:00:04,000 --> 00:00:08,000
Hotel is the Adler on the Agrigento coast.
`;

describe("looksLikeTranscript", () => {
  it("detects by extension", () => {
    expect(looksLikeTranscript("anything", "trip.vtt")).toBe(true);
    expect(looksLikeTranscript("anything", "TRIP.SRT")).toBe(true);
  });
  it("detects by content shape", () => {
    expect(looksLikeTranscript(VTT)).toBe(true);
    expect(looksLikeTranscript(SRT)).toBe(true);
  });
  it("leaves plain itineraries alone", () => {
    expect(looksLikeTranscript("Day 1 — Rome: Colosseum at 9am.", "trip.txt")).toBe(false);
  });
});

describe("stripTranscriptCues", () => {
  it("reduces VTT to spoken text: no headers, timestamps, indices, tags, or rolling repeats", () => {
    const out = stripTranscriptCues(VTT);
    expect(out).toContain("Day one we land in Rome around eight.");
    expect(out).toContain("Then the train down to Palermo on Sunday.");
    expect(out).not.toContain("WEBVTT");
    expect(out).not.toContain("-->");
    expect(out).not.toContain("<v");
    expect(out).not.toContain("NOTE");
    // the rolling-caption duplicate collapsed to one occurrence
    expect(out.match(/land in Rome around eight/g)?.length).toBe(1);
  });

  it("handles SRT comma timestamps", () => {
    const out = stripTranscriptCues(SRT);
    expect(out).toContain("Dinner at Roscioli");
    expect(out).toContain("Adler on the Agrigento coast");
    expect(out).not.toContain("-->");
    expect(out).not.toMatch(/^\d+$/m);
  });
});
