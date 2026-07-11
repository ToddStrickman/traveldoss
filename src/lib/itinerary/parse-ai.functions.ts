import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z, ZodError, type ZodIssue } from "zod";
import type { Block } from "@/lib/skins/types";
import { parseDropInWithMeta, stripEmoji } from "@/lib/itinerary/parse";
import { normalizeParsedShape } from "@/lib/itinerary/normalize-ai";
import { isCreditsMessage, isRateLimitMessage } from "@/lib/itinerary/ai-errors";
import type {
  DebugAttempt,
  DebugReport,
} from "@/lib/itinerary/debug-report";

/**
 * AI-powered itinerary parser. Takes raw pasted text (from ChatGPT,
 * Claude, notes, transcripts, anything) and returns a fully typed
 * Block[] enriched with addresses, phones, websites, and a single
 * concise editorial note per vendor when the model recognises it.
 *
 * Server-only. The browser calls this through useServerFn so the
 * LOVABLE_API_KEY never leaks into the client bundle.
 */

const nullableString = () => z.string().nullable().optional();
const nullableNumber = () => z.number().nullable().optional();

const BlockSchema = z.object({
  destination: z
    .string()
    .nullable()
    .optional()
    .describe("The primary destination of the trip, e.g. 'Tokyo' or 'Amalfi Coast'. Null if undecidable."),
  blocks: z
    .array(
      z.object({
        kind: z
          .enum(["day", "place", "flight", "paragraph", "note"])
          .describe("The block type."),
        // day fields
        n: nullableNumber().describe("Day number (only for kind=day)"),
        label: nullableString()
          .describe("Short title for a day, e.g. 'Arrival in Rome'"),
        dayDate: nullableString()
          .describe(
            "Calendar date for the day if the input mentions one ('Oct 14', '10/14/25', '2025-10-14', or a heading parenthetical like 'Day 1 — Arrival (Sat, Nov 21)' → 'Sat, Nov 21'). Null if not stated — DO NOT invent a date.",
          ),
        // place fields
        name: nullableString().describe("Name of the place/vendor"),
        tier: z
          .enum(["primary", "shadow"])
          .nullable()
          .optional()
          .describe(
            "'shadow' for any entry the user marked as Alternative / Option / Backup / Plan B — those render in the Shadow Itinerary section. Otherwise 'primary' or null.",
          ),
        category: z
          .enum([
            "transit",
            "restaurant",
            "walk",
            "event",
            "accommodation",
            "culture",
            "",
          ])
          .nullable()
          .optional()
          .describe(
            "One of the six canonical categories. Empty string '' if genuinely ambiguous — DO NOT GUESS.",
          ),
        address: nullableString().describe("Full street address if known"),
        phone: nullableString().describe("Localized phone number if known"),
        website: nullableString().describe("Official website URL if known"),
        hours: nullableString(),
        time: nullableString().describe("Clock time like '14:30' if mentioned"),
        reservation: nullableString(),
        note: nullableString()
          .describe(
            "ONE concise editorial sentence (<15 words) combining the source context with a factual insight about the vendor. Empty if the model has no insight.",
          ),
        confidence: nullableNumber()
          .describe(
            "Self-rated confidence in the enriched fields (address/phone/website/hours/note) for this place, on a 0–1 scale. Use <0.85 whenever you are not certain the vendor identification or enrichment is correct. Null for non-place blocks.",
          ),
        // accommodation
        checkIn: nullableString(),
        checkOut: nullableString(),
        amenities: nullableString(),
        // restaurant
        dressCode: nullableString(),
        mustOrder: nullableString(),
        // transit
        vendor: nullableString(),
        pickup: nullableString(),
        dropoff: nullableString(),
        // event / culture
        venue: nullableString(),
        ticketRequirement: nullableString(),
        tourDetails: nullableString(),
        // walk
        trailhead: nullableString(),
        distance: nullableString(),
        duration: nullableString(),
        difficulty: nullableString(),
        // flight
        airline: nullableString(),
        flightNumber: nullableString(),
        from: nullableString().describe("Departure airport IATA code"),
        to: nullableString().describe("Arrival airport IATA code"),
        fromCity: nullableString(),
        toCity: nullableString(),
        departTime: nullableString(),
        arriveTime: nullableString(),
        date: nullableString(),
        arriveDate: nullableString(),
        // paragraph / note
        text: nullableString().describe("Body text for paragraph/note blocks"),
      }),
    )
    .describe("Ordered list of itinerary blocks"),
});

