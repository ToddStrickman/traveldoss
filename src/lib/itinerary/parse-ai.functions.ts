import { createServerFn } from "@tanstack/react-start";
import { z, ZodError, type ZodIssue } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Block } from "@/lib/skins/types";
import { lookupPlaceFacts, type PlaceFacts } from "@/lib/maps/place-lookup.server";
import { parseDropInWithMeta, stripEmoji } from "@/lib/itinerary/parse";
import { normalizeParsedShape } from "@/lib/itinerary/normalize-ai";
import { isCreditsMessage, isRateLimitMessage } from "@/lib/itinerary/ai-errors";
import { flagReconstructedPlaces } from "@/lib/itinerary/reconstructed";
import { buildCoverageLedger } from "@/lib/itinerary/coverage";

import type { DebugAttempt, DebugReport } from "@/lib/itinerary/debug-report";

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
    .describe(
      "The primary destination of the trip, e.g. 'Tokyo' or 'Amalfi Coast'. Null if undecidable.",
    ),
  blocks: z
    .array(
      z.object({
        kind: z.enum(["day", "place", "flight", "paragraph", "note"]).describe("The block type."),
        // day fields
        n: nullableNumber().describe("Day number (only for kind=day)"),
        label: nullableString().describe("Short title for a day, e.g. 'Arrival in Rome'"),
        dayDate: nullableString().describe(
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
          .enum(["transit", "restaurant", "walk", "event", "accommodation", "culture", ""])
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
        note: nullableString().describe(
          "Every detail the source gave about this stop that has no other field: prices, currencies, booking references, caveats, who-said-what, instructions. Copy the source wording; do not summarise it away. Null only when the source said nothing beyond the name.",
        ),

        confidence: nullableNumber().describe(
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

const NULLABLE_STRING_SCHEMA = { type: ["string", "null"] } as const;
const NULLABLE_NUMBER_SCHEMA = { type: ["number", "null"] } as const;
const PLACE_PROPERTIES = {
  kind: { type: "string", enum: ["place"] },
  name: NULLABLE_STRING_SCHEMA,
  tier: { type: ["string", "null"], enum: ["primary", "shadow", null] },
  category: { type: ["string", "null"], enum: ["transit", "restaurant", "walk", "event", "accommodation", "culture", "", null] },
  address: NULLABLE_STRING_SCHEMA, phone: NULLABLE_STRING_SCHEMA, website: NULLABLE_STRING_SCHEMA,
  hours: NULLABLE_STRING_SCHEMA, time: NULLABLE_STRING_SCHEMA, reservation: NULLABLE_STRING_SCHEMA,
  note: NULLABLE_STRING_SCHEMA, confidence: NULLABLE_NUMBER_SCHEMA, checkIn: NULLABLE_STRING_SCHEMA,
  checkOut: NULLABLE_STRING_SCHEMA, amenities: NULLABLE_STRING_SCHEMA, dressCode: NULLABLE_STRING_SCHEMA,
  mustOrder: NULLABLE_STRING_SCHEMA, vendor: NULLABLE_STRING_SCHEMA, pickup: NULLABLE_STRING_SCHEMA,
  dropoff: NULLABLE_STRING_SCHEMA, venue: NULLABLE_STRING_SCHEMA, ticketRequirement: NULLABLE_STRING_SCHEMA,
  tourDetails: NULLABLE_STRING_SCHEMA, trailhead: NULLABLE_STRING_SCHEMA, distance: NULLABLE_STRING_SCHEMA,
  duration: NULLABLE_STRING_SCHEMA, difficulty: NULLABLE_STRING_SCHEMA,
} as const;
const FLIGHT_PROPERTIES = {
  kind: { type: "string", enum: ["flight"] }, airline: NULLABLE_STRING_SCHEMA,
  flightNumber: NULLABLE_STRING_SCHEMA, from: NULLABLE_STRING_SCHEMA, to: NULLABLE_STRING_SCHEMA,
  fromCity: NULLABLE_STRING_SCHEMA, toCity: NULLABLE_STRING_SCHEMA, departTime: NULLABLE_STRING_SCHEMA,
  arriveTime: NULLABLE_STRING_SCHEMA, date: NULLABLE_STRING_SCHEMA, arriveDate: NULLABLE_STRING_SCHEMA,
  note: NULLABLE_STRING_SCHEMA,
} as const;
const DAY_PROPERTIES = {
  kind: { type: "string", enum: ["day"] },
  n: NULLABLE_NUMBER_SCHEMA,
  label: NULLABLE_STRING_SCHEMA,
  dayDate: NULLABLE_STRING_SCHEMA,
} as const;

const BLOCK_OUTPUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    destination: NULLABLE_STRING_SCHEMA,
    blocks: {
      type: "array",
      items: {
        anyOf: [
          { type: "object", properties: DAY_PROPERTIES, required: Object.keys(DAY_PROPERTIES), additionalProperties: false },
          { type: "object", properties: PLACE_PROPERTIES, required: Object.keys(PLACE_PROPERTIES), additionalProperties: false },
          { type: "object", properties: FLIGHT_PROPERTIES, required: Object.keys(FLIGHT_PROPERTIES), additionalProperties: false },
          { type: "object", properties: { kind: { type: "string", enum: ["paragraph"] }, text: NULLABLE_STRING_SCHEMA }, required: ["kind", "text"], additionalProperties: false },
          { type: "object", properties: { kind: { type: "string", enum: ["note"] }, text: NULLABLE_STRING_SCHEMA }, required: ["kind", "text"], additionalProperties: false },
        ],
      },
    },
  },
  required: ["destination", "blocks"],
  additionalProperties: false,
} as const;

const NOTES_OUTPUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    notes: {
      type: "array",
      items: {
        type: "object",
        properties: { index: { type: "number" }, note: NULLABLE_STRING_SCHEMA },
        required: ["index", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["notes"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are a precise itinerary transcriber for TravelDoss. You convert a traveler's own itinerary text into structured blocks WITHOUT adding to it, shortening it, or reordering it.

── THE ONE RULE ──
Everything in the source must survive. Nothing that is not in the source may appear.
You are not a travel advisor here. You do not improve, complete, optimise, or reconstruct the trip.

── NEVER INVENT ──
• NEVER add a stop, meal, activity, hotel, transfer, flight, ticket, or day the source does not state.
• NEVER invent a date, year, time, price, address, phone, website, confirmation number, or airport code.
• NEVER "fill a gap": a day with one stop keeps one stop; an unexplained jump between cities stays unexplained.
• NEVER reorder: emit blocks in the order the source presents them, and keep the day numbers the source gives.
• If the source contradicts itself (two Day 3s, a date that does not match the weekday), emit it as written. Do not resolve it.

── NEVER LOSE ──
• Emit exactly one block per distinct source item. Three sequential stops stay three blocks — never merge or summarise.
• Preserve EVERY transport leg separately, including each flight of a multi-leg journey and each return leg.
• Preserve prices and currencies, booking/confirmation references, URLs, phone numbers, addresses, opening hours, durations, distances, dress codes, and caveats exactly as given — in the matching field, or in "note" when no field fits.
• Preserve narrative prose, intros, summaries, packing lists, tips, warnings, and anything you cannot classify as {kind:"paragraph"} or {kind:"note"} with the original wording. Dropping text is a failure; an unclassified paragraph is not.
• Preserve markers like "must see", "don't miss", "highlight", "book ahead" at the start of the note.
• Repeated visits to the same hotel or restaurant on different days are DISTINCT occurrences — emit each one.
• Alternatives ("Alternative:", "Option:", "Backup:", "Plan B:") get tier "shadow" and keep the day of the item they back up, and inherit that item's category.

── DAYS AND DATES ──
• Use the day number the source states. Only when the source gives no day numbers at all may you number days sequentially in source order.
• dayDate is set ONLY from a date in the source ("Oct 14", "10/14/25", "2025-10-14", "Day 1 — Arrival (Sat, Nov 21)" → "Sat, Nov 21"). No date in the source → null. Never guess a year.
• time is set ONLY from a stated clock time, or from an explicit part-of-day word: Morning→09:00, Afternoon→14:00, Late afternoon→17:00, Evening→19:00, Night→21:00. Otherwise null.
• An overnight or next-day arrival keeps its own arriveDate as stated; never collapse it into the departure date.

── ENRICHMENT (the only place you may add) ──
You may fill address, phone, website, hours for a named real-world venue from your knowledge, and nothing else. If you are not certain it is that exact venue, leave them null. Set confidence below 0.85 whenever the identification or any enriched field is uncertain. Enrichment never replaces or rewrites source text.

── EMOJIS ──
Emojis were stripped before this prompt. If any survive, discard them. Never emit emojis.

── SCHEMA RULES (non-negotiable) ──
Return the structured object only, no prose around it.
• ONE flat top-level "blocks" array. NEVER nest blocks inside day objects — a day is a marker block followed by its stops.
• "kind" is exactly one of: "day", "place", "flight", "paragraph", "note". There is NO kind "transit" or "accommodation" — those are CATEGORIES on a place block, e.g. {kind:"place", category:"transit", name:"Train to Bologna"}.
• Air travel becomes {kind:"flight", …}; use IATA codes only when the source states the airport or city unambiguously.
• Free prose (overview, summary, intro) becomes {kind:"paragraph", text}. Standalone advice, packing, reminders become {kind:"note", text}.
• Every place block needs a name. Every place block needs a category from:
  transit (moving between locations: taxi, train, ferry, bus, transfer, shuttle, drive)
  restaurant (restaurants, cafés, bars, food experiences)
  walk (walking tours, hikes, trails)
  event (concerts, theatre, sports, shows)
  accommodation (hotels, rentals, B&Bs, villas, lodges — ANY lodging keyword, NEVER "transit")
  culture (museums, galleries, monuments, temples, cultural sites)
  Use "" only when genuinely ambiguous. Do not guess.

── INPUT HYGIENE ──
The text may contain markdown tables or ASCII separators.
• Header rows (\`| Time | Activity |\`) and separator rows (\`| --- | --- |\`) are formatting, not places. Discard those two row types only.
• For a real data row (\`| Morning | Arrive in Bologna | EUR 40 |\`), map the time cell to "time", the activity cell to the place name, and keep every remaining cell's content in "note".
• Never emit a place whose name is only punctuation, dashes, or pipes.

DESTINATION: the primary city/region for the trip overall, taken from the source. Null if the source does not say.

Return ONLY the structured object.`;


const ParseInputSchema = z.object({
  text: z.string().min(8).max(50_000),
  source: z.enum(["text", "transcript", "ai"]).default("text"),
});

export type ParseItineraryInput = z.infer<typeof ParseInputSchema>;

/**
 * Core parse implementation — callable directly from other SERVER code.
 *
 * Server-to-server callers (refineItineraryAiCore, any future ingest path) MUST
 * use this rather than the `parseItineraryAi` server fn below. Invoking a
 * server fn from server code runs its *client* middleware chain, and
 * `attachSupabaseAuth` reads the Supabase session from localStorage — which is
 * undefined on the server — so no Bearer header would be attached and
 * `requireSupabaseAuth` would reject the nested call. Those callers are
 * themselves authenticated entry points, so the spend stays gated.
 */
export async function parseItineraryAiCore(data: ParseItineraryInput) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    throw new Error("AI parser is not configured. Missing LOVABLE_API_KEY on the server.");
  }

  // Strip emojis BEFORE the model sees them. Cheaper tokens; no echo risk.
  const cleanText = stripEmoji(data.text);

  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(key);

  const attempts: DebugAttempt[] = [];
  let parsed: z.infer<typeof BlockSchema>;
  try {
    parsed = await parseBlocksWithAi(key, cleanText, data.source, attempts);
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
    flagReconstructedPlaces(fallback.blocks, cleanText);
    const debugReport: DebugReport = {
      source: "parse-ai",
      createdAt: new Date().toISOString(),
      model: "openai/gpt-6-astra",
      outcome: "local-fallback",
      attempts,
      finalParsed: fallback,
      finalError: msg,
    };
    return { ...fallback, coverage: buildCoverageLedger(cleanText, fallback.blocks), debugReport };
  }

  // Translate the model's nullable schema into the app's Block[] (omit
  // null/empty fields so the UI doesn't render stray "—" placeholders).
  // Untypeable entries are preserved as visible notes, never filtered away.
  const blocks: Block[] = parsed.blocks
    .map((b) => toBlockPreservingSource(b))
    .filter((b): b is Block => b !== null);


  // ── Web-search enrichment fallback ────────────────────────────────
  // For any place the model returned without address/phone/website,
  // hit Google Places (Text Search v1) to fill them in. Then run a
  // single batched AI call to write a <15-word editorial note
  // for every freshly enriched place that still lacks one.
  await enrichPlacesViaWebSearch(blocks, parsed.destination ?? null, gateway).catch(
    (err: unknown) => {
      // Enrichment must never break parsing — log and move on.
      console.error("[parse-ai] enrichment fallback failed:", err);
    },
  );

  // Enrichment can only raise confidence, and the model floors its own rating
  // at 0.85 even for stops it invented — so mark the reconstructed ones here,
  // against the traveler's own words.
  flagReconstructedPlaces(blocks, cleanText);

  // Source coverage ledger: what the traveler pasted, versus what the
  // dossier now carries. Callers use this to decide between "ready" and
  // "needs review" instead of announcing success on a lossy parse.
  const coverage = buildCoverageLedger(cleanText, blocks);
  if (coverage.missing.length) {
    console.warn(
      `[parse-ai] coverage ${coverage.coveredLines}/${coverage.sourceLines} source lines; ${coverage.missing.length} unplaced`,
    );
  }

  const result = {
    destination: parsed.destination ?? null,
    blocks,
    coverage,
  };
  // Only attach a debug report if there were retries / mismatches worth
  // surfacing. A clean first-attempt parse produces no attempts entries.
  const debugReport: DebugReport | null = attempts.length
    ? {
        source: "parse-ai",
        createdAt: new Date().toISOString(),
        model: "openai/gpt-6-astra",
        outcome: "success-after-retry",
        attempts,
        finalParsed: { destination: result.destination, blocks: result.blocks },
      }
    : null;
  return debugReport ? { ...result, debugReport } : result;

}

/**
 * Authenticated HTTP entry point. Spends Lovable AI credits AND Google Places
 * credits (up to PER_RUN_CAP lookups), so it must never be callable anonymously.
 */
export const parseItineraryAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ParseInputSchema.parse(input))
  .handler(async ({ data }) => parseItineraryAiCore(data));

/* ─── helpers ───────────────────────────────────────────────────────── */

async function parseBlocksWithAi(
  apiKey: string,
  cleanText: string,
  source: "text" | "transcript" | "ai",
  attempts?: DebugAttempt[],
): Promise<z.infer<typeof BlockSchema>> {
  const chunks = splitItineraryForAi(cleanText);
  const parsedChunks: Array<z.infer<typeof BlockSchema>> = [];
  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    const prompt = `Source type: ${source}\nChunk ${index + 1} of ${chunks.length}. Preserve the stated day numbers and source order.\n\n---\n${chunk}\n---\n\nReturn one JSON object with destination and blocks.`;
    parsedChunks.push(await parseChunkWithAi(apiKey, prompt, index + 1, attempts));
  }
  return {
    destination: parsedChunks.find((chunk) => chunk.destination)?.destination ?? null,
    blocks: orderDayGroups(parsedChunks.flatMap((chunk) => chunk.blocks)),
  };
}

function orderDayGroups(blocks: z.infer<typeof BlockSchema>["blocks"]) {
  const preamble: typeof blocks = [];
  const groups: Array<{ n: number; ordinal: number; blocks: typeof blocks }> = [];
  let current: (typeof groups)[number] | null = null;
  for (const block of blocks) {
    if (block.kind === "day" && typeof block.n === "number") {
      current = { n: block.n, ordinal: groups.length, blocks: [block] };
      groups.push(current);
    } else if (current) {
      current.blocks.push(block);
    } else {
      preamble.push(block);
    }
  }
  groups.sort((a, b) => a.n - b.n || a.ordinal - b.ordinal);
  return [...preamble, ...groups.flatMap((group) => group.blocks)];
}

const MAX_AI_CHUNK_CHARS = 12_000;

export function splitItineraryForAi(text: string, maxChars = MAX_AI_CHUNK_CHARS): string[] {
  if (text.length <= maxChars) return [text];
  const sections = text.split(/(?=^\s*(?:#{1,6}\s*)?day\s+\d+\b)/gim).filter((part) => part.trim());
  const chunks: string[] = [];
  let current = "";
  const push = (value: string) => {
    if (value.trim()) chunks.push(value);
  };
  for (const section of sections) {
    if (section.length > maxChars) {
      push(current);
      current = "";
      for (let start = 0; start < section.length; start += maxChars) push(section.slice(start, start + maxChars));
    } else if (current && current.length + section.length > maxChars) {
      push(current);
      current = section;
    } else {
      current += section;
    }
  }
  push(current);
  return chunks.length ? chunks : [text];
}

async function parseChunkWithAi(
  apiKey: string,
  prompt: string,
  chunkNumber: number,
  attempts?: DebugAttempt[],
): Promise<z.infer<typeof BlockSchema>> {
  const MAX_TRANSIENT_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_TRANSIENT_ATTEMPTS; attempt++) {
    let raw = "";
    try {
      const { streamLovableJsonResponse } = await import("@/lib/ai-gateway.server");
      const result = await streamLovableJsonResponse<unknown>({
        apiKey,
        instructions: `${SYSTEM_PROMPT}\n\nReturn only the requested structured object. Every schema field is required; use null when it does not apply.`,
        input: prompt,
        schemaName: "itinerary_chunk",
        schema: BLOCK_OUTPUT_JSON_SCHEMA as unknown as Record<string, unknown>,
        reasoningEffort: "low",
      });
      raw = JSON.stringify(result.value);
      const normalized = normalizeParsedShape(result.value);
      const safe = BlockSchema.safeParse(normalized);
      if (safe.success) return safe.data;
      const issue = summarizeIssues(safe.error.issues);
      attempts?.push({ attempt: chunkNumber, rawResponse: "", zodIssues: safe.error.issues, zodIssueSummary: issue });
      throw new Error(issue);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status?: unknown }).status)
        : undefined;
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (!retryable || attempt === MAX_TRANSIENT_ATTEMPTS) {
        attempts?.push({ attempt: chunkNumber, rawResponse: "", threwError: message.slice(0, 240) });
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250)));
    }
  }
  throw new Error("AI parser stopped before completing the itinerary chunk.");
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
      const category = raw.category && (raw.category as string) !== "" ? raw.category : undefined;
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

/**
 * Nothing the traveler supplied may vanish because the model returned a
 * block we cannot type (a place with no name, a day with no number, an
 * empty paragraph that still carries a price). `toBlock` returns null for
 * those; here we salvage every non-empty value into a visible note block so
 * the content stays in the dossier and in the coverage ledger instead of
 * disappearing behind a filter(Boolean).
 */
export function toBlockPreservingSource(raw: RawBlock): Block | null {
  const typed = toBlock(raw);
  if (typed) return typed;
  const salvaged = Object.entries(raw as Record<string, unknown>)
    .filter(([key]) => key !== "kind" && key !== "confidence")
    .map(([, value]) => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : ""))
    .filter((value) => value.length > 0);
  if (!salvaged.length) return null;
  return { kind: "note", text: `Unplaced from your itinerary: ${salvaged.join(" — ")}` };
}


/* ─── web-search enrichment fallback ────────────────────────────────── */

type PlaceBlock = Extract<Block, { kind: "place" }>;
type GatewayProvider = ReturnType<
  typeof import("@/lib/ai-gateway.server").createLovableAiGatewayProvider
>;

/**
 * Mutates `blocks` in place: for each `place` missing address/phone/website,
 * asks OpenStreetMap (keyless, see place-lookup.server.ts) for hard facts,
 * then asks AI to write a single <15-word editorial note per freshly
 * enriched place.
 */
async function enrichPlacesViaWebSearch(
  blocks: Block[],
  destination: string | null,
  gateway: GatewayProvider,
): Promise<void> {
  const targets = blocks.filter(
    (b): b is PlaceBlock =>
      b.kind === "place" && !!b.name && (!b.address || !b.phone || !b.website || b.lat == null),
  );
  if (targets.length === 0) return;

  // Bounded by WALL CLOCK, not just by count. The lookups are free but hit a
  // shared community service, so a 60-stop paste must not fan out forever —
  // and the traveler must never wait on the tail. Workers stop pulling new
  // targets once the budget is spent; everything still missing is picked up by
  // the save-time backfill (geo.server.ts) on the first autosave.
  const PER_RUN_CAP = 18;
  const CONCURRENCY = 6;
  const ENRICH_BUDGET_MS = 6_500;
  const deadline = Date.now() + ENRICH_BUDGET_MS;
  const capped = targets.slice(0, PER_RUN_CAP);
  if (targets.length > capped.length) {
    console.warn(
      `[parse-ai] enriching up to ${capped.length}/${targets.length} places this run; the rest backfill on save`,
    );
  }
  // One lookup per distinct query: a hotel repeated across every night, or the
  // same restaurant twice, used to cost one round trip each. On a large
  // dossier this is where most of the wall clock went.
  const inFlight = new Map<string, Promise<PlaceFacts | null>>();
  const enrichedFlags = new Array<boolean>(targets.length).fill(false);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, capped.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= capped.length) return;
        if (Date.now() >= deadline) return;
        enrichedFlags[i] = await fillFromOpenStreetMap(capped[i], destination, inFlight);
      }
    }),
  );

  // Batch-generate concise notes for enriched places that still lack one.
  const noteCandidates = targets.filter(
    (p, i) => enrichedFlags[i] && (!p.note || p.note.trim() === ""),
  );
  if (noteCandidates.length > 0) {
    await fillEditorialNotes(noteCandidates, destination, gateway).catch((err: unknown) =>
      console.error("[parse-ai] note synthesis failed:", err),
    );
  }
}

