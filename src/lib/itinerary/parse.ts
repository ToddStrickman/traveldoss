/**
 * Drop-in parser. Turns pasted raw text, AI output, or a call transcript into
 * the app's Block[] — fully client-side, no AI key required. Splits on "Day N"
 * (line-start OR inline, since transcripts are often one long line), then breaks
 * each day into stops on sentence/comma boundaries.
 *
 * When an AI gateway is later wired in, swap `parseDropIn` for an AI call that
 * returns the same Block[] shape; the UI won't change.
 */
import type { Block } from "@/lib/skins/types";

export type IngestSource = "text" | "ai" | "transcript";

function titleCase(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Strip emoji + pictograph runs from pasted text. ChatGPT / Claude love
 * to sprinkle 🌅 / 🍽️ / ✈️ into itineraries; those characters confuse
 * downstream rendering, day-pickers and category guessing, and never
 * survive into a TravelDoss template. We drop them entirely (the
 * template's icon system replaces the intent with a category glyph).
 *
 * Removes: Extended_Pictographic runs, regional-indicator pairs (flags),
 * variation selectors (FE0E/FE0F), zero-width joiners. Then trims any
 * orphan punctuation that the emoji was leaning on.
 */
export function stripEmoji(s: string): string {
  if (!s) return s;
  let out = s
    // Emoji + pictographs (covers Misc Symbols, Dingbats, Symbols & Pictographs, etc.)
    .replace(/\p{Extended_Pictographic}/gu, "")
    // Regional indicators (flag halves)
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
    // Variation selectors + zero-width joiner
    .replace(/[\uFE0E\uFE0F\u200D]/g, "");
  // Collapse whitespace and trim leading punctuation/dashes left behind.
  out = out.replace(/[ \t]{2,}/g, " ").replace(/^[\s\-–—•:|]+/gm, "");
  return out;
}

/**
 * Detect markdown / pipe-table separator rows like `|----|----|`,
 * `| :--- | ---: |`, or pure dash dividers. These are pure formatting
 * and must never become "place" blocks.
 */
function isTableSeparatorRow(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  // Strip pipes and whitespace; if what remains is only dashes/colons, it's a separator.
  const stripped = t.replace(/[|\s]/g, "");
  if (!stripped) return true;
  return /^[-:]+$/.test(stripped);
}

/**
 * Map common day-period words to a representative clock time. Used when a
 * pasted table row carries a vague time-like first column (Morning, Evening…).
 */
const PERIOD_TIMES: Record<string, string> = {
  morning: "09:00",
  midmorning: "10:30",
  "mid morning": "10:30",
  noon: "12:00",
  midday: "12:00",
  afternoon: "14:00",
  "late afternoon": "17:00",
  "late-afternoon": "17:00",
  evening: "19:00",
  night: "21:00",
  "late night": "22:30",
  "early morning": "07:30",
  "early evening": "18:00",
};

function looksLikeTime(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (!t) return false;
  if (/^\d{1,2}[:.]\d{2}(\s*(am|pm))?$/i.test(t)) return true;
  if (/^\d{1,2}\s*(am|pm)$/i.test(t)) return true;
  return Object.prototype.hasOwnProperty.call(PERIOD_TIMES, t);
}

function normalizeTime(s: string): string {
  const t = s.trim().toLowerCase();
  if (PERIOD_TIMES[t]) return PERIOD_TIMES[t];
  return s.trim();
}

type TableRow = { time?: string; activity: string };

/** Parse one `| a | b | c |` row into cells, dropping empty edges. */
function splitPipeRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\||\|$/g, "");
  return trimmed.split("|").map((c) => c.trim());
}

/**
 * Walk the raw text once. Drop separator rows, flatten markdown-table rows
 * into "<time> — <activity>" lines, and pass everything else through. This
 * runs BEFORE the Day-N splitter so downstream logic stays simple.
 */
