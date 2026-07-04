/**
 * Deterministic normalization of raw AI parser output, applied between
 * JSON.parse and Zod validation.
 *
 * Gemini reliably produces semantically-correct-but-schema-invalid shapes:
 *   - kind:"transit" / kind:"accommodation" instead of kind:"place" with
 *     that category (the prompt even says "emit a transit block", so the
 *     drift is our own fault);
 *   - a nested { days:[{ blocks:[…] }] } structure instead of one flat
 *     blocks array;
 *   - free-text categories ("Luxury Hotel") instead of the canonical enum.
 *
 * Every observed deviation is coerced here so the FIRST model call
 * validates, instead of burning up to four sequential retries. Zod remains
 * the final gate — this module never invents data, only re-labels it.
 */

const VALID_KINDS = new Set(["day", "place", "flight", "paragraph", "note"]);

const VALID_CATEGORIES = new Set([
  "transit", "restaurant", "walk", "event", "accommodation", "culture", "",
]);

/** kind values the model invents, mapped to the canonical place category. */
const KIND_TO_CATEGORY: Record<string, string> = {
  transit: "transit",
  transfer: "transit",
  accommodation: "accommodation",
  hotel: "accommodation",
  restaurant: "restaurant",
  meal: "restaurant",
  walk: "walk",
  event: "event",
  culture: "culture",
  activity: "",
  sight: "culture",
};

/** Loose category strings → canonical enum. Checked after lowercasing. */
const CATEGORY_SYNONYMS: Record<string, string> = {
  // lodging
  "hotel": "accommodation", "luxury hotel": "accommodation",
  "boutique hotel": "accommodation", "design hotel": "accommodation",
  "ryokan": "accommodation", "resort": "accommodation",
  "guesthouse": "accommodation", "b&b": "accommodation",
  "agriturismo": "accommodation", "apartment": "accommodation",
  "lodging": "accommodation", "stay": "accommodation",
  // food
  "food": "restaurant", "cafe": "restaurant", "café": "restaurant",
  "bar": "restaurant", "dining": "restaurant", "meal": "restaurant",
  "breakfast": "restaurant", "lunch": "restaurant", "dinner": "restaurant",
  "tasting": "restaurant",
  // movement
  "transfer": "transit", "train": "transit", "taxi": "transit",
  "drive": "transit", "ferry": "transit", "bus": "transit",
  "travel": "transit", "flight": "transit",
  // sights
  "sightseeing": "culture", "sight": "culture", "museum": "culture",
  "monument": "culture", "landmark": "culture", "attraction": "culture",
  "gallery": "culture", "temple": "culture",
  // walks
  "hike": "walk", "stroll": "walk", "walking tour": "walk", "walking": "walk",
  // events
  "show": "event", "concert": "event", "performance": "event",
  "theatre": "event", "theater": "event",
};

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Normalize the root payload. Returns a new object; never throws — on
 * anything unrecognizable it returns the input untouched and lets Zod
 * produce the real diagnostic.
 */
export function normalizeParsedShape(input: unknown): unknown {
  if (!isRec(input)) return input;
  const root: Rec = { ...input };

  // ── Nested days[] shape → flat blocks[] ────────────────────────────
  if (!Array.isArray(root.blocks) && Array.isArray(root.days)) {
    const flat: unknown[] = [];
    if (typeof root.overview === "string" && root.overview.trim()) {
      flat.push({ kind: "paragraph", text: root.overview });
    }
    (root.days as unknown[]).forEach((day, i) => {
      if (!isRec(day)) return;
      flat.push({
        kind: "day",
        n: typeof day.n === "number" ? day.n : i + 1,
        label: typeof day.label === "string" ? day.label : null,
        dayDate: typeof day.date === "string" ? day.date : null,
      });
      if (Array.isArray(day.blocks)) flat.push(...day.blocks);
    });
    if (Array.isArray(root.notes)) {
      for (const n of root.notes) {
        if (isRec(n) && typeof n.text === "string") {
          flat.push({ kind: "note", text: n.text });
        } else if (typeof n === "string") {
          flat.push({ kind: "note", text: n });
        }
      }
    }
    root.blocks = flat;
    delete root.days;
    delete root.overview;
    delete root.notes;
  }

  if (!Array.isArray(root.blocks)) return root;

  let dayCounter = 0;
  root.blocks = (root.blocks as unknown[])
    .map((b) => {
      if (!isRec(b)) return b;
      const block: Rec = { ...b };

      // ── kind coercion ────────────────────────────────────────────
      const rawKind = typeof block.kind === "string" ? block.kind.trim().toLowerCase() : "";
      if (!VALID_KINDS.has(rawKind)) {
        const impliedCategory = KIND_TO_CATEGORY[rawKind];
        if (impliedCategory !== undefined) {
          block.kind = "place";
          const existing = canonicalCategory(block.category);
          block.category = existing || impliedCategory;
        } else if (typeof block.text === "string" && block.text.trim()) {
          block.kind = "note";
        } else if (typeof block.name === "string" && block.name.trim()) {
          block.kind = "place";
        } else {
          return null; // unsalvageable — drop rather than fail the batch
        }
      } else {
        block.kind = rawKind;
      }

      // ── category coercion (place blocks only carry it) ───────────
      if (block.category !== undefined && block.category !== null) {
        block.category = canonicalCategory(block.category);
      }

      // ── tier: anything but primary/shadow → null ─────────────────
      if (block.tier !== undefined && block.tier !== null) {
        const t = String(block.tier).trim().toLowerCase();
        block.tier = t === "shadow" || t === "primary" ? t : null;
      }

      // ── confidence sometimes arrives as a string ─────────────────
      if (typeof block.confidence === "string") {
        const f = parseFloat(block.confidence);
        block.confidence = Number.isFinite(f) ? f : null;
      }

      // ── day blocks: fill a missing/naive n so toBlock keeps them ─
      if (block.kind === "day") {
        dayCounter += 1;
        if (typeof block.n !== "number" || !Number.isFinite(block.n)) {
          block.n = dayCounter;
        }
      }

      return block;
    })
    .filter((b): b is Rec => b !== null);

  return root;
}

/** Lowercase, trim, and map through synonyms; unknown → "" (ambiguous). */
function canonicalCategory(value: unknown): string {
  if (typeof value !== "string") return "";
  const c = value.trim().toLowerCase();
  if (VALID_CATEGORIES.has(c)) return c;
  if (CATEGORY_SYNONYMS[c]) return CATEGORY_SYNONYMS[c];
  // Substring rescue for compound strings like "5-star luxury hotel".
  for (const [needle, canon] of Object.entries(CATEGORY_SYNONYMS)) {
    if (needle.length >= 4 && c.includes(needle)) return canon;
  }
  return "";
}
