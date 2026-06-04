/**
 * Day-slot bucketing. Pasted itineraries arrive with mixed time signals:
 * explicit clock times, period words ("late afternoon"), or nothing at all.
 * This helper collapses all of them into the canonical morning / afternoon /
 * evening buckets the templates render. "Late afternoon" → afternoon by
 * default (per product spec); users can opt into a custom slot label later.
 */
export type DaySlot = "morning" | "afternoon" | "evening";

export const DEFAULT_SLOTS: readonly DaySlot[] = ["morning", "afternoon", "evening"] as const;

const PERIOD_TO_SLOT: Record<string, DaySlot> = {
  morning: "morning",
  "early morning": "morning",
  midmorning: "morning",
  "mid morning": "morning",
  noon: "afternoon",
  midday: "afternoon",
  afternoon: "afternoon",
  "late afternoon": "afternoon",
  "late-afternoon": "afternoon",
  evening: "evening",
  "early evening": "evening",
  night: "evening",
  "late night": "evening",
};

/** Parse a clock-time string to a 0–23 hour, or null when unparseable. */
function hourOf(time: string): number | null {
  const t = time.trim().toLowerCase();
  const m = t.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const ampm = m[3];
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h < 0 || h > 23) return null;
  return h;
}

/**
 * Pick a slot from either a clock-time ("17:00") or a period hint
 * ("late afternoon"). Defaults to "morning" when both are absent so
 * untimed activities still get a home — never silently dropped.
 */
export function bucketFor(time?: string | null, hint?: string | null): DaySlot {
  if (time) {
    const h = hourOf(time);
    if (h !== null) {
      if (h < 12) return "morning";
      if (h < 17) return "afternoon";
      return "evening";
    }
    // String time that's actually a period word ("evening").
    const k = time.trim().toLowerCase();
    if (PERIOD_TO_SLOT[k]) return PERIOD_TO_SLOT[k];
  }
  if (hint) {
    const lower = hint.toLowerCase();
    for (const [key, slot] of Object.entries(PERIOD_TO_SLOT)) {
      if (lower.includes(key)) return slot;
    }
  }
  return "morning";
}