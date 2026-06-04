import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { Block } from "@/lib/skins/types";

/**
 * AI-powered itinerary parser. Takes raw pasted text (from ChatGPT,
 * Claude, notes, transcripts, anything) and returns a fully typed
 * Block[] enriched with addresses, phones, websites, and a single
 * concise editorial note per vendor when the model recognises it.
 *
 * Server-only. The browser calls this through useServerFn so the
 * LOVABLE_API_KEY never leaks into the client bundle.
 */

const BlockSchema = z.object({
  destination: z
    .string()
    .nullable()
    .describe("The primary destination of the trip, e.g. 'Tokyo' or 'Amalfi Coast'. Null if undecidable."),
  blocks: z
    .array(
      z.object({
        kind: z
          .enum(["day", "place", "flight", "paragraph", "note"])
          .describe("The block type."),
        // day fields
        n: z.number().nullable().describe("Day number (only for kind=day)"),
        label: z
          .string()
          .nullable()
          .describe("Short title for a day, e.g. 'Arrival in Rome'"),
        // place fields
        name: z.string().nullable().describe("Name of the place/vendor"),
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
          .describe(
            "One of the six canonical categories. Empty string '' if genuinely ambiguous — DO NOT GUESS.",
          ),
        address: z.string().nullable().describe("Full street address if known"),
        phone: z.string().nullable().describe("Localized phone number if known"),
        website: z.string().nullable().describe("Official website URL if known"),
        hours: z.string().nullable(),
        time: z.string().nullable().describe("Clock time like '14:30' if mentioned"),
        reservation: z.string().nullable(),
        note: z
          .string()
          .nullable()
          .describe(
            "ONE concise editorial sentence (<15 words) combining the source context with a factual insight about the vendor. Empty if the model has no insight.",
          ),
        // accommodation
        checkIn: z.string().nullable(),
        checkOut: z.string().nullable(),
        amenities: z.string().nullable(),
        // restaurant
        dressCode: z.string().nullable(),
        mustOrder: z.string().nullable(),
        // transit
        vendor: z.string().nullable(),
        pickup: z.string().nullable(),
        dropoff: z.string().nullable(),
        // event / culture
        venue: z.string().nullable(),
        ticketRequirement: z.string().nullable(),
        tourDetails: z.string().nullable(),
        // walk
        trailhead: z.string().nullable(),
        distance: z.string().nullable(),
        duration: z.string().nullable(),
        difficulty: z.string().nullable(),
        // flight
        airline: z.string().nullable(),
        flightNumber: z.string().nullable(),
        from: z.string().nullable().describe("Departure airport IATA code"),
        to: z.string().nullable().describe("Arrival airport IATA code"),
        fromCity: z.string().nullable(),
        toCity: z.string().nullable(),
        departTime: z.string().nullable(),
        arriveTime: z.string().nullable(),
        date: z.string().nullable(),
        arriveDate: z.string().nullable(),
        // paragraph / note
        text: z.string().nullable().describe("Body text for paragraph/note blocks"),
      }),
    )
    .describe("Ordered list of itinerary blocks"),
});

const SYSTEM_PROMPT = `You are the core data extraction and enrichment engine for TravelDoss, a luxury travel itinerary platform. Transform unstructured copy-pasted travel text into our strict JSON schema.

RULES — these are non-negotiable:

1. STRICT CATEGORIZATION. Every place block MUST be one of:
   • transit       — taxis, ferries, trains, transfers, airport pickups
   • restaurant    — restaurants, cafés, bars, food experiences
   • walk          — walking tours, hikes, trails
   • event         — concerts, theatre, sports, shows
   • accommodation — hotels, rentals, B&Bs, lodges
   • culture       — museums, galleries, monuments, temples, cultural sites
   Use "" (empty string) ONLY when the category is genuinely ambiguous.

2. ZERO GUESSWORK on facts. Fields you don't know go null/empty. Never fabricate addresses, phone numbers, websites, or hours.

3. AUTO-ENRICHMENT (Concierge Rule). When you recognise a specific real-world vendor, restaurant, hotel, museum, or transit operator, fill in from your training knowledge:
   • address    — full street address with city
   • phone      — localized phone number with country code
   • website    — official URL (https://…)
   • hours      — typical opening hours if widely known
   For accommodation also fill checkIn/checkOut when standard.
   For restaurant also fill dressCode/mustOrder if widely known.

4. EDITORIAL NOTE. For every enriched location, write ONE concise note under 15 words that combines the source context with a factual insight. Example: "Renowned minimalist coffee bar; expect a queue on weekends."
   No note if you have no insight — leave null.

5. STRUCTURE. Emit blocks in the order they appear:
   • One {kind:"day", n, label} per day, then the day's stops as {kind:"place", …}.
   • Flights become {kind:"flight", …} with IATA codes when stated.
   • Free prose preamble becomes {kind:"paragraph", text}.
   • Standalone advice/reminders become {kind:"note", text}.

6. DESTINATION. Identify the primary city/region for the trip overall (not per-day). Null if undecidable.

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

    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    let parsed: z.infer<typeof BlockSchema>;
    try {
      const result = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        system: SYSTEM_PROMPT,
        prompt: `Source type: ${data.source}\n\n---\n${data.text}\n---\n\nReturn the structured itinerary now.`,
        experimental_output: Output.object({ schema: BlockSchema }),
      });
      parsed = result.experimental_output;
    } catch (err) {
      // Surface gateway/credit errors with a usable message.
      const msg = err instanceof Error ? err.message : String(err);
      if (/402|credit/i.test(msg)) {
        throw new Error("AI credits exhausted. Add credits in Workspace → Usage.");
      }
      if (/429|rate/i.test(msg)) {
        throw new Error("AI is busy. Wait a few seconds and retry.");
      }
      throw new Error(`AI parser failed: ${msg}`);
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
      (err) => {
        // Enrichment must never break parsing — log and move on.
        console.error("[parse-ai] enrichment fallback failed:", err);
      },
    );

    return {
      destination: parsed.destination ?? null,
      blocks,
    };
  });

/* ─── helpers ───────────────────────────────────────────────────────── */

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
      });
    case "place":
      if (!raw.name) return null;
      const category =
        raw.category && (raw.category as string) !== "" ? raw.category : undefined;
      return clean({
        kind: "place" as const,
        name: raw.name,
        category,
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