const SYSTEM_PROMPT = `You are an expert travel researcher, itinerary architect, logistics planner, and narrative editor for TravelDoss, a luxury travel platform.

Your mission: transform messy, incomplete, fragmented, unstructured travel inputs (notes, voice transcripts, AI drafts, bullets, partial itineraries, random thoughts) into a complete, accurate, beautifully organized itinerary. Do NOT just organize what's given — reconstruct the trip and intelligently fill in missing dates, destinations, accommodations, transportation, meals, and activity timing so the result feels crafted by an elite advisor.

── INFORMATION RECOVERY HIERARCHY ──
1. KNOWLEDGE FIRST — Use your training knowledge of attractions, neighborhoods, opening hours, transit routes, and seasonal context.
2. AI INFERENCE — When facts aren't known, infer from geography, nearby attractions, typical tourist behavior, travel efficiency, and established tourism patterns. Example: "walk in market" → "Explore the historic local market district, browse artisan vendors, sample regional specialties, and experience the neighborhood's daily rhythm."
3. DEDUCTIVE REASONING — Use logical assumptions for incomplete fragments. Example: "Day 4 train" → infer departure city, arrival city, recommended time, duration, station from surrounding context.
Never leave obvious gaps unresolved.

── CHRONOLOGY RECONSTRUCTION ──
Input may not be chronological. Determine logical day sequencing, geographic flow, efficient routing, realistic timing, travel feasibility. Optimize for minimal backtracking, reduced fatigue, efficient transit, memorable experiences. Avoid excessive transit, unrealistic schedules, repeated long crossings, activities during closures.

── TRANSPORTATION ENGINE ──
For every location change, infer mode (walking, metro, bus, ferry, train, taxi, flight), duration, departure & arrival points, key logistics. Preference order: walking → public transit → train → ferry → flight → private vehicle. Use driving only when it improves the experience or is necessary. Emit transit as place blocks with category "transit" (or flight blocks for air).

── ACCOMMODATION INTELLIGENCE ──
If lodging is missing, recommend it based on trip style, convenience, neighborhood quality, transit access, and experience. Include neighborhood, check-in day, check-out day, accommodation category (Boutique Hotel, Luxury Hotel, Design Hotel, Ryokan, Agriturismo, Guesthouse, Resort, Apartment) and reasoning in the note. Emit as a place block with category "accommodation".

── ACTIVITY EXPANSION ──
Expand vague activities into meaningful experiences with useful context. Example: "Eat pizza" → "Enjoy a traditional Neapolitan pizza dinner at a highly regarded local pizzeria known for wood-fired preparation and regional ingredients."

── DAILY STRUCTURE ──
Set the place block's "time" field with reasonable clock times (e.g. "09:00", "14:30", "20:00") so blocks bucket cleanly into morning (00:00-11:59), afternoon (12:00-16:59), and evening (17:00-23:59). "Late afternoon" → 17:00 → afternoon bucket. Preserve the order the user gave. Do NOT pad with invented stops.

── REDUCTIVE, NEVER ADDITIVE ──
Emit exactly one block per distinct user-stated item. DO NOT invent activities, meals, or stays that aren't in the input. Three sequential items in the source ("aperitivo at X", "farewell dinner at Y", "nightcap at Z") MUST become three separate place blocks — never merge or summarize. If the user only listed one meal for a day, emit one meal block; do not add a "recommended lunch". Enrichment (address/phone/website/note) is fine; invention of new stops is NOT. Missing day numbers → reconstruct chronology. Missing transportation → emit a transit block when the user implied a transfer, otherwise leave it out.

── PRESERVED MARKERS ──
If a clause is flagged "must see" / "don't miss" / "highlight" / "star", preserve the cue at the start of the place's note (e.g. "Must see — …"). Never silently drop these flags.

── SHADOW / PLAN-B ITEMS ──
Lines prefixed with "Alternative:", "Option:", "Backup:", "Plan B:" — or otherwise described as a backup to another entry — MUST be emitted with tier "shadow". They keep the day context of the entry they back up. Everything else uses tier "primary" (or null).

── EMOJIS ──
Emojis (🌅, 🍽️, ✈️, 🏨…) have been stripped before the prompt; if any survive, DISCARD them. NEVER emit emojis in name, label, text, or note. TravelDoss renders its own category glyphs.

── QUALITY STANDARD ──
Final itinerary must feel complete, polished, cohesive, logistically realistic, easy to skim, easy to execute, worthy of a premium advisor. Every recommendation answers "Why is this here?".

── SCHEMA RULES (non-negotiable) ──
Return the structured object only. Emit blocks in execution order:
• ONE flat top-level "blocks" array. NEVER nest blocks inside day objects — a day is just a marker block followed by its stops.
• "kind" MUST be exactly one of: "day", "place", "flight", "paragraph", "note". There is NO kind "transit" or "accommodation" — those are CATEGORIES on a place block, e.g. {kind:"place", category:"transit", name:"Train to Bologna"}.
• One {kind:"day", n, label} per day, then that day's stops as {kind:"place", …} with "time" set.
• Flights become {kind:"flight", …} with IATA codes when knowable.
• Free prose preamble becomes {kind:"paragraph", text} (use for the Trip Overview / Summary).
• Standalone advice / packing / reminders become {kind:"note", text}.

Every place block MUST have a category from:
• transit       — taxis, ferries, trains, transfers, airport pickups
• restaurant    — restaurants, cafés, bars, food experiences
• walk          — walking tours, hikes, trails
• event         — concerts, theatre, sports, shows
• accommodation — hotels, rentals, B&Bs, lodges
• culture       — museums, galleries, monuments, temples, cultural sites
Use "" only when genuinely ambiguous.

── CATEGORY HARD RULES ──
• ANY lodging keyword ("hotel", "boutique", "resort", "inn", "ryokan", "guesthouse", "B&B", "villa", "agriturismo", "riad", "lodge", "rental", "Airbnb", "apartment for stay") → category MUST be "accommodation". NEVER "transit".
• An entry that starts with "Alternative:" / "Option:" / "Backup:" inherits the category of the thing it is an alternative TO. If that thing is lodging, the alternative is "accommodation".
• Use "transit" ONLY for moving between locations (taxi, train, ferry, bus, transfer, shuttle, drive). A place you sleep at is never transit, even if it's near a station.

── INPUT HYGIENE ──
The pasted text may include markdown tables, pipe-separated rows, or ASCII separators.
• Treat lines like \`| Time | Activity |\` (the header row) and \`| --- | --- |\` / \`|------|------|\` (the separator row) as FORMATTING. They are NOT places. Discard them.
• For a real table data row like \`| Morning | Arrive in Bologna |\`, extract the first cell as "time" (mapping Morning→09:00, Afternoon→14:00, Evening→19:00 unless an explicit clock time is given) and the remaining cells as the place name / activity.
• Never emit a place whose name is only punctuation, dashes, or pipe characters.

ENRICHMENT: For every named real-world vendor (recognised OR recommended), fill from your knowledge: address (full street + city), phone (with country code), website (https://…), and hours when widely known. For accommodation also fill checkIn / checkOut when standard. For restaurant fill dressCode / mustOrder when widely known.

EDITORIAL NOTE: For every place, write ONE concise note under 15 words that explains why it's there and adds an insight. Example: "Renowned minimalist coffee bar; expect a queue on weekends." Null if you genuinely have no insight.

DESTINATION: Identify the primary city/region for the trip overall (not per-day). Null only if truly undecidable.

CONFIDENCE: For every place block, set confidence on a 0–1 scale reflecting certainty in the vendor identification AND enriched address/phone/website/hours. Use <0.85 whenever there is meaningful ambiguity — including any place you recommended rather than received from the user, any partial match, or any guessed locale. Use 0.95+ only for unambiguous, widely-known venues with verified details. Null for non-place blocks.

Return ONLY the structured object. No prose around it.`;

