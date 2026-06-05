import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

/**
 * Live research step for the itinerary generator.
 *
 * Cross-references two complementary signals:
 *   1. Firecrawl web search — fresh URLs, titles, descriptions, and
 *      lightweight markdown for the destination during the user's
 *      dates (attractions, hours, ticketed events).
 *   2. Gemini synthesis — distils those sources into a numbered
 *      research brief the generator can quote, with each fact tied
 *      back to a citation index.
 *
 * Returns a `notes` string the generator pastes verbatim into its
 * prompt and an aligned `citations` array the draft references as
 * `[1]`, `[2]`, …
 *
 * Server-only. Falls back gracefully when Firecrawl is unavailable.
 */

const Input = z.object({
  destination: z.string().min(1).max(160),
  startDate: z.string().max(60).optional(),
  duration: z.string().max(60).optional(),
  interests: z.array(z.string().max(40)).max(20).optional(),
});

type FirecrawlHit = {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
};

const FIRECRAWL_SEARCH = "https://connector-gateway.lovable.dev/firecrawl/v2/search";

async function firecrawlSearch(query: string, limit = 5): Promise<FirecrawlHit[]> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!lovableKey || !firecrawlKey) return [];
  try {
    const res = await fetch(FIRECRAWL_SEARCH, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": firecrawlKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit,
        // Pull a small slice of markdown so Gemini can verify claims.
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
    });
    if (!res.ok) {
      console.error("[research] firecrawl", res.status, await res.text().catch(() => ""));
      return [];
    }
    const json = (await res.json().catch(() => null)) as
      | { data?: { web?: FirecrawlHit[] } | FirecrawlHit[] }
      | null;
    if (!json) return [];
    const arr = Array.isArray(json.data)
      ? (json.data as FirecrawlHit[])
      : ((json.data?.web as FirecrawlHit[] | undefined) ?? []);
    return arr.slice(0, limit).filter((h) => !!h?.url);
  } catch (err) {
    console.error("[research] firecrawl threw", err);
    return [];
  }
}

function dedupeByUrl(hits: FirecrawlHit[]): FirecrawlHit[] {
  const seen = new Set<string>();
  const out: FirecrawlHit[] = [];
  for (const h of hits) {
    try {
      const u = new URL(h.url).toString();
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(h);
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

export type ResearchCitation = { n: number; title: string; url: string };

export const researchDestination = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const when = data.startDate ? ` ${data.startDate}` : "";
    const interests = data.interests?.length ? data.interests.join(", ") : "";
    const queries = [
      `${data.destination} top things to do${when}`,
      `${data.destination} events and exhibitions${when}`,
      `${data.destination} restaurants currently recommended`,
      interests ? `${data.destination} ${interests}${when}` : null,
    ].filter(Boolean) as string[];

    const results = await Promise.all(queries.map((q) => firecrawlSearch(q, 4)));
    const hits = dedupeByUrl(results.flat()).slice(0, 12);

    if (!hits.length) {
      return {
        notes: "",
        citations: [] as ResearchCitation[],
        sourceCount: 0,
      };
    }

    const citations: ResearchCitation[] = hits.map((h, i) => ({
      n: i + 1,
      title: (h.title ?? h.url).slice(0, 200),
      url: h.url,
    }));

    // Compact context for synthesis. Keep payload small — model only
    // needs enough to recognise overlap between sources.
    const corpus = hits
      .map((h, i) => {
        const md = (h.markdown ?? "").replace(/\s+/g, " ").slice(0, 800);
        const desc = (h.description ?? "").slice(0, 240);
        return `[${i + 1}] ${h.title ?? h.url}\nURL: ${h.url}\n${desc}\n${md}`;
      })
      .join("\n\n---\n\n");

    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) {
      // Still return raw hits so the generator can at least cite them.
      return {
        notes: hits
          .map((h, i) => `- [${i + 1}] ${h.title ?? h.url} — ${h.description ?? ""}`)
          .join("\n"),
        citations,
        sourceCount: hits.length,
      };
    }

    try {
      const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
      const gateway = createLovableAiGatewayProvider(lovableKey);
      const synthesis = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        system: `You are a research analyst preparing a verified brief for a luxury travel advisor.
You will receive numbered web sources for a destination and travel window.
Cross-reference the sources, ignore promotional fluff, and produce 8-14 concise bullet facts (≤22 words each) that appear in MORE THAN ONE source OR are clearly time-sensitive (opening hours, dates, closures, ticket requirements, current exhibitions).
Every bullet MUST end with one or more bracketed citation indices like [1] or [2,5]. NEVER invent a number outside the provided source list.
Group bullets under: "Right now (time-sensitive)", "Attractions", "Food & drink", "Logistics".
Return ONLY the structured object.`,
        prompt: `Destination: ${data.destination}${when ? `\nTravel window: ${when.trim()}` : ""}${
          interests ? `\nTraveler interests: ${interests}` : ""
        }\n\nSources:\n\n${corpus}`,
        experimental_output: Output.object({
          schema: z.object({
            brief: z.string().describe("Markdown brief with grouped bullets and [n] citations."),
          }),
        }),
      });
      const notes = synthesis.experimental_output.brief.trim();
      return { notes, citations, sourceCount: hits.length };
    } catch (err) {
      console.error("[research] synthesis failed", err);
      // Degrade to a raw list — still useful, still cited.
      return {
        notes: hits
          .map((h, i) => `- [${i + 1}] ${h.title ?? h.url} — ${(h.description ?? "").slice(0, 160)}`)
          .join("\n"),
        citations,
        sourceCount: hits.length,
      };
    }
  });