function preprocessMarkdownTables(text: string): string {
  // Strip emojis up front so they can't leak into row cells or names.
  const lines = stripEmoji(text).split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const isPipeRow = /^\s*\|.*\|\s*$/.test(line) || /^\s*\|/.test(line);
    if (!isPipeRow) {
      out.push(line);
      continue;
    }
    if (isTableSeparatorRow(line)) continue; // drop |---|---|
    const cells = splitPipeRow(line).filter(Boolean);
    if (cells.length === 0) continue;
    // Skip header rows like "Time | Activity" / "Day | Plan".
    const isHeader =
      cells.length >= 2 &&
      cells.every((c) => /^[A-Za-z][A-Za-z\s/&-]{0,24}$/.test(c)) &&
      /^(time|when|day|hour|slot|period|schedule|activity|plan|where|location|notes?|details?)$/i.test(
        cells[0],
      );
    if (isHeader) continue;
    let time: string | undefined;
    let rest = cells;
    if (cells.length >= 2 && looksLikeTime(cells[0])) {
      time = normalizeTime(cells[0]);
      rest = cells.slice(1);
    }
    const activity = rest.join(" — ").replace(/\s+—\s+$/g, "").trim();
    if (!activity) continue;
    out.push(time ? `${time} — ${activity}` : activity);
  }
  return out.join("\n");
}

export function parseDropIn(text: string, _source: IngestSource = "text"): Block[] {
  const cleaned = preprocessMarkdownTables(text);
  const segments = cleaned.split(/(?=\bday\s*\d+\b)/i).map((s) => s.trim()).filter(Boolean);
  const blocks: Block[] = [];
  for (const seg of segments) {
    const m = seg.match(/^day\s*(\d+)\s*[:.\-—]?\s*([\s\S]*)$/i);
    if (!m) {
      // Pre-amble before any "Day": keep as a paragraph.
      blocks.push({ kind: "paragraph", text: seg });
      continue;
    }
    const n = Number(m[1]);
    let rest = m[2].trim();
    // Capture an inline date right after "Day N":
    //   Day 1 (10/14/25): …    Day 2 — Mon Oct 14: …
    let dayDate: string | undefined;
    const parenDate = rest.match(/^\(([^)]+)\)\s*[:.\-—]?\s*/);
    if (parenDate && looksLikeDate(parenDate[1])) {
      dayDate = parenDate[1].trim();
      rest = rest.slice(parenDate[0].length).trim();
    } else {
      const leadDate = rest.match(/^([A-Za-z]{3,9}\.?\s+\d{1,2}(?:,\s*\d{2,4})?|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\s+[A-Za-z]{3,9}\.?\s+\d{1,2})\s*[:.\-—]\s*/i);
      if (leadDate && looksLikeDate(leadDate[1])) {
        dayDate = leadDate[1].trim();
        rest = rest.slice(leadDate[0].length).trim();
      }
    }
    // Trailing parenthesized date on the heading line — the AI generator's
    // canonical form: "Day 1 — Arrival & Aperitivo (Sat, Nov 21)".
    if (!dayDate) {
      const firstLine = rest.split(/\n/, 1)[0];
      const tail = firstLine.match(/\(([^)]+)\)\s*[:.]?\s*$/);
      if (tail && tail.index !== undefined && looksLikeDate(tail[1])) {
        dayDate = tail[1].trim();
        rest = (firstLine.slice(0, tail.index).trimEnd() + rest.slice(firstLine.length)).trim();
      }
    }
    const clauses = rest
      .split(/[.;\n]+|,(?=\s)/)
      .map((c) => c.replace(/^[-*•]\s*/, "").trim())
      .filter((c) => c.length > 1 && !isTableSeparatorRow(c));
    // First clause becomes the day label if it reads like a title; otherwise generic.
    const label = clauses.length && clauses[0].length <= 48 ? titleCase(clauses[0]) : `Day ${n}`;
    const stops = label === `Day ${n}` ? clauses : clauses.slice(1);
    blocks.push(dayDate ? { kind: "day", n, label, date: dayDate } : { kind: "day", n, label });
    for (const c of stops) {
      blocks.push(makePlaceBlock(c));
    }
  }
  return blocks;
}

/** Loose date sniff — catches "10/14/25", "Oct 14", "Mon Oct 14, 2025". */
function looksLikeDate(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/.test(t)) return true;
  return /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(t) && /\d/.test(t);
}

/**
 * Build a place block from a single clause, detecting shadow-itinerary
 * markers ("Alternative:", "Option:", "Backup:", "Plan B:") and must-see
 * flags. Shadow blocks render in the bottom Shadow Itinerary section;
 * must-see flags surface as a short note when none exists.
 */
