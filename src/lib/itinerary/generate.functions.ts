import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

/**
 * AI itinerary generator.
 *
 * Takes a natural-language trip brief plus structured preferences and
 * returns either:
 *   (a) a short list of clarifying questions when intent is genuinely
 *       ambiguous (missing destination, dates, duration), or
 *   (b) a fully drafted markdown itinerary the caller can hand off to
 *       `parseItineraryAi` for block extraction + live web-enrichment
 *       through the existing Google Places pipeline.
 *
 * Server-only — LOVABLE_API_KEY stays out of the client bundle.
 */

const InputSchema = z.object({
  prompt: z.string().min(1).max(4000),
  destination: z.string().max(200).optional(),
  duration: z.string().max(80).optional(),
  startDate: z.string().max(40).optional(),
  travelers: z.string().max(80).optional(),
  pace: z.enum(["relaxed", "balanced", "packed"]).optional(),
  budget: z.enum(["shoestring", "moderate", "elevated", "luxury"]).optional(),
  interests: z.array(z.string().max(40)).max(20).optional(),
  // Optional Q&A appended after the first clarify round.
  clarifications: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .max(8)
    .optional(),
});

const OutputSchema = z.object({
  needsClarification: z
    .boolean()
    .describe(
      "True ONLY if a critical detail (destination, length, dates, traveler profile) is missing AND would meaningfully change the itinerary. Prefer false: make reasonable inferences and produce a draft whenever possible.",
    ),
  clarifyingQuestions: z
    .array(z.string())
    .max(3)
    .describe(
      "Up to 3 targeted questions. Each must be a single concise sentence asking for ONE piece of information. Empty when needsClarification is false.",
    ),
  itinerary: z
    .string()
    .describe(
      "When needsClarification is false, a complete itinerary in TravelDoss markdown house style (see system prompt). Empty string when needsClarification is true.",
    ),
});

const SYSTEM = `You are TravelDoss's master itinerary architect. You write itineraries with the polish of an elite travel advisor: specific named venues, neighborhoods, opening times, transit hints, and one-line editorial reasoning per stop.

Your job has two modes:

MODE A — CLARIFY (use sparingly)
  Set needsClarification=true ONLY if a critical detail is missing AND would meaningfully change the trip. Critical = destination(s), trip length, traveler profile when extreme (toddlers, mobility limits), or hard date constraints during peak/closed seasons.
  Ask AT MOST 3 questions. Each is a single concise sentence asking for ONE thing. Empty itinerary in this mode.

MODE B — DRAFT (default)
  Make reasonable inferences. Produce a complete draft itinerary even when minor details are missing — never refuse, never hedge.
  Use your training knowledge of real venues (restaurants, hotels, museums, neighborhoods, hours). Real names only, no placeholders. Vendor facts (addresses, phones, websites, current hours) will be verified live by a downstream enrichment step, so prioritize correct identification of well-known venues.

OUTPUT FORMAT for the itinerary string (Mode B):
  Markdown, in this exact shape:

    # Trip Overview
    2–3 sentence editorial summary of the trip arc.

    ## Day 1 — <Short Label> (<calendar date if known>)
    - Morning · <Venue Name> — one-sentence rationale.
    - Afternoon · <Venue Name> — one-sentence rationale.
    - Evening · <Venue Name> — one-sentence rationale.

    ## Day 2 — <Label>
    - ...

  Rules:
  • Use real, currently-operating venues you actually know.
  • One venue per bullet. Lead with a time-of-day cue (Morning/Afternoon/Evening or "09:00", "14:30", "20:00").
  • Include a recommended accommodation (one bullet labeled "Stay · <Hotel Name> — <neighborhood>") near the top of Day 1 unless the brief says the user already has lodging.
  • Include inter-city transit as its own bullet ("Transit · <mode> <from→to>") when the day involves a move.
  • Honor the user's stated pace, budget, and interests. Match the budget tier in venue selection.
  • NO emojis. NO marketing fluff. NO "Pro tip" boxes. NO closing summary.
  • Do not invent restaurant names or attractions you don't recognize — if you don't know a real venue for a slot, describe the experience neutrally ("a well-regarded omakase counter in Ginza").

Return ONLY the structured object.`;

export const generateItineraryAi = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      throw new Error(
        "AI generator is not configured. Missing LOVABLE_API_KEY on the server.",
      );
    }

    const { createLovableAiGatewayProvider } = await import(
      "@/lib/ai-gateway.server"
    );
    const gateway = createLovableAiGatewayProvider(key);

    const brief = buildBrief(data);

    const MAX_ATTEMPTS = 3;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await generateText({
          model: gateway("google/gemini-2.5-flash"),
          system: SYSTEM,
          prompt: brief,
          experimental_output: Output.object({ schema: OutputSchema }),
        });
        const out = result.experimental_output;
        if (out.needsClarification && out.clarifyingQuestions.length > 0) {
          return {
            kind: "clarify" as const,
            questions: out.clarifyingQuestions.slice(0, 3),
          };
        }
        if (!out.itinerary || out.itinerary.trim().length < 40) {
          throw new Error("Generator returned an empty itinerary.");
        }
        return { kind: "draft" as const, draft: out.itinerary };
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (/402|credit/i.test(msg)) {
          throw new Error("AI credits exhausted. Add credits in Workspace → Usage.");
        }
        if (/429|rate/i.test(msg) && attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 750 * 2 ** (attempt - 1)));
          continue;
        }
        throw new Error(`Itinerary generator failed: ${msg}`);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Generator failed.");
  });

function buildBrief(data: z.infer<typeof InputSchema>): string {
  const lines: string[] = [];
  lines.push("Trip brief from the traveler:");
  lines.push("");
  lines.push(`"${data.prompt.trim()}"`);
  lines.push("");
  const fields: string[] = [];
  if (data.destination) fields.push(`Destination: ${data.destination}`);
  if (data.duration) fields.push(`Duration: ${data.duration}`);
  if (data.startDate) fields.push(`Start date: ${data.startDate}`);
  if (data.travelers) fields.push(`Travelers: ${data.travelers}`);
  if (data.pace) fields.push(`Pace: ${data.pace}`);
  if (data.budget) fields.push(`Budget: ${data.budget}`);
  if (data.interests?.length) fields.push(`Interests: ${data.interests.join(", ")}`);
  if (fields.length) {
    lines.push("Structured preferences:");
    for (const f of fields) lines.push(`• ${f}`);
    lines.push("");
  }
  if (data.clarifications?.length) {
    lines.push("Follow-up answers from the traveler:");
    for (const { question, answer } of data.clarifications) {
      lines.push(`• Q: ${question}`);
      lines.push(`  A: ${answer}`);
    }
    lines.push("");
    lines.push(
      "All blocking ambiguity is now resolved — produce the full itinerary (Mode B).",
    );
  } else {
    lines.push(
      "Decide whether you have enough to draft (Mode B) or must ask up to 3 clarifying questions (Mode A).",
    );
  }
  return lines.join("\n");
}