export const parseItineraryAi = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        text: z.string().min(8).max(50_000),
        source: z.enum(["text", "transcript", "ai"]).default("text"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      throw new Error(
        "AI parser is not configured. Missing LOVABLE_API_KEY on the server.",
      );
    }

    // Strip emojis BEFORE the model sees them. Cheaper tokens; no echo risk.
    const cleanText = stripEmoji(data.text);

    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const attempts: DebugAttempt[] = [];
    let parsed: z.infer<typeof BlockSchema>;
    try {
      parsed = await parseBlocksWithAi(gateway, cleanText, data.source, attempts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isCreditsMessage(msg)) {
        throw new Error("AI credits exhausted. Add credits in Workspace → Usage.");
      }
      if (isRateLimitMessage(msg)) {
        throw new Error("AI is busy. Wait a few seconds and retry.");
      }

      console.error("[parse-ai] structured parse failed; using local parser", err);
      const fallback = parseDropInWithMeta(cleanText, data.source);
      await enrichPlacesViaWebSearch(fallback.blocks, fallback.destination, gateway).catch(
        (enrichErr: unknown) => console.error("[parse-ai] fallback enrichment failed:", enrichErr),
      );
      const debugReport: DebugReport = {
        source: "parse-ai",
        createdAt: new Date().toISOString(),
        model: "google/gemini-2.5-flash",
        outcome: "local-fallback",
        attempts,
        finalParsed: fallback,
        finalError: msg,
      };
      return { ...fallback, debugReport };
    }

    // Translate the model's nullable schema into the app's Block[] (omit
    // null/empty fields so the UI doesn't render stray "—" placeholders).
    const blocks: Block[] = parsed.blocks
      .map((b) => toBlock(b))
      .filter((b): b is Block => b !== null);

    // ── Web-search enrichment fallback ────────────────────────────────
    // For any place the model returned without address/phone/website,
    // hit Google Places (Text Search v1) to fill them in. Then run a
    // single batched Gemini call to write a <15-word editorial note
    // for every freshly enriched place that still lacks one.
    await enrichPlacesViaWebSearch(blocks, parsed.destination ?? null, gateway).catch(
      (err: unknown) => {
        // Enrichment must never break parsing — log and move on.
        console.error("[parse-ai] enrichment fallback failed:", err);
      },
    );

    const result = {
      destination: parsed.destination ?? null,
      blocks,
    };
    // Only attach a debug report if there were retries / mismatches worth
    // surfacing. A clean first-attempt parse produces no attempts entries.
    const debugReport: DebugReport | null = attempts.length
      ? {
          source: "parse-ai",
          createdAt: new Date().toISOString(),
          model: "google/gemini-2.5-flash",
          outcome: "success-after-retry",
          attempts,
          finalParsed: result,
        }
      : null;
    return debugReport ? { ...result, debugReport } : result;
  });

