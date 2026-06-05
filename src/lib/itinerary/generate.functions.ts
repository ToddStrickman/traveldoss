import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z, ZodError, type ZodIssue } from "zod";
import type {
  DebugAttempt,
  DebugReport,
} from "@/lib/itinerary/debug-report";

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
  /** When true, run the live web-research step before drafting. */
  useLiveResearch: z.boolean().optional(),
});

const OutputSchema = z.object({
  needsClarification: z.boolean().default(false),
  clarifyingQuestions: z.array(z.string()).default([]),
  itinerary: z.string().default(""),
});

/**
 * Loose schema used before strict OutputSchema validation. Coerces common
 * shape drift from the model:
 *   - clarifyingQuestions returned as a single string → wrap in array
 *   - itinerary returned as string[] of lines → join with newlines
 *   - itinerary nested under {markdown|text|content|body}
 *   - needsClarification returned as "true"/"false" string
 *   - top-level array wrapper [{...}] → unwrap
 */
function normalizeOutput(input: unknown): unknown {
  let node: unknown = input;
  if (Array.isArray(node) && node.length > 0) node = node[0];
  if (!node || typeof node !== "object") return input;
  const obj = { ...(node as Record<string, unknown>) };

  if (typeof obj.needsClarification === "string") {
    obj.needsClarification = /^true$/i.test(obj.needsClarification);
  }

  const cq = obj.clarifyingQuestions ?? obj.questions;
  if (typeof cq === "string") {
    obj.clarifyingQuestions = cq.trim() ? [cq.trim()] : [];
  } else if (Array.isArray(cq)) {
    obj.clarifyingQuestions = cq
      .map((q) => (typeof q === "string" ? q.trim() : ""))
      .filter((q) => q.length > 0);
  } else if (cq == null) {
    obj.clarifyingQuestions = [];
  }

  let itin: unknown = obj.itinerary;
  if (itin == null) {
    itin = obj.markdown ?? obj.text ?? obj.content ?? obj.body ?? obj.draft;
  }
  if (Array.isArray(itin)) {
    itin = itin
      .map((line) => (typeof line === "string" ? line : ""))
      .filter((line) => line.length > 0)
      .join("\n");
  } else if (itin && typeof itin === "object") {
    // Sometimes wrapped as { markdown: "..." }
    const nested = itin as Record<string, unknown>;
    const inner = nested.markdown ?? nested.text ?? nested.content ?? nested.body;
    if (typeof inner === "string") itin = inner;
  }
  if (typeof itin !== "string") itin = "";
  obj.itinerary = (itin as string).trim();

  return obj;
}

/**
 * Last-resort recovery: pull a usable markdown itinerary out of a raw text
 * payload even when JSON.parse failed (e.g. truncated output, unescaped
 * quotes inside the itinerary string).
 */
