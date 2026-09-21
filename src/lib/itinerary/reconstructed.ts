/**
 * Which stops did the traveler actually write, and which did the model
 * reconstruct?
 *
 * The parser prompt asks the model to self-rate confidence below 0.85 for any
 * place it recommended rather than received. In practice the model floors at
 * 0.85 and rates an invented "Lunch near Vatican City" exactly as highly as a
 * hotel the traveler named, so the review UI cannot tell them apart. Address
 * enrichment then pushes those numbers higher still — a matched street address
 * proves the address is real, not that we picked the right venue.
 *
 * So the distinction is drawn deterministically here, from the pasted text
 * itself: a place whose distinctive words never appear in the source was
 * reconstructed, and its confidence is capped below the review threshold.
 * Nothing is dropped — the stop stays, it is just flagged for a look.
 */
import type { Block } from "@/lib/skins/types";

/** Everything at or below this reads as "check this" in the review UI. */
export const RECONSTRUCTED_CONFIDENCE = 0.6;

/**
 * Words that carry no identity. A name made only of these ("Nice dinner",
 * "Morning sightseeing") can never be matched back to the source, which is
 * exactly the signal we want.
 */
const GENERIC = new Set([
  "arrive","arrival","depart","departure","check","checkin","checkout","hotel","hotels",
  "breakfast","brunch","lunch","dinner","drinks","drink","meal","food","coffee","gelato",
  "morning","afternoon","evening","night","late","early","free","time","day","days",
  "walk","walking","stroll","visit","visiting","tour","tours","explore","exploration",
  "sightseeing","experience","relax","relaxation","rest","transfer","private","taxi",
  "train","flight","fly","airport","terminal","return","last","minute","near","from",
  "with","and","the","for","into","your","area","district","city","town","centre","center",
  "museum","museums","church","market","shopping","souvenir","local","optional","nice",
  "traditional","famous","best","classic","dish","reservation","booked","tbd","trip",
]);

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Distinctive (identity-bearing) words in a place name. */
export function identityWords(name: string): string[] {
  return fold(name)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !GENERIC.has(w));
}

/**
 * True when nothing distinctive in the name appears in the traveler's text —
 * i.e. the stop came from the model, not from them.
 */
export function isReconstructedName(name: string, sourceText: string): boolean {
  const words = identityWords(name);
  if (words.length === 0) return true; // purely generic: "Nice dinner"
  const haystack = fold(sourceText);
  return !words.some((w) => haystack.includes(w));
}

/**
 * Cap confidence on every reconstructed place, in place. Returns how many
 * places were flagged so callers can log or measure it.
 */
export function flagReconstructedPlaces(blocks: Block[], sourceText: string): number {
  let flagged = 0;
  for (const b of blocks) {
    if (b.kind !== "place" || !b.name) continue;
    if (!isReconstructedName(b.name, sourceText)) continue;
    const current = b.confidence;
    if (current == null || current > RECONSTRUCTED_CONFIDENCE) {
      b.confidence = RECONSTRUCTED_CONFIDENCE;
    }
    flagged += 1;
  }
  return flagged;
}