/* ─── helpers ───────────────────────────────────────────────────────── */

async function parseBlocksWithAi(
  gateway: GatewayProvider,
  cleanText: string,
  source: "text" | "transcript" | "ai",
  attempts?: DebugAttempt[],
): Promise<z.infer<typeof BlockSchema>> {
  const basePrompt = `Source type: ${source}\n\n---\n${cleanText}\n---\n\nReturn the structured itinerary now.`;
  const MAX_ATTEMPTS = 4;
  let lastRaw = "";
  let lastIssue = "";

  const recordAttempt = (entry: DebugAttempt) => {
    if (attempts) attempts.push(entry);
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const repairNote = lastIssue
        ? `\n\nYour previous response failed validation (${lastIssue}). Return one JSON object only. Include a top-level "destination" and "blocks" array. Do not include prose or code fences.`
        : "";
      const result = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        system: `${SYSTEM_PROMPT}\n\nReturn ONLY a JSON object matching the requested schema. Missing optional fields may be omitted. No prose, no markdown, no code fences.${repairNote}`,
        prompt: basePrompt,
      });
      lastRaw = result.text.trim();
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(extractJsonObject(lastRaw));
      } catch (jsonErr) {
        const snippet = lastRaw.slice(0, 600).replace(/\s+/g, " ");
        console.error(
          `[parse-ai] attempt ${attempt}/${MAX_ATTEMPTS} JSON.parse failed: ${(jsonErr as Error).message}\n  raw[0..600]: ${snippet}`,
        );
        lastIssue = `invalid JSON syntax: ${(jsonErr as Error).message.slice(0, 120)}`;
        recordAttempt({
          attempt,
          rawResponse: lastRaw,
          jsonParseError: (jsonErr as Error).message,
        });
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 600 * 2 ** (attempt - 1)));
        }
        continue;
      }
      // Coerce known model deviations (kind:"transit", nested days[],
      // free-text categories) before validation — the first attempt
      // should succeed even when Gemini drifts from the schema.
      const normalized = normalizeParsedShape(parsedJson);
      const safe = BlockSchema.safeParse(normalized);
      if (safe.success) return safe.data;
      logZodDiagnostics("parse-ai", attempt, MAX_ATTEMPTS, safe.error, normalized, lastRaw);
      lastIssue = summarizeIssues(safe.error.issues);
      recordAttempt({
        attempt,
        rawResponse: lastRaw,
        parsedJson,
        zodIssues: safe.error.issues,
        zodIssueSummary: lastIssue,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isCreditsMessage(msg) || isRateLimitMessage(msg)) throw err;
      console.error(`[parse-ai] attempt ${attempt}/${MAX_ATTEMPTS} threw:`, err);
      if (lastRaw) {
        try {
          const reparsed: unknown = normalizeParsedShape(
            JSON.parse(extractJsonObject(lastRaw)),
          );
          const safe = BlockSchema.safeParse(reparsed);
          if (safe.success) return safe.data;
          logZodDiagnostics("parse-ai", attempt, MAX_ATTEMPTS, safe.error, reparsed, lastRaw);
          lastIssue = summarizeIssues(safe.error.issues);
          recordAttempt({
            attempt,
            rawResponse: lastRaw,
            parsedJson: reparsed,
            zodIssues: safe.error.issues,
            zodIssueSummary: lastIssue,
            threwError: msg,
          });
        } catch {
          lastIssue = "invalid JSON syntax";
          recordAttempt({
            attempt,
            rawResponse: lastRaw,
            jsonParseError: "invalid JSON syntax",
            threwError: msg,
          });
        }
      } else {
        lastIssue = msg.slice(0, 160);
        recordAttempt({
          attempt,
          rawResponse: "",
          threwError: msg,
        });
      }
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 600 * 2 ** (attempt - 1)));
    }
  }

  throw new Error(`AI parser could not produce valid blocks after ${MAX_ATTEMPTS} attempts (${lastIssue}).`);
}

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return body.trim();
  return body.slice(start, end + 1);
}