function makePlaceBlock(clauseRaw: string): Extract<Block, { kind: "place" }> {
  let clause = clauseRaw;
  let tier: "primary" | "shadow" | undefined;
  let mustSee = false;

  const shadowPrefix = clause.match(/^(alternative|option|backup|plan\s*b)\s*[:\-—]\s*/i);
  if (shadowPrefix) {
    tier = "shadow";
    clause = clause.slice(shadowPrefix[0].length).trim();
  }

  // "Must see", "must-see", "don't miss", "highlight" → soft note, stripped from name.
  const mustSeeRe = /\b(must[\s-]?see|don'?t\s+miss|do\s+not\s+miss|highlight(?:ed)?)\b\s*[:\-—]?\s*/i;
  if (mustSeeRe.test(clause)) {
    mustSee = true;
    clause = clause.replace(mustSeeRe, "").trim();
  }

  const name = titleCase(clause);
  const block: Extract<Block, { kind: "place" }> = {
    kind: "place",
    name,
    category: guessCategory(clause),
  };
  if (tier) block.tier = tier;
  if (mustSee) block.note = "Must see";
  return block;
}

function guessCategory(s: string): "accommodation" | "restaurant" | "culture" | "other" {
  const t = s.toLowerCase();
  if (/(hotel|hostel|airbnb|check.?in|inn|resort|boutique|ryokan|guesthouse|guest house|b&b|bnb|villa|agriturismo|lodge|riad)/.test(t)) return "accommodation";
  if (/\bstay\b/.test(t)) return "accommodation";
  if (/(breakfast|lunch|dinner|eat|restaurant|cafe|café|food|tasting)/.test(t)) return "restaurant";
  if (/(drink|bar|wine|cocktail|aperiti|coffee)/.test(t)) return "restaurant";
  if (/(museum|gallery|see|view|temple|church|park|beach|tour|visit)/.test(t)) return"culture";
  return "other";
}

/* ------------------------------------------------------------------ */
/* Destination & fun-title extraction                                  */
/* ------------------------------------------------------------------ */

/** Lower-cased place → country/region label. Lightweight, hand-curated. */
const PLACE_TO_COUNTRY: Record<string, string> = {
  // Italy
  "italy": "Italy", "italia": "Italy",
  "emilia-romagna": "Italy", "emilia romagna": "Italy", "tuscany": "Italy",
  "piedmont": "Italy", "piemonte": "Italy", "sicily": "Italy", "sardinia": "Italy",
  "amalfi": "Italy", "amalfi coast": "Italy", "puglia": "Italy", "umbria": "Italy",
  "veneto": "Italy", "lombardy": "Italy", "liguria": "Italy",
  "rome": "Italy", "roma": "Italy", "milan": "Italy", "milano": "Italy",
  "florence": "Italy", "firenze": "Italy", "venice": "Italy", "venezia": "Italy",
  "naples": "Italy", "napoli": "Italy", "bologna": "Italy", "modena": "Italy",
  "parma": "Italy", "turin": "Italy", "torino": "Italy", "verona": "Italy",
  "siena": "Italy", "palermo": "Italy", "cinque terre": "Italy",
  // France
  "france": "France", "paris": "France", "provence": "France", "côte d'azur": "France",
  "cote d'azur": "France", "nice": "France", "lyon": "France", "marseille": "France",
  "bordeaux": "France", "normandy": "France", "brittany": "France", "alsace": "France",
  // Spain
  "spain": "Spain", "españa": "Spain", "espana": "Spain",
  "barcelona": "Spain", "madrid": "Spain", "andalusia": "Spain", "andalucia": "Spain",
  "seville": "Spain", "sevilla": "Spain", "granada": "Spain", "valencia": "Spain",
  "bilbao": "Spain", "mallorca": "Spain", "ibiza": "Spain", "san sebastian": "Spain",
  "san sebastián": "Spain",
  // Portugal
  "portugal": "Portugal", "lisbon": "Portugal", "lisboa": "Portugal",
  "porto": "Portugal", "algarve": "Portugal", "madeira": "Portugal", "azores": "Portugal",
  // UK & Ireland
  "uk": "UK", "united kingdom": "UK", "england": "UK", "scotland": "Scotland",
  "wales": "Wales", "london": "UK", "edinburgh": "Scotland", "glasgow": "Scotland",
  "manchester": "UK", "cotswolds": "UK", "lake district": "UK",
  "ireland": "Ireland", "dublin": "Ireland", "galway": "Ireland",
  // Greece
  "greece": "Greece", "athens": "Greece", "santorini": "Greece", "mykonos": "Greece",
  "crete": "Greece", "rhodes": "Greece", "corfu": "Greece",
  // Germany / Austria / Switzerland
  "germany": "Germany", "berlin": "Germany", "munich": "Germany", "bavaria": "Germany",
  "hamburg": "Germany", "cologne": "Germany", "black forest": "Germany",
  "austria": "Austria", "vienna": "Austria", "salzburg": "Austria",
  "switzerland": "Switzerland", "zurich": "Switzerland", "geneva": "Switzerland",
  "lucerne": "Switzerland", "interlaken": "Switzerland", "zermatt": "Switzerland",
  // Nordics
  "iceland": "Iceland", "reykjavik": "Iceland", "reykjavík": "Iceland",
  "norway": "Norway", "oslo": "Norway", "bergen": "Norway", "lofoten": "Norway",
  "sweden": "Sweden", "stockholm": "Sweden",
  "denmark": "Denmark", "copenhagen": "Denmark",
  "finland": "Finland", "helsinki": "Finland", "lapland": "Finland",
  // Benelux & Central
  "netherlands": "Netherlands", "holland": "Netherlands", "amsterdam": "Netherlands",
  "belgium": "Belgium", "brussels": "Belgium", "bruges": "Belgium",
  "czech republic": "Czechia", "czechia": "Czechia", "prague": "Czechia",
  "hungary": "Hungary", "budapest": "Hungary",
  "poland": "Poland", "krakow": "Poland", "kraków": "Poland", "warsaw": "Poland",
  // Balkans / East
  "croatia": "Croatia", "split": "Croatia", "dubrovnik": "Croatia", "zagreb": "Croatia",
  "slovenia": "Slovenia", "ljubljana": "Slovenia",
  "turkey": "Turkey", "türkiye": "Turkey", "istanbul": "Turkey", "cappadocia": "Turkey",
  // Asia
  "japan": "Japan", "tokyo": "Japan", "kyoto": "Japan", "osaka": "Japan",
  "hokkaido": "Japan", "okinawa": "Japan", "hiroshima": "Japan", "nara": "Japan",
  "china": "China", "beijing": "China", "shanghai": "China",
  "south korea": "Korea", "korea": "Korea", "seoul": "Korea", "busan": "Korea",
  "thailand": "Thailand", "bangkok": "Thailand", "chiang mai": "Thailand",
  "phuket": "Thailand", "krabi": "Thailand", "koh samui": "Thailand",
  "vietnam": "Vietnam", "hanoi": "Vietnam", "ho chi minh": "Vietnam", "saigon": "Vietnam",
  "hoi an": "Vietnam", "halong": "Vietnam", "ha long": "Vietnam",
  "indonesia": "Indonesia", "bali": "Indonesia", "jakarta": "Indonesia",
  "philippines": "Philippines", "manila": "Philippines", "palawan": "Philippines",
  "malaysia": "Malaysia", "kuala lumpur": "Malaysia",
  "singapore": "Singapore",
  "india": "India", "delhi": "India", "mumbai": "India", "goa": "India",
  "rajasthan": "India", "jaipur": "India", "kerala": "India",
  "nepal": "Nepal", "kathmandu": "Nepal",
  "sri lanka": "Sri Lanka", "colombo": "Sri Lanka",
  // Middle East & Africa
  "uae": "UAE", "dubai": "UAE", "abu dhabi": "UAE",
  "jordan": "Jordan", "petra": "Jordan", "amman": "Jordan",
  "israel": "Israel", "tel aviv": "Israel", "jerusalem": "Israel",
  "morocco": "Morocco", "marrakech": "Morocco", "fez": "Morocco", "casablanca": "Morocco",
  "egypt": "Egypt", "cairo": "Egypt",
  "south africa": "South Africa", "cape town": "South Africa", "johannesburg": "South Africa",
  "kenya": "Kenya", "nairobi": "Kenya",
  "tanzania": "Tanzania", "zanzibar": "Tanzania",
  // Americas
  "usa": "USA", "us": "USA", "united states": "USA", "america": "USA",
  "new york": "NYC", "nyc": "NYC", "manhattan": "NYC", "brooklyn": "NYC",
  "los angeles": "LA", "la": "LA", "san francisco": "SF", "chicago": "Chicago",
  "miami": "Miami", "new orleans": "NOLA", "nola": "NOLA",
  "hawaii": "Hawaii", "maui": "Hawaii", "oahu": "Hawaii", "kauai": "Hawaii",
  "alaska": "Alaska",
  "canada": "Canada", "toronto": "Canada", "vancouver": "Canada", "montreal": "Canada",
  "banff": "Canada", "whistler": "Canada",
  "mexico": "Mexico", "mexico city": "Mexico", "cdmx": "Mexico",
  "oaxaca": "Mexico", "tulum": "Mexico", "cancun": "Mexico", "cancún": "Mexico",
  "baja": "Mexico",
  "argentina": "Argentina", "buenos aires": "Argentina", "patagonia": "Patagonia",
  "chile": "Chile", "santiago": "Chile", "atacama": "Chile",
  "peru": "Peru", "lima": "Peru", "cusco": "Peru", "machu picchu": "Peru",
  "brazil": "Brazil", "rio": "Brazil", "rio de janeiro": "Brazil", "são paulo": "Brazil",
  "sao paulo": "Brazil",
  "colombia": "Colombia", "bogota": "Colombia", "medellin": "Colombia",
  "costa rica": "Costa Rica",
  // Oceania
  "australia": "Australia", "sydney": "Australia", "melbourne": "Australia",
  "great barrier reef": "Australia", "tasmania": "Australia",
  "new zealand": "New Zealand", "auckland": "New Zealand", "queenstown": "New Zealand",
};

/** Pick a fun suffix based on what's in the text. Keeps titles short. */
function pickVibe(text: string): string {
  const t = text.toLowerCase();
  if (/(truffle|wine|tasting|olive oil|charcuterie|food|culinary|michelin|pasta|sushi|barbecue|bbq)/.test(t)) return "Tasting Tour";
  if (/(hike|trek|trekking|hiking|mountain|summit|climb|patagonia|alps|himalaya)/.test(t)) return "Adventure";
  if (/(beach|island|surf|snorkel|dive|reef|coast|sail|yacht|cruise)/.test(t)) return "Escape";
  if (/(museum|gallery|opera|theatre|theater|cathedral|temple|heritage|history|architecture)/.test(t)) return "Culture Trip";
  if (/(safari|wildlife|jungle|national park|reserve)/.test(t)) return "Safari";
  if (/(ski|snowboard|snow|alpine|powder)/.test(t)) return "Ski Trip";
  if (/(honeymoon|anniversary|romantic|getaway)/.test(t)) return "Escape";
  if (/(road trip|drive|roadtrip|van life)/.test(t)) return "Road Trip";
  if (/(spa|wellness|retreat|yoga|hot spring|onsen)/.test(t)) return "Retreat";
  if (/(city break|long weekend|weekend)/.test(t)) return "City Break";
  return "Getaway";
}

/** Match a known place name from the lookup, scanning longest-first. */
function findKnownPlace(text: string): string | null {
  const lower = text.toLowerCase();
  const keys = Object.keys(PLACE_TO_COUNTRY).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) return PLACE_TO_COUNTRY[k];
  }
  return null;
}

/**
 * Compose a fun, short trip title (≤ ~22 chars) from arbitrary pasted text.
 * Returns null when we can't find a confident destination — caller decides
 * whether to fall back to "Untitled Trip".
 */
export function suggestTripTitle(text: string): string | null {
  if (!text || text.trim().length < 4) return null;
  // Strip "Day N…" sections so the destination heuristic isn't biased by them.
  const head = text.split(/\bday\s*\d+\b/i)[0] || text;
  const place = findKnownPlace(head) || findKnownPlace(text);
  const vibe = pickVibe(text);
  if (!place) return null;
  const title = `${place} ${vibe}`;
  // Hard cap so it never overflows the hero on mobile.
  return title.length > 24 ? `${place} Trip` : title;
}

export type ParsedIngestion = {
  blocks: Block[];
  destination: string | null;
};

/** Parse + propose a title in one pass. Title is null when undecidable. */
export function parseDropInWithMeta(
  text: string,
  source: IngestSource = "text",
): ParsedIngestion {
  return { blocks: parseDropIn(text, source), destination: suggestTripTitle(text) };
}