function salvageItineraryFromRaw(raw: string): string | null {
  if (!raw) return null;
  // Strip fences if present.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;

  // Try to find an "itinerary": "..." field and extract its contents,
  // tolerating truncation (no closing quote) and embedded newlines.
  const keyIdx = body.search(/"itinerary"\s*:\s*"/);
  if (keyIdx !== -1) {
    const afterQuote = body.indexOf('"', body.indexOf(":", keyIdx) + 1) + 1;
    let end = afterQuote;
    while (end < body.length) {
      const next = body.indexOf('"', end);
      if (next === -1) {
        end = body.length;
        break;
      }
      // Unescaped closing quote — count preceding backslashes.
      let slashes = 0;
      for (let i = next - 1; i >= 0 && body[i] === "\\"; i--) slashes++;
      if (slashes % 2 === 0) {
        end = next;
        break;
      }
      end = next + 1;
    }
    const slice = body.slice(afterQuote, end);
    const unescaped = slice
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim();
    if (looksLikeItinerary(unescaped)) return unescaped;
  }

  // Otherwise, if the raw body itself looks like a markdown itinerary, use it.
  if (looksLikeItinerary(body)) return body.trim();
  return null;
}

function looksLikeItinerary(text: string): boolean {
  if (!text || text.trim().length < 40) return false;
  // Require at least one Day heading or a clear time-of-day bullet.
  return /(^|\n)#{1,3}\s*Day\s*\d/i.test(text) || /(Morning|Afternoon|Evening)\s*·/.test(text);
}

const SYSTEM = `You are TravelDoss's master itinerary architect. You write itineraries with the polish of an elite travel advisor: specific named venues, neighborhoods, opening times, transit hints, and one-line editorial reasoning per stop.

Your job has two modes:

MODE A — CLARIFY (use sparingly)
  Set needsClarification=true ONLY when the DESTINATION is missing AND cannot be inferred from the brief or structured preferences. Destination is the single blocking unknown — without it you cannot draft.
  Do NOT clarify for missing duration, dates, traveler count, pace, budget, or interests. Pick sensible defaults (e.g. 5 days, 2 adults, balanced pace, moderate budget) and draft. A downstream step will collect refinements from the traveler if they want to tune the result.
  When you must clarify, ask AT MOST 1 question — a single concise sentence asking for the destination (or to pick between destinations if the brief lists several without committing). Empty itinerary in this mode.

MODE B — DRAFT (default)
  Make reasonable inferences for every detail except destination. Produce a complete draft itinerary even when most fields are missing — never refuse, never hedge. If duration is unstated, assume 5 days. If travelers are unstated, assume 2 adults. If pace/budget are unstated, assume balanced + moderate.
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

    // ── Live research (optional) ────────────────────────────────────
    // Only worth the call when we have a destination to anchor it.
    let researchNotes = "";
    let citations: { n: number; title: string; url: string }[] = [];
    if (data.useLiveResearch && data.destination?.trim()) {
      try {
        const { researchDestination } = await import("./research.functions");
        const r = await researchDestination({
          data: {
            destination: data.destination.trim(),
            startDate: data.startDate,
            duration: data.duration,
            interests: data.interests,
          },
        });
        researchNotes = r.notes;
        citations = r.citations;
      } catch (err) {
        console.error("[generate] research step failed; continuing without it", err);
      }
    }
    const briefWithResearch = researchNotes
      ? `${brief}\n\nLive research brief (cite by bracketed index — these numbers map to URLs the user will see):\n${researchNotes}`
      : brief;

    const MAX_ATTEMPTS = 3;
    let lastErr: unknown = null;
    const attempts: DebugAttempt[] = [];
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const sys = researchNotes
          ? `${SYSTEM}\n\nA live research brief follows the trip brief. When a fact (hours, ticket rule, recent opening, exhibition) came from a numbered source, preserve the [n] citation at the end of the sentence in the venue rationale. Do not invent indices.`
          : SYSTEM;
        const out = await generateStructured(gateway, sys, briefWithResearch, attempts);
        if (out.needsClarification && out.clarifyingQuestions.length > 0) {
          const base = {
            kind: "clarify" as const,
            questions: out.clarifyingQuestions.slice(0, 3),
          };
          return attempts.length
            ? {
                ...base,
                debugReport: buildDebugReport(attempts, "success-after-retry", base),
              }
            : base;
        }
        if (!out.itinerary || out.itinerary.trim().length < 40) {
          throw new Error("Generator returned an empty itinerary.");
        }
        // Append a "Sources" footer so citations survive the markdown-
        // to-Block parser as a single paragraph block at the end.
        const draft = citations.length
          ? `${out.itinerary.trim()}\n\n## Sources\n${citations
              .map((c) => `[${c.n}] ${c.title} — ${c.url}`)
              .join("\n")}\n`
          : out.itinerary;
        const base = { kind: "draft" as const, draft, citations };
        return attempts.length
          ? {
              ...base,
              debugReport: buildDebugReport(attempts, "success-after-retry", base),
            }
          : base;
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
        // Throw the underlying error verbatim — the client's catch handler
        // doesn't have access to the attempts array; the debugReport is
        // already serialized into the inner generateStructured fallback
        // return when applicable.
        throw new Error(`Itinerary generator failed: ${msg}`);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Generator failed.");
  });

function buildDebugReport(
  attempts: DebugAttempt[],
  outcome: DebugReport["outcome"],
  finalParsed?: unknown,
  finalError?: string,
): DebugReport {
  return {
    source: "generate",
    createdAt: new Date().toISOString(),
    model: "google/gemini-2.5-flash",
    outcome,
    attempts,
    finalParsed,
    finalError,
  };
}

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

type OutShape = z.infer<typeof OutputSchema>;

async function generateStructured(
  gateway: ReturnType<typeof import("@/lib/ai-gateway.server").createLovableAiGatewayProvider>,
  system: string,
  prompt: string,
  attempts?: DebugAttempt[],
): Promise<OutShape> {
  const recordAttempt = (entry: DebugAttempt) => {
    if (attempts) attempts.push(entry);
  };
  // First try: AI SDK structured output (constrained decoding).
  try {
    const result = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system,
      prompt,
      experimental_output: Output.object({ schema: OutputSchema }),
      maxOutputTokens: 8192,
    });
    const normalized = normalizeOutput(result.experimental_output);
    const safe = OutputSchema.safeParse(normalized);
    const out = safe.success ? safe.data : result.experimental_output;
    // Gemini sometimes returns a valid-shape object with an empty itinerary
    // string when it hits a token limit or stalls. Treat that as a failure
    // so we fall through to the JSON-prompt retry path below instead of
    // bubbling an "empty itinerary" error all the way to the user.
    const finishReason = (result as unknown as { finishReason?: string }).finishReason;
    if (
      !out.needsClarification &&
      (!out.itinerary || out.itinerary.trim().length < 40)
    ) {
      recordAttempt({
        attempt: 0,
        rawResponse: out.itinerary ?? "",
        threwError: `structured-output: empty itinerary (finishReason=${finishReason ?? "unknown"})`,
      });
      // fall through to JSON-prompt path
    } else {
      return out;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    recordAttempt({
      attempt: 0,
      rawResponse: "",
      threwError: `structured-output: ${msg}`,
    });
    // Gemini sometimes returns text that doesn't match the schema state
    // machine. Fall back to a plain JSON prompt and parse manually.
    if (!/schema|object/i.test(msg)) throw err;
  }

  const jsonSystem = `${system}\n\nReturn ONLY a single JSON object (no prose, no code fences) with this exact shape:\n{\n  "needsClarification": boolean,\n  "clarifyingQuestions": string[],   // up to 3, empty if not clarifying\n  "itinerary": string                // full markdown itinerary, empty if clarifying\n}`;

  // Retry the JSON-prompt path with exponential backoff. Each retry appends
 // the previous failure so the model can self-correct.
  const MAX_JSON_ATTEMPTS = 3;
  let lastRaw = "";
  let lastIssue = "";
  for (let attempt = 1; attempt <= MAX_JSON_ATTEMPTS; attempt++) {
    const repairNote = lastIssue
      ? `\n\nYour previous response could not be parsed (${lastIssue}). Return ONLY the JSON object this time — no prose, no code fences, no trailing commentary.`
      : "";
    try {
      const result = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        system: jsonSystem + repairNote,
        prompt,
        maxOutputTokens: 8192,
      });
      lastRaw = result.text.trim();
      const jsonText = extractJsonObject(lastRaw);
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch (jsonErr) {
        const snippet = lastRaw.slice(0, 400).replace(/\s+/g, " ");
        console.error(
          `[generate] attempt ${attempt}/${MAX_JSON_ATTEMPTS} JSON.parse failed: ${(jsonErr as Error).message}\n  raw[0..400]: ${snippet}`,
        );
        lastIssue = `invalid JSON syntax: ${(jsonErr as Error).message.slice(0, 120)}`;
        recordAttempt({
          attempt,
          rawResponse: lastRaw,
          jsonParseError: (jsonErr as Error).message,
        });
        if (attempt < MAX_JSON_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
        }
        continue;
      }
      const safe = OutputSchema.safeParse(parsed);
      const normalized = normalizeOutput(parsed);
      const safeNorm = OutputSchema.safeParse(normalized);
      if (safe.success && safe.data.itinerary.trim().length >= 40) return safe.data;
      if (
        safeNorm.success &&
        (safeNorm.data.needsClarification || looksLikeItinerary(safeNorm.data.itinerary))
      ) {
        return safeNorm.data;
      }
      const errForLog = !safe.success
        ? safe.error
        : !safeNorm.success
          ? safeNorm.error
          : null;
      if (errForLog) {
        logZodDiagnostics("generate", attempt, MAX_JSON_ATTEMPTS, errForLog, parsed, lastRaw);
        lastIssue = summarizeIssues(errForLog.issues);
      } else {
        lastIssue = "itinerary too short or missing day structure";
      }
      recordAttempt({
        attempt,
        rawResponse: lastRaw,
        parsedJson: parsed,
            zodIssues: errForLog ? errForLog.issues : [],
        zodIssueSummary: lastIssue,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/402|credit/i.test(msg)) {
        throw new Error("AI credits exhausted. Add credits in Workspace → Usage.");
      }
      console.error(`[generate] attempt ${attempt}/${MAX_JSON_ATTEMPTS} threw:`, err);
      lastIssue = /JSON/i.test(msg) ? "invalid JSON syntax" : msg.slice(0, 120);
      recordAttempt({
        attempt,
        rawResponse: lastRaw,
        threwError: msg,
      });
    }
    if (attempt < MAX_JSON_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
    }
  }

  // Final fallback: treat the last raw response as itinerary markdown so the
  // user still gets something useful instead of a hard error.
  if (lastRaw) {
    const salvaged = salvageItineraryFromRaw(lastRaw);
    if (salvaged) {
      recordAttempt({
        attempt: MAX_JSON_ATTEMPTS + 1,
        rawResponse: lastRaw,
        threwError: `salvaged-from-raw: ${lastIssue}`,
      });
      return { needsClarification: false, clarifyingQuestions: [], itinerary: salvaged };
    }
    recordAttempt({
      attempt: MAX_JSON_ATTEMPTS + 1,
      rawResponse: lastRaw,
      threwError: `raw-fallback: ${lastIssue}`,
    });
    return { needsClarification: false, clarifyingQuestions: [], itinerary: lastRaw };
  }
  throw new Error(`Itinerary generator could not produce valid JSON after ${MAX_JSON_ATTEMPTS} attempts (${lastIssue}).`);
}

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return body.trim();
  return body.slice(start, end + 1);
}

/**
 * Format every Zod issue with its full path, expected/received types when
 * available, and the parsed-value preview at that path so we can see
 * exactly which field the model got wrong.
 */
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
    /* ignore preview errors */
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
  const rawSnippet = raw.slice(0, 600).replace(/\s+/g, " ");
  console.error(
    `[${tag}] attempt ${attempt}/${max} schema mismatch — ${error.issues.length} issue(s):\n${lines.join("\n")}\n  raw[0..600]: ${rawSnippet}`,
  );
}