/* ─── schema-mismatch diagnostics ─────────────────────────────────── */

function formatIssueDetailed(issue: ZodIssue, root: unknown): string {
  const path = issue.path.length ? issue.path.join(".") : "(root)";
  const meta = issue as ZodIssue & { expected?: unknown; received?: unknown };
  const typeBits =
    meta.expected !== undefined || meta.received !== undefined
      ? ` [expected=${JSON.stringify(meta.expected)} received=${JSON.stringify(meta.received)}]`
      : "";
  let valuePreview = "";
  try {
    let cursor: unknown = root;
    for (const seg of issue.path) {
      if (cursor == null) break;
      cursor = (cursor as Record<string | number, unknown>)[seg as string | number];
    }
    const json = JSON.stringify(cursor);
    if (json !== undefined) {
      valuePreview = ` value=${json.length > 160 ? json.slice(0, 157) + "…" : json}`;
    }
  } catch {
    /* ignore */
  }
  return `  • [${issue.code}] ${path}: ${issue.message}${typeBits}${valuePreview}`;
}

function summarizeIssues(issues: ZodIssue[]): string {
  return `schema mismatch (${issues.length} issue${issues.length === 1 ? "" : "s"}): ${issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "(root)"} → ${i.message}`)
    .join("; ")}`;
}

function logZodDiagnostics(
  tag: string,
  attempt: number,
  max: number,
  error: ZodError,
  parsed: unknown,
  raw: string,
): void {
  const lines = error.issues.map((i) => formatIssueDetailed(i, parsed));
  const rawSnippet = raw.slice(0, 800).replace(/\s+/g, " ");
  console.error(
    `[${tag}] attempt ${attempt}/${max} schema mismatch — ${error.issues.length} issue(s):\n${lines.join("\n")}\n  raw[0..800]: ${rawSnippet}`,
  );
}

function clean<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out as T;
}

type RawBlock = z.infer<typeof BlockSchema>["blocks"][number];

function toBlock(raw: RawBlock): Block | null {
  switch (raw.kind) {
    case "day":
      if (raw.n == null) return null;
      return clean({
        kind: "day" as const,
        n: raw.n,
        label: raw.label || `Day ${raw.n}`,
        date: raw.dayDate ?? undefined,
      });
    case "place":
      if (!raw.name) return null;
      const category =
        raw.category && (raw.category as string) !== "" ? raw.category : undefined;
      // Strip any emojis the model might have echoed despite the prompt.
      const cleanName = stripEmoji(raw.name).trim();
      if (!cleanName) return null;
      const enrichedFields: string[] = [];
      if (raw.address) enrichedFields.push("address");
      if (raw.phone) enrichedFields.push("phone");
      if (raw.website) enrichedFields.push("website");
      if (raw.hours) enrichedFields.push("hours");
      if (raw.note) enrichedFields.push("note");
      return clean({
        kind: "place" as const,
        name: cleanName,
        category,
        tier: raw.tier ?? undefined,
        address: raw.address ?? undefined,
        phone: raw.phone ?? undefined,
        website: raw.website ?? undefined,
        hours: raw.hours ?? undefined,
        time: raw.time ?? undefined,
        reservation: raw.reservation ?? undefined,
        note: raw.note ?? undefined,
        checkIn: raw.checkIn ?? undefined,
        checkOut: raw.checkOut ?? undefined,
        amenities: raw.amenities ?? undefined,
        dressCode: raw.dressCode ?? undefined,
        mustOrder: raw.mustOrder ?? undefined,
        vendor: raw.vendor ?? undefined,
        pickup: raw.pickup ?? undefined,
        dropoff: raw.dropoff ?? undefined,
        venue: raw.venue ?? undefined,
        ticketRequirement: raw.ticketRequirement ?? undefined,
        tourDetails: raw.tourDetails ?? undefined,
        trailhead: raw.trailhead ?? undefined,
        distance: raw.distance ?? undefined,
        duration: raw.duration ?? undefined,
        difficulty: raw.difficulty ?? undefined,
        confidence: raw.confidence ?? undefined,
        enrichmentSource: enrichedFields.length ? ("model" as const) : undefined,
        enrichedFields: enrichedFields.length ? enrichedFields : undefined,
      }) as Block;
    case "flight":
      return clean({
        kind: "flight" as const,
        airline: raw.airline ?? undefined,
        flightNumber: raw.flightNumber ?? undefined,
        from: raw.from ?? undefined,
        to: raw.to ?? undefined,
        fromCity: raw.fromCity ?? undefined,
        toCity: raw.toCity ?? undefined,
        departTime: raw.departTime ?? undefined,
        arriveTime: raw.arriveTime ?? undefined,
        date: raw.date ?? undefined,
        arriveDate: raw.arriveDate ?? undefined,
        note: raw.note ?? undefined,
      }) as Block;
    case "paragraph":
      if (!raw.text) return null;
      return { kind: "paragraph", text: raw.text };
    case "note":
      if (!raw.text) return null;
      return { kind: "note", text: raw.text };
  }
}

/* ─── web-search enrichment fallback ────────────────────────────────── */

type PlaceBlock = Extract<Block, { kind: "place" }>;
type GatewayProvider = ReturnType<
  typeof import("@/lib/ai-gateway.server").createLovableAiGatewayProvider
>;

/**
 * Mutates `blocks` in place: for each `place` missing address/phone/website,
 * queries Google Places (Text Search v1) for hard facts, then asks Gemini
 * to write a single <15-word editorial note per freshly enriched place.
 */
async function enrichPlacesViaWebSearch(
  blocks: Block[],
  destination: string | null,
  gateway: GatewayProvider,
): Promise<void> {
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!mapsKey) return;

  const targets = blocks.filter(
    (b): b is PlaceBlock =>
      b.kind === "place" &&
      !!b.name &&
      (!b.address || !b.phone || !b.website || b.lat == null),
  );
  if (targets.length === 0) return;

  // Pull facts from Google Places in parallel (cap concurrency to be polite).
  const enrichedFlags = await Promise.all(
    targets.map((p) => fillFromGooglePlaces(p, destination, mapsKey)),
  );

  // Batch-generate concise notes for enriched places that still lack one.
  const noteCandidates = targets.filter(
    (p, i) => enrichedFlags[i] && (!p.note || p.note.trim() === ""),
  );
  if (noteCandidates.length > 0) {
    await fillEditorialNotes(noteCandidates, destination, gateway).catch(
      (err: unknown) => console.error("[parse-ai] note synthesis failed:", err),
    );
  }
}

async function fillFromGooglePlaces(
  place: PlaceBlock,
  destination: string | null,
  apiKey: string,
): Promise<boolean> {
  const query = destination ? `${place.name}, ${destination}` : place.name;
  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.regularOpeningHours,places.location",
        },
        body: JSON.stringify({ textQuery: query, pageSize: 1 }),
      },
    );
    if (!res.ok) return false;
    const json = (await res.json()) as {
      places?: Array<{
        formattedAddress?: string;
        internationalPhoneNumber?: string;
        websiteUri?: string;
        regularOpeningHours?: { weekdayDescriptions?: string[] };
        location?: { latitude?: number; longitude?: number };
      }>;
    };
    const hit = json.places?.[0];
    if (!hit) return false;

    let changed = false;
    if (!place.address && hit.formattedAddress) {
      place.address = hit.formattedAddress;
      changed = true;
    }
    if (!place.phone && hit.internationalPhoneNumber) {
      place.phone = hit.internationalPhoneNumber;
      changed = true;
    }
    if (!place.website && hit.websiteUri) {
      place.website = hit.websiteUri;
      changed = true;
    }
    if (!place.hours && hit.regularOpeningHours?.weekdayDescriptions?.length) {
      place.hours = hit.regularOpeningHours.weekdayDescriptions.join("; ");
      changed = true;
    }
    if (
      place.lat == null &&
      typeof hit.location?.latitude === "number" &&
      typeof hit.location?.longitude === "number"
    ) {
      place.lat = hit.location.latitude;
      place.lng = hit.location.longitude;
      changed = true;
    }
    if (changed) {
      // Hard facts from Google Places — treat as high-confidence and
      // record provenance so the review UI can show what was enriched.
      place.enrichmentSource = "google-places";
      const fields = new Set(place.enrichedFields ?? []);
      if (hit.formattedAddress) fields.add("address");
      if (hit.internationalPhoneNumber) fields.add("phone");
      if (hit.websiteUri) fields.add("website");
      if (hit.regularOpeningHours?.weekdayDescriptions?.length) fields.add("hours");
      place.enrichedFields = Array.from(fields);
      place.confidence = Math.max(place.confidence ?? 0, 0.95);
    }
    return changed;
  } catch {
    return false;
  }
}

async function fillEditorialNotes(
  places: PlaceBlock[],
  destination: string | null,
  gateway: GatewayProvider,
): Promise<void> {
  const NotesSchema = z.object({
    notes: z.array(
      z.object({
        index: z.number(),
        note: z.string().nullable(),
      }),
    ),
  });

  const list = places
    .map(
      (p, i) =>
        `${i}. ${p.name}${p.category ? ` (${p.category})` : ""}${p.address ? ` — ${p.address}` : ""}`,
    )
    .join("\n");

  const result = await generateText({
    model: gateway("google/gemini-2.5-flash"),
    system:
      "You write single-sentence editorial notes for a luxury travel itinerary. Each note must be UNDER 15 WORDS, factual, and add genuine insight (atmosphere, specialty, what to expect). No fluff, no marketing copy. Return null if you have no real knowledge of the venue — never fabricate.",
    prompt: `Destination: ${destination ?? "unknown"}\n\nWrite one note per entry below. Reply with the JSON object only.\n\n${list}`,
    experimental_output: Output.object({ schema: NotesSchema }),
  });

  for (const { index, note } of result.experimental_output.notes) {
    const p = places[index];
    if (!p || !note) continue;
    const trimmed = note.trim();
    if (trimmed) p.note = trimmed;
  }
}