async function fillFromOpenStreetMap(
  place: PlaceBlock,
  destination: string | null,
  inFlight?: Map<string, Promise<PlaceFacts | null>>,
): Promise<boolean> {
  // A stop's own address is the strongest signal; the broad trip destination
  // is only a fallback (matches geocodeQueryFor in geo.server.ts). Anchoring
  // "Monreale Cathedral" to a multi-city trip destination was actively wrong.
  const query = place.address
    ? `${place.name}, ${place.address}`
    : destination
      ? `${place.name}, ${destination}`
      : place.name;
  try {
    // Bounded: a slow lookup must never stall the whole parse. Repeats of the
    // same query share one round trip.
    let pending = inFlight?.get(query);
    if (!pending) {
      pending = lookupPlaceFacts(query, { timeoutMs: 2_200 });
      inFlight?.set(query, pending);
    }
    const facts = await pending;
    if (!facts) {
      // Record the miss so the save-time backfill's attempt cap counts it.
      if (place.lat == null && !place.geocode) {
        place.geocode = {
          status: "pending",
          provider: "nominatim",
          attempts: 1,
          query,
          at: new Date().toISOString(),
        };
      }
      return false;
    }

    let changed = false;
    if (!place.address && facts.address) {
      place.address = facts.address;
      changed = true;
    }
    if (!place.phone && facts.phone) {
      place.phone = facts.phone;
      changed = true;
    }
    if (!place.website && facts.website) {
      place.website = facts.website;
      changed = true;
    }
    if (!place.hours && facts.hours) {
      place.hours = facts.hours;
      changed = true;
    }
    if (place.lat == null && facts.lat != null && facts.lng != null) {
      place.lat = facts.lat;
      place.lng = facts.lng;
      place.geocode = {
        status: "resolved",
        provider: facts.provider,
        attempts: (place.geocode?.attempts ?? 0) + 1,
        query,
        at: new Date().toISOString(),
      };
      changed = true;
    }
    if (changed) {
      // Hard facts straight off the map data — high confidence, and the
      // provenance is recorded so the review UI can show what was enriched.
      place.enrichmentSource = "openstreetmap";
      const fields = new Set(place.enrichedFields ?? []);
      if (facts.address) fields.add("address");
      if (facts.phone) fields.add("phone");
      if (facts.website) fields.add("website");
      if (facts.hours) fields.add("hours");
      place.enrichedFields = Array.from(fields);
      place.confidence = Math.max(place.confidence ?? 0, 0.9);
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

  const key = process.env.LOVABLE_API_KEY;
  if (!key) return;
  const { streamLovableJsonResponse } = await import("@/lib/ai-gateway.server");
  const result = await streamLovableJsonResponse<unknown>({
    apiKey: key,
    instructions: "Write one factual editorial note under 15 words per venue. Use null when uncertain. Never fabricate.",
    input: `Destination: ${destination ?? "unknown"}\n\n${list}`,
    schemaName: "editorial_notes",
    schema: NOTES_OUTPUT_JSON_SCHEMA,
    reasoningEffort: "low",
  });
  const output = NotesSchema.parse(result.value);
  for (const { index, note } of output.notes) {
    const p = places[index];
    if (!p || !note) continue;
    const trimmed = note.trim();
    if (trimmed) p.note = trimmed;
  }
}
