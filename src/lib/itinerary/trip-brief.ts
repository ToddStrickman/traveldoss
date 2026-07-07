/**
 * Deterministic trip-date + duration resolution (isomorphic, dependency-free).
 *
 * The AI generator never knew "today", so a brief like "five days, Nov 21–27"
 * couldn't be pinned to a year and day headings came out undated. This resolves
 * that purely in code (no LLM guessing on calendar math):
 *   - parses explicit ranges ("Nov 21 to Nov 27"), single dates, ISO, numeric
 *   - infers the year as the NEXT future occurrence relative to `today`
 *   - reconciles a stated duration ("five days") with an explicit date range
 *   - emits per-day calendar labels the generator stamps onto each Day heading
 */

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_ABBR = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, twenty: 20, thirty: 30, a: 1, an: 1,
};

export type ResolvedDates = {
  /** ISO yyyy-mm-dd, when a start could be determined. */
  startDate?: string;
  /** ISO yyyy-mm-dd, when an end could be determined. */
  endDate?: string;
  /** Number of day-blocks to generate (>= 1). */
  durationDays: number;
  /** Calendar labels per day, e.g. ["Fri, Nov 21", …]; empty if no start. */
  perDay: string[];
  /** Human note when an assumption was made (year inference, reconciliation). */
  note?: string;
};

type ParsedDay = { y?: number; m: number; d: number };

function monthIndex(token: string): number {
  const t = token.toLowerCase().replace(/\.$/, "");
  let i = MONTHS.indexOf(t);
  if (i === -1) i = MONTH_ABBR.indexOf(t.slice(0, 3));
  return i; // -1 if not a month
}

/** Find month-name dates ("November 21st", "Nov 21, 2026") in order. */
function findNamedDates(text: string): ParsedDay[] {
  const re = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/g;
  const out: ParsedDay[] = [];
  for (const m of text.matchAll(re)) {
    const mi = monthIndex(m[1]);
    const d = Number(m[2]);
    if (mi === -1 || d < 1 || d > 31) continue;
    out.push({ m: mi, d, y: m[3] ? Number(m[3]) : undefined });
  }
  return out;
}

/** Find ISO + numeric dates ("2026-11-21", "11/21", "11/21/26"). */
function findNumericDates(text: string): ParsedDay[] {
  const out: ParsedDay[] = [];
  for (const m of text.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) {
    out.push({ y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) });
  }
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)) {
    const mo = Number(m[1]) - 1;
    const d = Number(m[2]);
    if (mo < 0 || mo > 11 || d < 1 || d > 31) continue;
    let y: number | undefined;
    if (m[3]) y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    out.push({ y, m: mo, d });
  }
  return out;
}

/** Parse a duration in days from free text ("five days", "a long weekend"). */
function parseDuration(text: string): number | undefined {
  const t = text.toLowerCase();
  if (/\blong weekend\b/.test(t)) return 3;
  if (/\bweekend\b/.test(t)) return 2;
  if (/\b(a|one)\s+week\b/.test(t)) return 7;
  if (/\btwo\s+weeks?\b|\bfortnight\b/.test(t)) return 14;
  // "5 days", "5-day", "5 nights" (nights → +1 day on the ground)
  const nights = t.match(/(\d{1,2})\s*[-\s]?nights?\b/);
  if (nights) return Math.min(30, Number(nights[1]) + 1);
  const numDigits = t.match(/(\d{1,2})\s*[-\s]?days?\b/);
  if (numDigits) return Math.min(30, Math.max(1, Number(numDigits[1])));
  const numWords = t.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty)\s+days?\b/,
  );
  if (numWords) return NUMBER_WORDS[numWords[1]];
  return undefined;
}

/** UTC date at midnight, year inferred to the next future occurrence. */
function toDate(p: ParsedDay, today: Date): { date: Date; inferredYear: boolean } {
  if (p.y != null) return { date: new Date(Date.UTC(p.y, p.m, p.d)), inferredYear: false };
  const ty = today.getUTCFullYear();
  let candidate = new Date(Date.UTC(ty, p.m, p.d));
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  // If the date has already passed this year, roll to next year.
  if (candidate.getTime() < todayUtc.getTime()) {
    candidate = new Date(Date.UTC(ty + 1, p.m, p.d));
  }
  return { date: candidate, inferredYear: true };
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function label(d: Date): string {
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTH_ABBR[d.getUTCMonth()].replace(/^\w/, (c) => c.toUpperCase())} ${d.getUTCDate()}`;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

export type DateInput = {
  prompt?: string;
  startDate?: string;
  endDate?: string;
  duration?: string;
};

/**
 * Resolve a trip's calendar window + per-day labels deterministically.
 * `today` is injected so the result is testable and timezone-stable.
 */
export function resolveTripDates(input: DateInput, today: Date = new Date()): ResolvedDates {
  const fieldText = [input.startDate, input.endDate].filter(Boolean).join(" to ");
  const promptText = input.prompt ?? "";

  // Prefer explicit fields; fall back to dates mentioned in the prompt.
  const fieldDates = [...findNamedDates(fieldText), ...findNumericDates(fieldText)];
  const promptDates = [...findNamedDates(promptText), ...findNumericDates(promptText)];
  const candidates = (fieldDates.length ? fieldDates : promptDates).slice(0, 2);

  const statedDuration =
    parseDuration(input.duration ?? "") ?? parseDuration(promptText) ?? undefined;

  const notes: string[] = [];

  if (candidates.length === 0) {
    const durationDays = statedDuration ?? 5;
    return {
      durationDays,
      perDay: [],
      note: statedDuration ? undefined : "No dates or duration given — defaulted to a 5-day plan.",
    };
  }

  const first = toDate(candidates[0], today);
  const start = first.date;
  if (first.inferredYear) {
    notes.push(`Year not stated — assumed ${start.getUTCFullYear()} (the next upcoming occurrence).`);
  }

  let durationDays: number;
  let end: Date | undefined;

  if (candidates.length >= 2) {
    // Explicit range — the calendar window is authoritative.
    let second = toDate(candidates[1], today).date;
    // Guard: if the 2nd date landed before the 1st (year-roll mismatch), pin it
    // to the same year as the start.
    if (second.getTime() < start.getTime()) {
      second = new Date(Date.UTC(start.getUTCFullYear(), second.getUTCMonth(), second.getUTCDate()));
      if (second.getTime() < start.getTime()) second = addDays(start, 1);
    }
    end = second;
    durationDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1; // inclusive
    durationDays = Math.min(30, Math.max(1, durationDays));
    if (statedDuration && statedDuration !== durationDays) {
      notes.push(
        `Brief said ${statedDuration} days but the dates span ${durationDays} (${label(start)}–${label(end)}); planned the full date range.`,
      );
    }
  } else {
    // Single start date + (stated or default) duration.
    durationDays = statedDuration ?? 5;
    if (!statedDuration) notes.push("Duration not stated — assumed 5 days from the start date.");
    end = addDays(start, durationDays - 1);
  }

  const perDay = Array.from({ length: durationDays }, (_, i) => label(addDays(start, i)));

  return {
    startDate: iso(start),
    endDate: end ? iso(end) : undefined,
    durationDays,
    perDay,
    note: notes.length ? notes.join(" ") : undefined,
  };
}
